/**
 * TypeScript/JavaScript State Machine
 *
 * Ported from Lizard's typescript.py
 * - Detects function declarations (function keyword)
 * - Detects arrow functions (=>)
 * - Detects class methods
 * - Handles async, static, getter/setter modifiers
 * - Tracks function parameters and signatures
 */

import { StateMachine } from './stateMachine';
import { FunctionContext } from './functionContext';

export class TypeScriptStateMachine extends StateMachine {
    private lastTokens: string = '';
    private functionName: string = '';
    private startedFunction: boolean = false;
    private asObject: boolean = false;
    private getterSetterPrefix: string | null = null;
    private arrowFunctionPending: boolean = false;
    private tsDeclare: boolean = false;
    private staticSeen: boolean = false;
    private asyncSeen: boolean = false;
    private prevToken: string = '';

    constructor(context: FunctionContext) {
        super(context);
    }

    /**
     * Build TypeScript-specific conditions for CCN
     */
    protected buildConditions(): Set<string> {
        return new Set([
            'if', 'elseif', 'for', 'while', 'catch',  // control flow
            '&&', '||',                                // logical operators
            'case',                                    // switch cases
            '?'                                        // ternary
        ]);
    }

    /**
     * Hook called before returning from sub-state
     */
    protected stateMachineBeforeReturn(): void {
        if (this.startedFunction) {
            this.popFunctionFromStack();
        }
    }

    /**
     * Global state - looking for function declarations
     */
    protected stateGlobal(token: string): boolean | void {
        // Handle 'declare' keyword (TypeScript ambient declarations)
        if (token === 'declare') {
            this.tsDeclare = true;
            return;
        }

        // Skip declared functions (no implementation)
        if (token === 'function' && this.tsDeclare) {
            this.tsDeclare = false;
            this.state = this.skipDeclaredFunction.bind(this);
            return;
        }
        this.tsDeclare = false;

        // Track modifiers
        if (token === 'static') {
            this.staticSeen = true;
            this.prevToken = token;
            return;
        }
        if (token === 'async') {
            this.asyncSeen = true;
            this.prevToken = token;
            return;
        }
        if (token === 'new') {
            this.prevToken = token;
            return;
        }

        // Inside object/class body
        if (this.asObject) {
            // Getter/setter support
            if (token === 'get' || token === 'set') {
                this.getterSetterPrefix = token;
                return;
            }
            if (this.getterSetterPrefix) {
                this.lastTokens = `${this.getterSetterPrefix} ${token}`;
                this.getterSetterPrefix = null;
                return;
            }
            if (token === ':') {
                this.functionName = this.lastTokens;
                return;
            } else if (token === '(') {
                // Method call vs method definition
                if (this.prevToken === '.' || this.prevToken === 'new') {
                    this.prevToken = token;
                    return;
                }
                if (!this.startedFunction) {
                    this.arrowFunctionPending = true;
                    this.functionState(this.lastTokens);
                }
                this.next(this.functionState.bind(this), token);
                return;
            }
        }

        // Field access
        if (token === '.') {
            this.state = this.fieldState.bind(this);
            this.lastTokens += token;
            this.prevToken = token;
            return;
        }

        // Function keyword
        if (token === 'function') {
            this.state = this.functionState.bind(this);
        }
        // Control flow keywords
        else if (['if', 'switch', 'for', 'while', 'catch'].includes(token)) {
            this.next(this.expectingCondition.bind(this));
        }
        // Statement keywords
        else if (['else', 'do', 'try', 'finally'].includes(token)) {
            this.next(this.expectingStatement.bind(this));
        }
        // Arrow function
        else if (token === '=>') {
            this.state = this.arrowFunction.bind(this);
        }
        // Assignment (might be function expression)
        else if (token === '=') {
            this.functionName = this.lastTokens;
        }
        // Opening parenthesis
        else if (token === '(') {
            if (this.prevToken === '.' || this.prevToken === 'new') {
                // Method call or constructor
                this.subState(this.clone());
            } else {
                this.subState(this.clone());
            }
        }
        // Opening brace
        else if (token === '{') {
            if (this.startedFunction) {
                this.subState(this.clone(), () => this.popFunctionFromStack());
            } else {
                this.readObject();
            }
        }
        // Closing braces/parens
        else if (token === '}' || token === ')') {
            this.stateMachineReturn();
        }
        // Newline or semicolon
        else if (token === '\n' || token === ';') {
            this.functionName = '';
            this.popFunctionFromStack();
            this.staticSeen = false;
            this.asyncSeen = false;
        }

        this.lastTokens = token;
        if (this.prevToken !== 'new' && this.prevToken !== '.') {
            this.prevToken = token;
        }
    }

