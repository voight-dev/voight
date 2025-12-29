/**
 * Python State Machine
 *
 * Ported from Lizard's python.py
 * - Detects function declarations (def keyword)
 * - Handles Python's indentation-based scoping
 * - Tracks function parameters and signatures
 * - Handles type annotations
 */

import { StateMachine } from './stateMachine';
import { FunctionContext } from './functionContext';

export class PythonStateMachine extends StateMachine {
    constructor(context: FunctionContext) {
        super(context);
    }

    /**
     * Build Python-specific conditions for CCN
     */
    protected buildConditions(): Set<string> {
        return new Set([
            'if', 'elif', 'for', 'while', 'except', 'finally',  // control flow
            'and', 'or',                                          // logical operators (Python uses 'and'/'or' not &&/||)
            // Python doesn't have case/switch (until 3.10 match/case)
            // Python doesn't have ? ternary (uses 'x if c else y')
        ]);
    }

    /**
     * Global state - looking for function definitions
     */
    protected stateGlobal(token: string): boolean | void {
        if (token === 'def') {
            this.state = this.functionState.bind(this);
        }
        // Python uses indentation for scope, which is handled by
        // the preprocessing step (not in the state machine)
    }

    /**
     * After 'def' keyword - reading function name
     */
    private functionState(token: string): void {
        if (token !== '(') {
            // Function name
            this.context.pushNewFunction(token);
            this.context.addToLongFunctionName('(');
        } else {
            // Opening parenthesis
            this.state = this.parameterState.bind(this);
        }
    }

    /**
     * Reading function parameters
     */
    private parameterState(token: string): void {
        if (token === ')') {
            this.state = this.colonState.bind(this);
        } else if (token === '[') {
            // Type annotation with brackets (e.g., List[int])
            this.state = this.typeAnnotationState.bind(this);
        } else {
            this.context.addParameter(token);
            return;
        }
        this.context.addToLongFunctionName(' ' + token);
    }

    /**
     * Inside type annotation with brackets
     */
    private typeAnnotationState(token: string): void {
        this.context.addToLongFunctionName(' ' + token);
        if (token === ']') {
            this.state = this.parameterState.bind(this);
        }
    }

    /**
     * Expecting colon after parameters
     */
    private colonState(token: string): void {
        if (token === ':') {
            this.next(this.firstLineState.bind(this));
        } else {
            // No colon, not a valid function definition
            this.next(this.stateGlobal.bind(this));
        }
    }

    /**
     * First line after function definition
     * May contain docstring
     */
    private firstLineState(token: string): void {
        this.state = this.stateGlobal.bind(this);

        // Check for docstring (triple-quoted string)
        if (token.startsWith('"""') || token.startsWith("'''")) {
            // Docstrings don't count toward NLOC
            const newlineCount = (token.match(/\n/g) || []).length;
            this.context.addNloc(-(newlineCount + 1));
        }

        // Process the token in global state
        this.stateGlobal(token);
    }
}

/**
 * Python Indentation Handler
 *
 * Handles Python's indentation-based scoping
 * This would typically be used in a preprocessing step
 */
export class PythonIndentHandler {
    private indents: number[] = [0];
    private context: FunctionContext;

    constructor(context: FunctionContext) {
        this.context = context;
    }

    /**
     * Update nesting level based on indentation
     */
    public setNesting(spaces: number, token: string = ''): void {
        // Dedent - pop nesting levels
        while (this.indents[this.indents.length - 1] > spaces && !token.startsWith(')')) {
            this.indents.pop();
            // End function if we're dedenting back
            if (this.indents.length > 0) {
                this.context.endOfFunction();
            }
        }

        // Indent - push new nesting level
        if (this.indents[this.indents.length - 1] < spaces) {
            this.indents.push(spaces);
            // New nesting level (but not necessarily a function)
        }
    }

    /**
     * Reset indentation (end of file)
     */
    public reset(): void {
        this.setNesting(0);
    }

    /**
     * Count spaces in indentation (tabs = 8 spaces)
     */
    public static countSpaces(token: string): number {
        return token.replace(/\t/g, ' '.repeat(8)).length;
    }
}
