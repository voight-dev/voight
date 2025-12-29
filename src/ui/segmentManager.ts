import * as vscode from 'vscode';
import { Highlighter, HighlightSegment, SegmentState } from './highlighter';
import { Logger } from '../utils/logger';

/**
 * Manages the lifecycle of detected code segments
 * Acts as a bridge between detection backend and UI layer
 */
export class SegmentManager {
    private _segmentIdCounter = 0;
    private _onSegmentRegisteredCallbacks: Array<() => void> = [];

    constructor(public readonly highlighter: Highlighter) {
        Logger.debug('SegmentManager initialized');
    }

    /**
     * Register a callback to be called when a new segment is registered
     */
    public onSegmentRegistered(callback: () => void): void {
        this._onSegmentRegisteredCallbacks.push(callback);
    }

    /**
     * Get a specific segment by ID
     */
    public getSegment(segmentId: string): HighlightSegment | undefined {
        return this.highlighter.getSegment(segmentId);
    }

    /**
     * Get all segments
     */
    public getAllSegments(): HighlightSegment[] {
        return [
            ...this.highlighter.getSegmentsByState(SegmentState.DETECTED),
            ...this.highlighter.getSegmentsByState(SegmentState.REVIEWED),
            ...this.highlighter.getSegmentsByState(SegmentState.FLAGGED),
            ...this.highlighter.getSegmentsByState(SegmentState.ACCEPTED),
            ...this.highlighter.getSegmentsByState(SegmentState.DISMISSED)
        ];
    }

    /**
     * Register a detected segment from the backend
     * Returns the generated segment ID
     */
    public registerDetectedSegment(
        filePath: string,
        startLine: number,
        endLine: number,
        metadata?: Record<string, any>
    ): string {
        const segmentId = this._generateSegmentId();

        const segment: HighlightSegment = {
            id: segmentId,
            filePath,
            startLine,
            endLine,
            state: SegmentState.DETECTED,
            metadata: {
                detectedAt: new Date().toISOString(),
                ...metadata
            }
        };

        this.highlighter.addSegment(segment);
        Logger.debug(`Registered segment ${segmentId}: ${filePath}:${startLine}-${endLine}`);

        // Notify callbacks
        this._onSegmentRegisteredCallbacks.forEach(callback => callback());

        return segmentId;
    }

    /**
     * Mark a segment as reviewed
     */
    public markAsReviewed(segmentId: string): void {
        this.highlighter.updateSegmentState(segmentId, SegmentState.REVIEWED);
    }

    /**
     * Mark a segment as flagged for attention
     */
    public markAsFlagged(segmentId: string): void {
        this.highlighter.updateSegmentState(segmentId, SegmentState.FLAGGED);
    }

    /**
     * Mark a segment as accepted
     */
    public markAsAccepted(segmentId: string): void {
        this.highlighter.updateSegmentState(segmentId, SegmentState.ACCEPTED);
    }

    /**
     * Dismiss a segment (user doesn't care)
     */
    public dismiss(segmentId: string): void {
        this.highlighter.updateSegmentState(segmentId, SegmentState.DISMISSED);
    }

    /**
     * Remove a segment entirely
     */
    public remove(segmentId: string): void {
        this.highlighter.removeSegment(segmentId);
    }

    /**
     * Get all segments for current file
     */
    public getCurrentFileSegments(): HighlightSegment[] {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return [];
        }

        return this.highlighter.getSegmentsForFile(activeEditor.document.fileName);
    }

    /**
     * Get statistics about segments
     */
    public getStats(): {
        total: number;
        detected: number;
        reviewed: number;
        flagged: number;
        accepted: number;
        dismissed: number;
    } {
        return {
            total: this.highlighter.getSegmentsByState(SegmentState.DETECTED).length +
                   this.highlighter.getSegmentsByState(SegmentState.REVIEWED).length +
                   this.highlighter.getSegmentsByState(SegmentState.FLAGGED).length +
                   this.highlighter.getSegmentsByState(SegmentState.ACCEPTED).length +
                   this.highlighter.getSegmentsByState(SegmentState.DISMISSED).length,
            detected: this.highlighter.getSegmentsByState(SegmentState.DETECTED).length,
            reviewed: this.highlighter.getSegmentsByState(SegmentState.REVIEWED).length,
            flagged: this.highlighter.getSegmentsByState(SegmentState.FLAGGED).length,
            accepted: this.highlighter.getSegmentsByState(SegmentState.ACCEPTED).length,
            dismissed: this.highlighter.getSegmentsByState(SegmentState.DISMISSED).length
        };
    }

    /**
     * Clear all segments (reset state)
     */
    public clearAll(): void {
        this.highlighter.clearAll();
        Logger.debug('Cleared all segments');
    }

    /**
     * Execute actions on a segment
     */
    public async executeActions(segmentId: string): Promise<void> {
        await this.highlighter.executeActions(segmentId);
    }

    private _generateSegmentId(): string {
        return `segment_${++this._segmentIdCounter}_${Date.now()}`;
    }
}