    /**
     * Skip declared function (TypeScript ambient declarations)
     */
    private skipDeclaredFunction(token: string): void {
        if (token === ';' || token === '\n') {
            this.next(this.stateGlobal.bind(this));
        }
    }

    /**
     * Read object/class body
     */
    private readObject(): void {
        const callback = () => {
            this.next(this.stateGlobal.bind(this));
        };

        const objectReader = this.clone() as TypeScriptStateMachine;
        objectReader.asObject = true;
        objectReader.staticSeen = this.staticSeen;
        objectReader.asyncSeen = this.asyncSeen;
        this.subState(objectReader, callback);

        this.staticSeen = false;
        this.asyncSeen = false;
    }

    /**
     * Expecting condition after if/for/while/catch
     */
    private expectingCondition(token: string): void {
        const callback = () => {
            this.next(this.expectingStatement.bind(this));
        };

        if (token === 'await') {
            return;
        }

        if (token !== '(') {
            this.next(this.stateGlobal.bind(this), token);
            return;
        }

        this.subState(this.clone(), callback);
    }

    /**
     * Expecting statement or block after else/do/try
     */
    private expectingStatement(token: string): void {
        const callback = () => {
            this.next(this.stateGlobal.bind(this));
        };

        if (token === '{') {
            this.subState(this.clone(), callback);
        } else {
            this.next(this.stateGlobal.bind(this), token);
        }
    }

    /**
     * Push function to stack
     */
    private pushFunctionToStack(): void {
        this.startedFunction = true;
        this.context.pushNewFunction(this.functionName || '(anonymous)');
    }

    /**
     * Pop function from stack
     */
    private popFunctionFromStack(): void {
        if (this.startedFunction) {
            this.context.endOfFunction();
        }
        this.startedFunction = false;
    }

    /**
     * Arrow function state
     */
    private arrowFunction(token: string): void {
        this.pushFunctionToStack();

        if (token === '{') {
            // Block body
            this.next(this.stateGlobal.bind(this), token);
        } else {
            // Expression body
            this.next(this.stateGlobal.bind(this), token);
        }
    }

    /**
     * Function declaration state
     */
    private functionState(token: string): void {
        // Generator function
        if (token === '*') {
            return;
        }

        // Function name
        if (token !== '(') {
            this.functionName = token;
            this.staticSeen = false;
            this.asyncSeen = false;
        } else {
            if (!this.startedFunction) {
                this.pushFunctionToStack();
            }
            this.arrowFunctionPending = false;
            this.state = this.parameterState.bind(this);
            if (token === '(') {
                this.parameterState(token);
            }
        }
    }

    /**
     * Field access state
     */
    private fieldState(token: string): void {
        this.lastTokens += token;
        this.state = this.stateGlobal.bind(this);
    }

    /**
     * Function parameter declaration state
     */
    private parameterState(token: string): void {
        if (token === ')') {
            this.state = this.expectingFunctionBody.bind(this);
        } else if (token !== '(') {
            this.context.addParameter(token);
            return;
        }
        this.context.addToLongFunctionName(' ' + token);
    }

    /**
     * Expecting function body after parameters
     */
    private expectingFunctionBody(token: string): void {
        if (token === ':') {
            // Type annotation, skip it
            this.state = this.skipTypeAnnotation.bind(this);
            return;
        }
        if (token === '=>') {
            this.state = this.arrowFunction.bind(this);
            return;
        }
        if (token === '{') {
            this.next(this.stateGlobal.bind(this), token);
        } else {
            this.popFunctionFromStack();
            this.next(this.stateGlobal.bind(this), token);
        }
    }

    /**
     * Skip type annotation after :
     */
    private skipTypeAnnotation(token: string): void {
        if (token === '{' || token === '=>') {
            this.state = this.expectingFunctionBody.bind(this);
            this.expectingFunctionBody(token);
        }
        // Continue skipping tokens until we hit { or =>
    }
}
