/**
 * FunctionContext - Tracks function detection and complexity metrics per function
 *
 * Ported from Lizard's FileInfoBuilder pattern
 * - Maintains function stack for nested functions
 * - Tracks current function being analyzed
 * - Isolates CCN tracking per function (not aggregate)
 * - Functions complete in LIFO order
 */

import { FunctionInfo } from './types';

export class FunctionContext {
    private currentFunction: FunctionInfo;
    private stackedFunctions: FunctionInfo[];
    private globalPseudoFunction: FunctionInfo;
    public currentLine: number;
    private completedFunctions: FunctionInfo[];

    constructor(filename: string) {
        // Global pseudo-function to catch code outside functions
        this.globalPseudoFunction = {
            name: '*global*',
            longName: `${filename}::*global*`,
            startLine: 0,
            endLine: 0,
            cyclomaticComplexity: 1,
            nloc: 0,
            tokenCount: 0,
            parameterCount: 0,
            maxNestingDepth: 0
        };

        this.currentFunction = this.globalPseudoFunction;
        this.stackedFunctions = [];
        this.currentLine = 0;
        this.completedFunctions = [];
    }

    /**
     * Start tracking a new function (push to stack)
     * Called when state machine detects function start
     */
    public pushNewFunction(name: string, parameterCount: number = 0): void {
        // Save current function to stack
        this.stackedFunctions.push(this.currentFunction);

        const functionName = name || '(anonymous)';

        // Create new function info
        this.currentFunction = {
            name: functionName,
            longName: functionName,  // Will be updated with full signature by state machine
            startLine: this.currentLine,
            endLine: this.currentLine,
            cyclomaticComplexity: 1,  // Base CCN
            nloc: 0,
            tokenCount: 0,
            parameterCount,
            maxNestingDepth: this.stackedFunctions.length  // Current depth
        };
    }

    /**
     * Complete current function (pop from stack)
     * Called when state machine detects function end
     * Returns completed function for storage
     */
    public endOfFunction(): FunctionInfo {
        const completed = { ...this.currentFunction };
        completed.endLine = this.currentLine;

        // Store completed function
        // Don't store global pseudo-function unless it has actual code
        if (completed.name !== '*global*' || completed.nloc > 0) {
            this.completedFunctions.push(completed);
        }

        // Pop parent function from stack
        if (this.stackedFunctions.length > 0) {
            this.currentFunction = this.stackedFunctions.pop()!;
        } else {
            // Reset to global if no parent
            this.currentFunction = { ...this.globalPseudoFunction };
        }

        return completed;
    }

    /**
     * Add condition/decision point to current function's CCN
     * Called when state machine encounters if/for/while/&&/||/case/etc
     */
    public addCondition(increment: number = 1): void {
        this.currentFunction.cyclomaticComplexity += increment;
    }

    /**
     * Increment non-comment lines of code
     */
    public addNloc(count: number = 1): void {
        this.currentFunction.nloc += count;
    }

    /**
     * Increment token count
     */
    public addToken(): void {
        this.currentFunction.tokenCount++;
    }

    /**
     * Update current line number (for tracking function ranges)
     */
    public setLine(lineNumber: number): void {
        this.currentLine = lineNumber;
    }

    /**
     * Get all completed functions
     */
    public getCompletedFunctions(): FunctionInfo[] {
        return this.completedFunctions;
    }

    /**
     * Get current function being analyzed (for debugging)
     */
    public getCurrentFunction(): FunctionInfo {
        return this.currentFunction;
    }

    /**
     * Get function stack depth (for debugging)
     */
    public getStackDepth(): number {
        return this.stackedFunctions.length;
    }

    /**
     * Force completion of all remaining functions (at end of file)
     */
    public finalizeAllFunctions(): FunctionInfo[] {
        // Complete any unclosed functions (shouldn't happen with valid code)
        while (this.stackedFunctions.length > 0) {
            this.endOfFunction();
        }

        // Complete global function if it has code
        if (this.currentFunction === this.globalPseudoFunction && this.currentFunction.nloc > 0) {
            this.completedFunctions.push({ ...this.currentFunction });
        }

        return this.completedFunctions;
    }

    /**
     * Check if currently inside a function (not global scope)
     */
    public isInFunction(): boolean {
        return this.currentFunction !== this.globalPseudoFunction;
    }

    /**
     * Get nesting level (0 = global, 1 = top-level function, 2 = nested, etc)
     */
    public getNestingLevel(): number {
        return this.stackedFunctions.length;
    }

    /**
     * Add to function name (used during parsing)
     */
    public addToFunctionName(text: string): void {
        this.currentFunction.name += text;
        this.currentFunction.longName += text;
    }

    /**
     * Add to long function name only (e.g., for parameters, receiver)
     */
    public addToLongFunctionName(text: string): void {
        const current = this.currentFunction.longName;
        // Add space if needed between alphanumeric characters
        if (current && /[a-zA-Z0-9]$/.test(current) && /^[a-zA-Z0-9]/.test(text)) {
            this.currentFunction.longName += ' ';
        }
        this.currentFunction.longName += text;
    }

    /**
     * Add parameter to function (updates parameter count and long name)
     */
    public addParameter(token: string): void {
        this.addToLongFunctionName(' ' + token);

        // Count parameters by tracking commas
        if (token === ',') {
            // Comma separates parameters
        } else if (this.currentFunction.parameterCount === 0 && token.trim()) {
            // First parameter
            this.currentFunction.parameterCount = 1;
        }
    }
}
