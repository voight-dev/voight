/**
 * Core types for complexity analysis
 * Based on Lizard's data structures
 */

/**
 * Represents a function's complexity metrics
 */
export interface FunctionInfo {
    /** Function name (unqualified) */
    name: string;

    /** Full function signature */
    longName: string;

    /** Starting line number */
    startLine: number;

    /** Ending line number */
    endLine: number;

    /** Cyclomatic Complexity Number (CCN) */
    cyclomaticComplexity: number;

    /** Number of tokens in function */
    tokenCount: number;

    /** Lines of code (excluding comments and blanks) */
    nloc: number;

    /** Number of parameters */
    parameterCount: number;

    /** Maximum nesting depth */
    maxNestingDepth: number;
}

/**
 * File-level complexity information
 */
export interface FileComplexityInfo {
    /** File path */
    filename: string;

    /** Total lines of code */
    nloc: number;

    /** List of functions found */
    functionList: FunctionInfo[];

    /** Total token count */
    tokenCount: number;

    /** Average CCN across all functions */
    averageCCN: number;
}

/**
 * Supported languages for complexity analysis
 */
export enum Language {
    TypeScript = 'typescript',
    JavaScript = 'javascript',
    Go = 'go',
    Python = 'python'
}

/**
 * Complexity score result (1-10 scale)
 */
export interface ComplexityScore {
    /** Overall score from 1-10 */
    score: number;

    /** Raw CCN value */
    ccn: number;

    /** Lines of code */
    nloc: number;

    /** Number of functions detected */
    functionCount: number;

    /** Breakdown by contributing factors */
    breakdown: {
        ccnScore: number;
        sizeScore: number;
    };
}
