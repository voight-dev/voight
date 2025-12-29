/**
 * Base State Machine for language parsing
 *
 * Ported from Lizard's CodeStateMachine and CodeReader
 * - Manages state transitions during token processing
 * - Supports sub-state machines for nested structures
 * - Tracks brackets and parentheses matching
 */

import { FunctionContext } from './functionContext';

/**
 * State handler function type
 */
export type StateHandler = (token: string) => boolean | void;

/**
 * Base class for language-specific state machines
 */
export abstract class StateMachine {
    protected context: FunctionContext;
    protected state: StateHandler;
    protected savedState: StateHandler;
    protected lastToken: string | null = null;
    protected toExit: boolean = false;
    protected callback: (() => void) | null = null;

    // For read_inside_brackets pattern
    protected bracketCount: number = 0;
    protected collectedTokens: string[] = [];

    // Condition keywords for CCN calculation
    protected conditions: Set<string>;

    constructor(context: FunctionContext) {
        this.context = context;
        this.state = this.stateGlobal.bind(this);
        this.savedState = this.state;
        this.conditions = this.buildConditions();
    }

    /**
     * Build the set of condition keywords for this language
     * Override in subclasses to customize
     */
    protected buildConditions(): Set<string> {
        return new Set([
            'if', 'for', 'while', 'catch',  // control flow
            '&&', '||',                      // logical operators
            'case',                          // switch cases
            '?'                              // ternary
        ]);
    }

    /**
     * Clone the state machine (for sub-states)
     */
    public clone(): StateMachine {
        const cloned = new (this.constructor as any)(this.context);
        return cloned;
    }

    /**
     * Process a token through the state machine
     * Returns true if should exit (for sub-state machines)
     */
    public processToken(token: string): boolean {
        // Call current state handler
        const result = this.state(token);

        // If state handler returns true, restore saved state
        if (result === true) {
            this.state = this.savedState;
            if (this.callback) {
                this.callback();
                this.callback = null;
            }
        }

        // Track condition keywords for CCN
        if (this.conditions.has(token)) {
            this.context.addCondition(1);
        }

        this.lastToken = token;
        return this.toExit;
    }

    /**
     * Transition to a new state
     */
    protected next(newState: StateHandler, token?: string): boolean | void {
        this.state = newState;
        if (token !== undefined) {
            return this.processToken(token);
        }
    }

    /**
     * Enter a sub-state (nested structure)
     */
    protected subState(subMachine: StateMachine, callback?: () => void, token?: string): void {
        this.savedState = this.state;
        this.callback = callback || null;
        this.state = (t: string) => subMachine.processToken(t);
        if (token !== undefined) {
            this.processToken(token);
        }
    }

    /**
     * Signal that this sub-state should exit
     */
    protected stateMachineReturn(): void {
        this.toExit = true;
        this.stateMachineBeforeReturn();
    }

    /**
     * Hook called before returning from sub-state
     * Override in subclasses if needed
     */
    protected stateMachineBeforeReturn(): void {
        // Override in subclasses
    }

    /**
     * Global/default state - override in subclasses
     */
    protected abstract stateGlobal(token: string): boolean | void;

    /**
     * Helper: Read tokens inside matching brackets, then transition to end state
     * This simulates Lizard's @read_inside_brackets_then decorator
     */
    protected readInsideBrackets(
        openBracket: string,
        closeBracket: string,
        endState: StateHandler,
        processor?: (token: string) => void
    ): StateHandler {
        return (token: string): boolean | void => {
            if (token === openBracket) {
                this.bracketCount++;
            } else if (token === closeBracket) {
                this.bracketCount--;
            }

            if (processor) {
                processor(token);
            }

            if (this.bracketCount === 0) {
                this.bracketCount = 0;  // Reset
                this.next(endState);
            }
        };
    }

    /**
     * Helper: Create a bracket reader state
     */
    protected createBracketReader(
        brackets: string,  // e.g., "()" or "{}" or "<>"
        endStateName: string,
        processor?: (token: string) => void
    ): StateHandler {
        const [open, close] = brackets.split('');
        const endState = (this as any)[endStateName].bind(this);
        return this.readInsideBrackets(open, close, endState, processor);
    }
}
