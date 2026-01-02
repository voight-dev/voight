/**
 * Staleness Validator
 * Detects and removes stale segments when file content changes
 *
 * A segment becomes stale when:
 * 1. The lines it references are edited (content mismatch)
 * 2. Lines above it are added/removed (line number shift)
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { BlockManager } from '../ui/blockManager';
import { hashContent, getContentAtLines } from '../utils/contentHash';
import { HighlightSegment } from '../ui/highlighter';

export interface StalenessCheckResult {
    segmentId: string;
    isStale: boolean;
    reason?: 'content_changed' | 'lines_shifted' | 'file_truncated';
}

export class StalenessValidator {
    constructor(private _blockManager: BlockManager) {}

    /**
     * Check all segments for a file and remove stale ones
     * Called when a non-paste edit is detected
     *
     * @param filePath - The file that was edited
     * @param document - The current document state
     * @param changedLines - Set of line numbers that were directly modified
     */
    public validateAndCleanup(
        filePath: string,
        document: vscode.TextDocument,
        changedLines?: Set<number>
    ): StalenessCheckResult[] {
        const segments = this._blockManager.getSegmentsForFile(filePath);

        if (segments.length === 0) {
            return [];
        }

        const documentLines = document.getText().split('\n');
        const results: StalenessCheckResult[] = [];
        const staleSegmentIds: string[] = [];

        for (const segment of segments) {
            const result = this._checkSegmentStaleness(segment, documentLines, changedLines);
            results.push(result);

            if (result.isStale) {
                staleSegmentIds.push(segment.id);
                Logger.debug(`[StalenessValidator] Segment ${segment.id} is stale: ${result.reason}`);
            }
        }

        // Remove stale segments
        if (staleSegmentIds.length > 0) {
            Logger.debug(`[StalenessValidator] Removing ${staleSegmentIds.length} stale segments from ${filePath}`);

            for (const segmentId of staleSegmentIds) {
                // Use notifyCallbacks=true to update UI
                this._blockManager.remove(segmentId, true);
            }
        }

        return results;
    }

    /**
     * Check if a single segment is stale
     */
    private _checkSegmentStaleness(
        segment: HighlightSegment,
        documentLines: string[],
        changedLines?: Set<number>
    ): StalenessCheckResult {
        const { id, startLine, endLine, metadata } = segment;

        // Check if file is now shorter than segment's end line
        if (endLine >= documentLines.length) {
            return {
                segmentId: id,
                isStale: true,
                reason: 'file_truncated'
            };
        }

        // If we know which lines changed, check for overlap
        if (changedLines && changedLines.size > 0) {
            const segmentLines = new Set<number>();
            for (let i = startLine; i <= endLine; i++) {
                segmentLines.add(i);
            }

            // Check if any changed line overlaps with segment
            for (const changedLine of changedLines) {
                if (segmentLines.has(changedLine)) {
                    return {
                        segmentId: id,
                        isStale: true,
                        reason: 'content_changed'
                    };
                }
            }
        }

        // If we have a stored content hash, verify it
        const storedHash = metadata?.contentHash;
        if (storedHash) {
            const currentContent = getContentAtLines(documentLines, startLine, endLine);
            const currentHash = hashContent(currentContent);

            if (currentHash !== storedHash) {
                return {
                    segmentId: id,
                    isStale: true,
                    reason: 'content_changed'
                };
            }
        }

        // Segment is still valid
        return {
            segmentId: id,
            isStale: false
        };
    }

    /**
     * Calculate which lines were affected by a set of text changes
     * Returns a set of line numbers that were directly modified
     */
    public static getChangedLines(
        contentChanges: readonly vscode.TextDocumentContentChangeEvent[]
    ): Set<number> {
        const changedLines = new Set<number>();

        for (const change of contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;

            // Add all lines in the original range
            for (let i = startLine; i <= endLine; i++) {
                changedLines.add(i);
            }

            // If text was inserted, also mark the new lines
            const newLineCount = (change.text.match(/\n/g) || []).length;
            for (let i = 0; i < newLineCount; i++) {
                changedLines.add(startLine + i + 1);
            }
        }

        return changedLines;
    }
}
