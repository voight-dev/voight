/**
 * Segment - A view abstraction over AI-generated code segments
 *
 * Philosophy:
 * - Segments are metadata containers for detected code
 * - Support operations: analyze, label, tag, contextualize
 * - Per-file tracking and organization
 * - User-friendly naming strategies
 */

import { HighlightSegment } from './highlighter';
import { FunctionInfo } from '../detection/complexity/types';

/**
 * Naming strategy for segments
 */
export enum SegmentNameStrategy {
    FUNCTION_NAME = 'function',      // Use containing function name (e.g., "createUser")
    LINE_RANGE = 'lines',            // Simple line range (e.g., "Lines 45-67")
    AUTO_SUMMARY = 'auto',           // First significant identifier (e.g., "fetchUser call")
    USER_DEFINED = 'user'            // User provides custom label
}

/**
 * Operations that can be performed on a segment
 */
export type SegmentOperation =
    | 'analyze'           // AI analysis of code quality/security
    | 'add-context'       // Add user context/description
    | 'add-label'         // Add custom label/name
    | 'add-tags'          // Add categorization tags
    | 'mark-reviewed'     // Mark as reviewed
    | 'flag'              // Flag for attention
    | 'accept'            // Accept the code
    | 'dismiss'           // Dismiss/hide
    | 'navigate'          // Jump to code in editor
    | 'show-impact'       // Show call graph/references
    | 'export-note';      // Export context notes

/**
 * Segment metadata structure
 */
export interface Segment {
    // Identity
    id: string;                          // Unique ID
    segmentId: string;                   // Reference to underlying segment

    // Location
    filePath: string;                    // Full file path
    fileName: string;                    // Just filename for display
    startLine: number;                   // Start line (0-indexed)
    endLine: number;                     // End line (0-indexed)

    // Naming
    name: string;                        // Display name for segment
    nameStrategy: SegmentNameStrategy;   // How name was determined
    customLabel?: string;                // User-provided label (if strategy is USER_DEFINED)

    // State
    state: SegmentState;                 // Current state

    // Code metadata
    linesChanged: number;                // Number of lines in segment
    coreChangeStart: number;             // Actual changed lines start
    coreChangeEnd: number;               // Actual changed lines end
    expandedContext: boolean;            // Whether context was expanded

    // User annotations
    context?: string;                    // User's context description
    tags: string[];                      // User-defined tags

    // Function metadata (for naming and tooltips)
    functions?: Array<{
        name: string;
        longName: string;
        startLine: number;
        endLine: number;
    }>;

    // Analysis (optional, populated on-demand)
    analysis?: {
        securityIssues?: string[];
        codeQuality?: string;
        complexity?: number;
        suggestions?: string[];
        analyzedAt?: string;
    };

    // Timestamps
    detectedAt: string;                  // When segment was detected
    lastModifiedAt?: string;             // Last user interaction

    // Display metadata
    collapsed: boolean;                  // For UI collapsible sections
    operations: SegmentOperation[];      // Available operations for this segment
}

/**
 * Segment state - lifecycle tracking
 */
export enum SegmentState {
    NEW = 'new',                    // Just detected, no interaction
    REVIEWING = 'reviewing',        // User is actively reviewing
    REVIEWED = 'reviewed',          // User has reviewed
    FLAGGED = 'flagged',           // Flagged for attention
    ACCEPTED = 'accepted',         // User accepted
    DISMISSED = 'dismissed'        // User dismissed
}

/**
 * Per-file segment organization
 */
export interface FileSegments {
    filePath: string;
    fileName: string;
    segments: Segment[];
    totalSegments: number;
    stats: {
        new: number;
        reviewed: number;
        flagged: number;
        accepted: number;
        dismissed: number;
    };
}

/**
 * Factory for creating segments from highlight segments
 */
