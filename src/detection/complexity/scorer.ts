/**
 * Complexity Scorer
 * Maps raw complexity metrics (CCN, NLOC) to a normalized 1-10 score
 *
 * Based on industry standards:
 * - CCN 1-5: Low risk (simple code)
 * - CCN 6-10: Moderate risk (review recommended)
 * - CCN 11-15: High risk (should be reviewed)
 * - CCN 16+: Very high risk (requires attention)
 */

import { ComplexityAnalyzer, AnalysisResult } from './analyzer';
import { ComplexityScore } from './types';

/**
 * Scoring thresholds and weights
 */
const SCORING_CONFIG = {
    /** CCN thresholds */
    ccn: {
        low: 5,       // CCN <= 5: simple
        moderate: 10, // CCN 6-10: moderate
        high: 15,     // CCN 11-15: high
        veryHigh: 20  // CCN 16-20: very high
                      // CCN > 20: critical
    },

    /** NLOC (lines of code) thresholds */
    nloc: {
        small: 20,    // <= 20 lines: small
        medium: 50,   // 21-50 lines: medium
        large: 100,   // 51-100 lines: large
        veryLarge: 200 // > 200 lines: very large
    },

    /** Scoring weights */
    weights: {
        ccn: 0.7,     // CCN is primary indicator (70%)
        size: 0.3     // Code size is secondary (30%)
    }
};

/**
 * Complexity Scorer
 *
 * Converts raw complexity metrics into actionable scores:
 * - Score 1-3: Low complexity, likely doesn't need review
 * - Score 4-6: Medium complexity, quick review recommended
 * - Score 7-8: High complexity, thorough review needed
 * - Score 9-10: Very high complexity, requires careful attention
 */
export class ComplexityScorer {
    /**
     * Score a code segment's complexity on 1-10 scale
     *
     * @param sourceCode - Code to analyze
     * @param filename - File name for language detection
     * @returns Complexity score with breakdown
     */
    static scoreCode(sourceCode: string, filename: string): ComplexityScore {
        // Analyze the code
        const analyzer = ComplexityAnalyzer.forFile(filename);
        const analysis = analyzer.analyze(sourceCode);

        return this.scoreAnalysis(analysis);
    }

    /**
     * Score based on existing analysis results
     */
    static scoreAnalysis(analysis: AnalysisResult): ComplexityScore {
        const ccnScore = this.scoreCCN(analysis.totalCCN);
        const sizeScore = this.scoreSize(analysis.nloc);

        // Weighted combination
        const score = Math.round(
            ccnScore * SCORING_CONFIG.weights.ccn +
            sizeScore * SCORING_CONFIG.weights.size
        );

        // Ensure score is within 1-10 range
        const finalScore = Math.max(1, Math.min(10, score));

        return {
            score: finalScore,
            ccn: analysis.totalCCN,
            nloc: analysis.nloc,
            functionCount: analysis.functions.length,
            breakdown: {
                ccnScore,
                sizeScore
            }
        };
    }

    /**
     * Map CCN to 1-10 score
     *
     * Based on research and industry standards:
     * - CCN 1-5: Simple code with linear flow
     * - CCN 6-10: Moderate branching, manageable
     * - CCN 11-15: Complex logic, harder to test
     * - CCN 16-20: Very complex, high bug risk
     * - CCN 21+: Critical complexity, refactoring recommended
     */
    private static scoreCCN(ccn: number): number {
        if (ccn <= SCORING_CONFIG.ccn.low) {
            // CCN 1-5: Score 1-3
            // Linear mapping: CCN 1 -> 1, CCN 5 -> 3
            return Math.ceil((ccn / SCORING_CONFIG.ccn.low) * 3);
        }

        if (ccn <= SCORING_CONFIG.ccn.moderate) {
            // CCN 6-10: Score 4-6
            const range = SCORING_CONFIG.ccn.moderate - SCORING_CONFIG.ccn.low;
            const position = ccn - SCORING_CONFIG.ccn.low;
            return 4 + Math.floor((position / range) * 2);
        }

        if (ccn <= SCORING_CONFIG.ccn.high) {
            // CCN 11-15: Score 7-8
            const range = SCORING_CONFIG.ccn.high - SCORING_CONFIG.ccn.moderate;
            const position = ccn - SCORING_CONFIG.ccn.moderate;
            return 7 + Math.floor((position / range) * 1);
        }

        if (ccn <= SCORING_CONFIG.ccn.veryHigh) {
            // CCN 16-20: Score 9
            return 9;
        }

        // CCN 21+: Score 10
        return 10;
    }

    /**
     * Map code size (NLOC) to 1-10 score
     *
     * Larger code segments are harder to review and more likely to contain issues
     */
    private static scoreSize(nloc: number): number {
        if (nloc <= SCORING_CONFIG.nloc.small) {
            // <= 20 lines: Score 1-2
            return Math.ceil((nloc / SCORING_CONFIG.nloc.small) * 2);
        }

        if (nloc <= SCORING_CONFIG.nloc.medium) {
            // 21-50 lines: Score 3-5
            const range = SCORING_CONFIG.nloc.medium - SCORING_CONFIG.nloc.small;
            const position = nloc - SCORING_CONFIG.nloc.small;
            return 3 + Math.floor((position / range) * 2);
        }

        if (nloc <= SCORING_CONFIG.nloc.large) {
            // 51-100 lines: Score 6-8
            const range = SCORING_CONFIG.nloc.large - SCORING_CONFIG.nloc.medium;
            const position = nloc - SCORING_CONFIG.nloc.medium;
            return 6 + Math.floor((position / range) * 2);
        }

        if (nloc <= SCORING_CONFIG.nloc.veryLarge) {
            // 101-200 lines: Score 9
            return 9;
        }

        // > 200 lines: Score 10
        return 10;
    }

    /**
     * Get human-readable complexity level
     */
    static getComplexityLevel(score: number): string {
        if (score <= 3) return 'Low';
        if (score <= 6) return 'Medium';
        if (score <= 8) return 'High';
        return 'Very High';
    }

    /**
     * Determine if segment should be shown to user
     * Based on configurable threshold
     */
    static shouldShowSegment(score: number, threshold: number = 5): boolean {
        return score >= threshold;
    }

    /**
     * Get scoring configuration (for testing/debugging)
     */
    static getConfig() {
        return SCORING_CONFIG;
    }
}
