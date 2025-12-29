/**
 * Cyclomatic Complexity Analyzer
 * Ported from Lizard's complexity calculation logic
 *
 * Phase 2: Function-level complexity detection
 * - Uses state machines to detect individual functions
 * - Tracks per-function CCN, NLOC, parameters
 * - Supports Go, TypeScript, Python
 */

import { Tokenizer } from './tokenizer';
import { FunctionInfo, Language } from './types';
import { FunctionContext } from './functionContext';
import { GoStateMachine } from './goStateMachine';
import { TypeScriptStateMachine } from './typeScriptStateMachine';
import { PythonStateMachine } from './pythonStateMachine';
import { StateMachine } from './stateMachine';

/**
 * Language-specific complexity conditions
 * Each language defines which tokens contribute to cyclomatic complexity
 */
interface LanguageConditions {
    /** Control flow keywords (if, for, while, etc.) */
    controlFlow: Set<string>;

    /** Logical operators (&&, ||) */
    logicalOperators: Set<string>;

    /** Case keywords */
    caseKeywords: Set<string>;

    /** Ternary operators */
    ternaryOperators: Set<string>;

    /** Exception handling keywords */
    exceptionHandling: Set<string>;
}

/**
 * Language-specific condition definitions
 * Based on Lizard's language readers
 */
const LANGUAGE_CONDITIONS: Record<Language, LanguageConditions> = {
    [Language.TypeScript]: {
        controlFlow: new Set(['if', 'for', 'while', 'do']),
        logicalOperators: new Set(['&&', '||']),
        caseKeywords: new Set(['case']),
        ternaryOperators: new Set(['?']),
        exceptionHandling: new Set(['catch'])
    },
    [Language.JavaScript]: {
        controlFlow: new Set(['if', 'for', 'while', 'do']),
        logicalOperators: new Set(['&&', '||']),
        caseKeywords: new Set(['case']),
        ternaryOperators: new Set(['?']),
        exceptionHandling: new Set(['catch'])
    },
    [Language.Go]: {
        controlFlow: new Set(['if', 'for', 'range']),
        logicalOperators: new Set(['&&', '||']),
        caseKeywords: new Set(['case']),
        ternaryOperators: new Set([]), // Go doesn't have ternary
        exceptionHandling: new Set([]) // Go uses error returns
    },
    [Language.Python]: {
        controlFlow: new Set(['if', 'for', 'while', 'elif']),
        logicalOperators: new Set(['and', 'or']),
        caseKeywords: new Set(['case']), // Python 3.10+ match/case
        ternaryOperators: new Set([]),
        exceptionHandling: new Set(['except'])
    }
};

/**
 * Result of complexity analysis
 */
export interface AnalysisResult {
    /** Total cyclomatic complexity */
    totalCCN: number;

    /** Lines of code (non-blank, non-comment) */
    nloc: number;

    /** Total token count (excluding comments/whitespace) */
    tokenCount: number;

    /** Number of decision points found */
    decisionPoints: number;

    /** Functions detected (Phase 2 feature - empty for now) */
    functions: FunctionInfo[];
}

/**
 * Cyclomatic Complexity Analyzer
 *
 * Phase 2 Implementation:
 * - Uses state machines to detect individual functions
 * - Tracks per-function CCN, NLOC, parameters
 * - Returns list of functions with complexity metrics
 *
 * Fallback to Phase 1:
 * - If function detection fails, returns aggregate metrics
 */
export class ComplexityAnalyzer {
    private language: Language;
    private conditions: LanguageConditions;
    private filename: string;

    constructor(language: Language, filename: string = 'unknown') {
        this.language = language;
        this.conditions = LANGUAGE_CONDITIONS[language];
        this.filename = filename;
    }

    /**
     * Analyze source code and calculate complexity metrics
     *
     * Phase 2: Function-level detection
     * - Creates state machine for language
     * - Processes tokens through state machine
     * - Extracts per-function complexity metrics
     *
     * @param sourceCode - Code to analyze
     * @returns Analysis results with per-function metrics
     */
    analyze(sourceCode: string): AnalysisResult {
        try {
            // Try Phase 2: function-level detection
            return this.analyzeFunctionLevel(sourceCode);
        } catch (error) {
            console.warn('Function detection failed, falling back to aggregate analysis:', error);
            // Fallback to Phase 1: aggregate analysis
            return this.analyzeAggregate(sourceCode);
        }
    }