export class SegmentFactory {
    /**
     * Create a segment from a highlight segment
     */
    static fromSegment(segment: HighlightSegment, nameStrategy: SegmentNameStrategy = SegmentNameStrategy.FUNCTION_NAME): Segment {
        const fileName = this.extractFileName(segment.filePath);
        const name = this.generateName(segment, nameStrategy);

        return {
            id: segment.id,
            segmentId: segment.id,
            filePath: segment.filePath,
            fileName,
            startLine: segment.startLine,
            endLine: segment.endLine,
            name,
            nameStrategy,
            state: this.mapSegmentStateToSegmentState(segment.state),
            linesChanged: segment.metadata?.linesChanged || (segment.endLine - segment.startLine + 1),
            coreChangeStart: segment.metadata?.coreChangeStart || segment.startLine,
            coreChangeEnd: segment.metadata?.coreChangeEnd || segment.endLine,
            expandedContext: segment.metadata?.expandedContext || false,
            context: segment.metadata?.context, // Include context from metadata
            tags: [],
            functions: segment.metadata?.functions, // Include function metadata for naming and tooltips
            analysis: segment.metadata?.complexityScore ? {
                complexity: segment.metadata.complexityScore,
                // Store additional complexity data in analysis for reference
                ...(segment.metadata.complexityData && {
                    codeQuality: `CCN: ${segment.metadata.complexityData.ccn}, NLOC: ${segment.metadata.complexityData.nloc}`,
                    suggestions: [`Complexity Level: ${segment.metadata.complexityData.level}`]
                })
            } : undefined,
            detectedAt: segment.metadata?.detectedAt || new Date().toISOString(),
            collapsed: false,
            operations: this.getAvailableOperations(segment)
        };
    }

    private static extractFileName(filePath: string): string {
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    private static generateName(segment: HighlightSegment, strategy: SegmentNameStrategy): string {
        // Custom labels always take priority over auto-generated names
        if (segment.metadata?.customLabel) {
            return segment.metadata.customLabel;
        }

        switch (strategy) {
            case SegmentNameStrategy.FUNCTION_NAME:
                return this.generateFunctionName(segment);

            case SegmentNameStrategy.LINE_RANGE:
                return this.generateLineRangeName(segment);

            case SegmentNameStrategy.AUTO_SUMMARY:
                return this.generateAutoSummary(segment);

            case SegmentNameStrategy.USER_DEFINED:
                // Check if user provided a custom label
                return segment.metadata?.customLabel || 'Unnamed Segment';

            default:
                return this.generateLineRangeName(segment);
        }
    }

    /**
     * Generate name from function metadata
     * Priority: Function name → Line range fallback
     */
    private static generateFunctionName(segment: HighlightSegment): string {
        const functions = segment.metadata?.functions as FunctionInfo[] | undefined;

        if (!functions || functions.length === 0) {
            // No functions detected - fall back to line range
            return this.generateLineRangeName(segment);
        }

        if (functions.length === 1) {
            // Single function - use its name
            return functions[0].name;
        }

        // Multiple functions - show first + count
        const firstName = functions[0].name;
        const additionalCount = functions.length - 1;
        return `${firstName} + ${additionalCount} more`;
    }

    /**
     * Extract first significant identifier from code
     * For Phase 1: Simple implementation
     * TODO Phase 2: Enhanced pattern detection
     */
    private static generateAutoSummary(segment: HighlightSegment): string {
        // For now, fall back to line range
        // Phase 2 will implement identifier extraction
        return this.generateLineRangeName(segment);
    }

    private static generateLineRangeName(segment: HighlightSegment): string {
        return `Lines ${segment.startLine + 1}-${segment.endLine + 1}`;
    }

    private static mapSegmentStateToSegmentState(segmentState: string): SegmentState {
        switch (segmentState) {
            case 'detected': return SegmentState.NEW;
            case 'reviewed': return SegmentState.REVIEWED;
            case 'flagged': return SegmentState.FLAGGED;
            case 'accepted': return SegmentState.ACCEPTED;
            case 'dismissed': return SegmentState.DISMISSED;
            default: return SegmentState.NEW;
        }
    }

    private static getAvailableOperations(segment: HighlightSegment): SegmentOperation[] {
        // All segments support these operations
        const baseOps: SegmentOperation[] = [
            'navigate',
            'add-context',
            'add-label',
            'add-tags'
        ];

        // State-dependent operations
        const stateOps: SegmentOperation[] = [];

        if (segment.state === 'detected') {
            stateOps.push('mark-reviewed', 'flag', 'accept', 'dismiss');
        }

        if (segment.state === 'reviewed' || segment.state === 'flagged') {
            stateOps.push('accept', 'dismiss');
        }

        // Future operations (placeholders)
        const futureOps: SegmentOperation[] = [
            'analyze',
            'show-impact',
            'export-note'
        ];

        return [...baseOps, ...stateOps, ...futureOps];
    }
}
