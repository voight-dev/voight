/**
 * Go Language State Machine
 *
 * Ported from Lizard's golike.py
 * - Detects Go function declarations
 * - Handles member functions (methods with receivers)
 * - Tracks function parameters and signatures
 * - Manages nested structures (structs, interfaces, function bodies)
 */

import { StateMachine } from './stateMachine';
import { FunctionContext } from './functionContext';

export class GoStateMachine extends StateMachine {
    private readonly FUNC_KEYWORD = 'func';

    constructor(context: FunctionContext) {
        super(context);
    }

    /**
     * Build Go-specific conditions for CCN
     */
    protected buildConditions(): Set<string> {
        return new Set([
            'if', 'for', 'range', 'select',  // control flow (Go uses range, select)
            '&&', '||',                       // logical operators
            'case',                           // switch cases
            '?'                               // ternary (rare in Go, but keep for compatibility)
        ]);
    }

    /**
     * Global state - looking for function or type definitions
     */
    protected stateGlobal(token: string): boolean | void {
        if (token === this.FUNC_KEYWORD) {
            this.state = this.functionName.bind(this);
            // Don't push function yet - wait for name
        } else if (token === 'type') {
            this.state = this.typeDefinition.bind(this);
        } else if (token === '{') {
            // Enter anonymous block (not a function)
            this.subState(this.clone());
        } else if (token === '}') {
            // Exit current scope
            this.stateMachineReturn();
        }
    }

    /**
     * After 'type' keyword - expecting type name
     */
    private typeDefinition(_token: string): void {
        this.state = this.afterTypeName.bind(this);
    }

    /**
     * After type name - check if it's struct or interface
     */
    private afterTypeName(token: string): void {
        if (token === 'struct') {
            this.state = this.structDefinition.bind(this);
        } else if (token === 'interface') {
            this.state = this.interfaceDefinition.bind(this);
        } else {
            this.state = this.stateGlobal.bind(this);
        }
    }

    /**
     * Inside struct definition - read until closing brace
     */
    private structDefinition(token: string): void {
        if (this.bracketCount === 0 && token === '{') {
            this.bracketCount = 1;
        } else if (token === '{') {
            this.bracketCount++;
        } else if (token === '}') {
            this.bracketCount--;
            if (this.bracketCount === 0) {
                this.state = this.stateGlobal.bind(this);
            }
        }
    }

    /**
     * Inside interface definition - read until closing brace
     */
    private interfaceDefinition(token: string): void {
        if (this.bracketCount === 0 && token === '{') {
            this.bracketCount = 1;
        } else if (token === '{') {
            this.bracketCount++;
        } else if (token === '}') {
            this.bracketCount--;
            if (this.bracketCount === 0) {
                this.state = this.stateGlobal.bind(this);
            }
        }
    }

    /**
     * After 'func' keyword - reading function name or receiver
     */
    private functionName(token: string): void {
        if (token === '`') {
            // Ignore backticks (rare in Go function names)
            return;
        }

        if (token === '(') {
            // Could be receiver (method) or parameter list
            // Check if we're in a nested function (closure)
            const stackedFuncs = (this.context as any).stackedFunctions || [];
            if (stackedFuncs.length > 0 && stackedFuncs[stackedFuncs.length - 1].name !== '*global*') {
                // This is a parameter list of a nested function
                this.next(this.functionDeclaration.bind(this), token);
                return;
            } else {
                // This is a receiver for a method
                this.next(this.memberFunction.bind(this), token);
                return;
            }
        }

        if (token === '{') {
            // Function body starts immediately (no parameters)
            this.next(this.expectFunctionImpl.bind(this), token);
            return;
        }

        // This is the function name - push new function
        this.context.pushNewFunction(token);
        this.state = this.expectFunctionDeclaration.bind(this);
    }

    /**
     * Expecting function declaration (parameters) or generics
     */
    private expectFunctionDeclaration(token: string): void {
        if (token === '(') {
            this.next(this.functionDeclaration.bind(this), token);
        } else if (token === '<') {
            // Generic type parameters (Go 1.18+)
            this.next(this.generics.bind(this), token);
        } else {
            // Not a function declaration, return to global
            this.state = this.stateGlobal.bind(this);
        }
    }

    /**
     * Inside generic type parameters <T, U>
     */
    private generics(token: string): void {
        if (this.bracketCount === 0 && token === '<') {
            this.bracketCount = 1;
        } else if (token === '<') {
            this.bracketCount++;
        } else if (token === '>') {
            this.bracketCount--;
            if (this.bracketCount === 0) {
                this.state = this.expectFunctionDeclaration.bind(this);
            }
        }
    }

    /**
     * Inside method receiver (ptr *Type) or (t Type)
     */
    private memberFunction(token: string): void {
        if (this.bracketCount === 0 && token === '(') {
            this.bracketCount = 1;
        } else if (token === '(') {
            this.bracketCount++;
        } else if (token === ')') {
            this.bracketCount--;
            if (this.bracketCount === 0) {
                // Done reading receiver, add to long name
                this.context.addToLongFunctionName('(' + this.collectedTokens.join('') + ')');
                this.collectedTokens = [];
                this.state = this.functionName.bind(this);
                return;
            }
        }

        if (token !== '(' && token !== ')') {
            this.collectedTokens.push(token);
        }
    }

    /**
     * Inside function parameters (x int, y int)
     */
    private functionDeclaration(token: string): void {
        if (this.bracketCount === 0 && token === '(') {
            this.bracketCount = 1;
            return;
        } else if (token === '(') {
            this.bracketCount++;
        } else if (token === ')') {
            this.bracketCount--;
            if (this.bracketCount === 0) {
                this.state = this.expectFunctionImpl.bind(this);
                return;
            }
        }

        // Track parameters
        if (token !== '(' && token !== ')') {
            this.context.addParameter(token);
        }
    }

    /**
     * Expecting function implementation (body)
     */
    private expectFunctionImpl(token: string): void {
        if (token === '{' && this.lastToken !== 'interface') {
            this.next(this.functionImpl.bind(this), token);
        }
    }

    /**
     * Inside function body - use sub-state machine
     */
    private functionImpl(_token: string): void {
        const callback = () => {
            this.state = this.stateGlobal.bind(this);
            this.context.endOfFunction();
        };

        this.subState(this.clone(), callback);
    }
}