    /**
     * Phase 2: Function-level complexity analysis
     */
    private analyzeFunctionLevel(sourceCode: string): AnalysisResult {
        // Create function context
        const context = new FunctionContext(this.filename);

        // Create state machine for language
        const stateMachine = this.createStateMachine(context);

        // Tokenize the code
        const tokens = Tokenizer.generateTokens(sourceCode);

        // Filter to code tokens (excluding comments/whitespace but keep newlines for tracking)
        const codeTokens = Tokenizer.filterCodeTokens(tokens);

        // Process each token through state machine
        let lineNumber = 0;
        for (const token of codeTokens) {
            // Track line numbers (approximate)
            if (token === '\n') {
                lineNumber++;
                context.setLine(lineNumber);
            }

            // Process token
            stateMachine.processToken(token);
        }

        // Finalize any unclosed functions
        const functions = context.finalizeAllFunctions();

        // Calculate totals
        const totalCCN = functions.reduce((sum, fn) => sum + fn.cyclomaticComplexity, 0);
        const nloc = Tokenizer.countNLOC(sourceCode);

        return {
            totalCCN: totalCCN || 1,  // At least 1 if no functions detected
            nloc,
            tokenCount: codeTokens.length,
            decisionPoints: totalCCN - functions.length,  // Approximate
            functions
        };
    }

    /**
     * Phase 1: Aggregate complexity analysis (fallback)
     */
    private analyzeAggregate(sourceCode: string): AnalysisResult {
        // Tokenize the code
        const tokens = Tokenizer.generateTokens(sourceCode);

        // Filter to code tokens only (no comments/whitespace)
        const codeTokens = Tokenizer.filterCodeTokens(tokens);

        // Count decision points
        let decisionPoints = 0;

        for (const token of codeTokens) {
            if (this.isDecisionPoint(token)) {
                decisionPoints++;
            }
        }

        // CCN starts at 1 (every function has baseline complexity of 1)
        const totalCCN = 1 + decisionPoints;

        // Calculate NLOC
        const nloc = Tokenizer.countNLOC(sourceCode);

        return {
            totalCCN,
            nloc,
            tokenCount: codeTokens.length,
            decisionPoints,
            functions: []
        };
    }

    /**
     * Create state machine for language
     */
    private createStateMachine(context: FunctionContext): StateMachine {
        switch (this.language) {
            case Language.Go:
                return new GoStateMachine(context);
            case Language.TypeScript || Language.JavaScript:
                return new TypeScriptStateMachine(context);
            case Language.Python:
                return new PythonStateMachine(context);
            default:
                throw new Error(`Unsupported language: ${this.language}`);
        }
    }

    /**
     * Check if a token is a decision point that increases CCN
     */
    private isDecisionPoint(token: string): boolean {
        return (
            this.conditions.controlFlow.has(token) ||
            this.conditions.logicalOperators.has(token) ||
            this.conditions.caseKeywords.has(token) ||
            this.conditions.ternaryOperators.has(token) ||
            this.conditions.exceptionHandling.has(token)
        );
    }

    /**
     * Get all complexity-contributing tokens for debugging
     */
    getConditionTokens(): string[] {
        return [
            ...this.conditions.controlFlow,
            ...this.conditions.logicalOperators,
            ...this.conditions.caseKeywords,
            ...this.conditions.ternaryOperators,
            ...this.conditions.exceptionHandling
        ];
    }

    /**
     * Create analyzer for specific language based on file extension
     */
    static forFile(filename: string): ComplexityAnalyzer {
        const ext = filename.split('.').pop()?.toLowerCase();

        switch (ext) {
            case 'ts':
            case 'tsx':
                return new ComplexityAnalyzer(Language.TypeScript, filename);

            case 'js':
            case 'jsx':
            case 'mjs':
            case 'cjs':
                return new ComplexityAnalyzer(Language.JavaScript, filename);

            case 'go':
                return new ComplexityAnalyzer(Language.Go, filename);

            case 'py':
                return new ComplexityAnalyzer(Language.Python, filename);

            default:
                // Default to TypeScript for unknown extensions
                return new ComplexityAnalyzer(Language.TypeScript, filename);
        }
    }
}
