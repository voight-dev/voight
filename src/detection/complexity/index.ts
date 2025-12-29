/**
 * Complexity Analysis Module
 *
 * Provides cyclomatic complexity analysis for code segments
 * Based on Lizard's approach with Phase 1 implementation
 *
 * @module complexity
 */

export { Tokenizer } from './tokenizer';
export { ComplexityAnalyzer } from './analyzer';
export { ComplexityScorer } from './scorer';

export type {
    FunctionInfo,
    FileComplexityInfo,
    ComplexityScore
} from './types';

export { Language } from './types';

/**
 * Quick API: Score a code segment
 *
 * @param code - Source code to analyze
 * @param filename - Filename for language detection (e.g., "app.ts", "main.go")
 * @returns Complexity score (1-10) with detailed breakdown
 *
 * @example
 * ```typescript
 * const result = scoreSegment(code, 'myfile.ts');
 * console.log(`Complexity: ${result.score}/10 (CCN: ${result.ccn})`);
 *
 * if (ComplexityScorer.shouldShowSegment(result.score)) {
 *   // Show this segment to user
 * }
 * ```
 */
export function scoreSegment(code: string, filename: string) {
    const { ComplexityScorer } = require('./scorer');
    return ComplexityScorer.scoreCode(code, filename);
}

/**
 * Analyze code and get detailed metrics
 *
 * @param code - Source code to analyze
 * @param filename - Filename for language detection
 * @returns Detailed analysis with CCN, NLOC, token count
 *
 * @example
 * ```typescript
 * const analysis = analyzeCode(code, 'app.py');
 * console.log(`CCN: ${analysis.totalCCN}, NLOC: ${analysis.nloc}`);
 * ```
 */
export function analyzeCode(code: string, filename: string) {
    const { ComplexityAnalyzer } = require('./analyzer');
    const analyzer = ComplexityAnalyzer.forFile(filename);
    return analyzer.analyze(code);
}
