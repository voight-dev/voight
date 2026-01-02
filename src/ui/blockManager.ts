import * as vscode from 'vscode';
import { Highlighter, HighlightSegment, SegmentState } from './highlighter';
import { Logger } from '../utils/logger';
import { ISegmentRepository, PersistedSegment } from '../storage/ISegmentRepository';
import { FileTrackingService } from '../tracking/fileTracker';

/**
 * Manages the lifecycle of detected code blocks
 * Acts as a bridge between detection backend and UI layer
 *
 * Now includes persistence: segments are saved to repository and loaded on startup
 */
export class BlockManager {
    private _blockIdCounter = 0;
    private _onBlockRegisteredCallbacks: Array<() => void> = [];
    private _segmentRepository: ISegmentRepository;
    private _fileTrackingService?: FileTrackingService;

    constructor(
        public readonly highlighter: Highlighter,
        segmentRepository: ISegmentRepository,
        fileTrackingService?: FileTrackingService
    ) {
        this._segmentRepository = segmentRepository;
        this._fileTrackingService = fileTrackingService;
        Logger.debug('BlockManager initialized with segment repository');

        // Load persisted segments asynchronously
        this._loadPersistedSegments().catch(error => {
            Logger.error(`Failed to load persisted segments: ${error}`);
        });
    }

    /**
     * Load all persisted segments and add them to highlighter
     * This restores segments from previous sessions
     */
    private async _loadPersistedSegments(): Promise<void> {
        try {
            const allSegments = await this._segmentRepository.getAll();

            for (const persisted of allSegments) {
                // Generate runtime ID for this session
                const runtimeId = this._generateBlockId();

                // Convert PersistedSegment to HighlightSegment
                const segment: HighlightSegment = {
                    id: runtimeId,
                    filePath: persisted.filePath,
                    startLine: persisted.startLine,
                    endLine: persisted.endLine,
                    state: persisted.state,
                    metadata: {
                        ...persisted.metadata,
                        contextNote: persisted.contextNote,
                        tags: persisted.tags,
                        detectedAt: persisted.detectedAt,
                        reviewedAt: persisted.reviewedAt,
                        lastModified: persisted.lastModified
                    }
                };

                // Add to highlighter (will apply decorations if file is open)
                this.highlighter.addSegment(segment);
            }

            if (allSegments.length > 0) {
                Logger.debug(`Loaded ${allSegments.length} persisted segments from ${new Set(allSegments.map(s => s.filePath)).size} files`);

                // Notify callbacks that segments were loaded
                this._onBlockRegisteredCallbacks.forEach(callback => callback());
            }
        } catch (error) {
            Logger.error(`Failed to load persisted segments: ${error}`);
        }
    }

    /**
     * Register a callback to be called when a new block is registered
     */
    public onBlockRegistered(callback: () => void): void {
        this._onBlockRegisteredCallbacks.push(callback);
    }

    /**
     * Get a specific block by ID
     */
    public getBlock(blockId: string): HighlightSegment | undefined {
        return this.highlighter.getSegment(blockId);
    }

    /**
     * Get all blocks
     */
    public getAllBlocks(): HighlightSegment[] {
        return [
            ...this.highlighter.getSegmentsByState(SegmentState.DETECTED),
            ...this.highlighter.getSegmentsByState(SegmentState.REVIEWED),
            ...this.highlighter.getSegmentsByState(SegmentState.FLAGGED),
            ...this.highlighter.getSegmentsByState(SegmentState.ACCEPTED),
            ...this.highlighter.getSegmentsByState(SegmentState.DISMISSED)
        ];
    }

    /**
     * Register a detected block from the backend
     * Returns the generated block ID
     * Now persists the segment to storage and tracks the edit
     *
     * Includes deduplication: if a segment with the same file path and line range
     * already exists, returns the existing segment ID instead of creating a duplicate
     */
    public registerDetectedBlock(
        filePath: string,
        startLine: number,
        endLine: number,
        metadata?: Record<string, any>
    ): string {
        // Check for existing segment with same file path and line range
        const existingSegment = this._findDuplicateSegment(filePath, startLine, endLine);

        if (existingSegment) {
            Logger.warn(`Duplicate segment detected: ${filePath}:${startLine}-${endLine} (existing: ${existingSegment.id})`);
            Logger.debug(`Skipping duplicate - using existing segment ${existingSegment.id}`);
            return existingSegment.id;
        }

        const blockId = this._generateBlockId();

        const block: HighlightSegment = {
            id: blockId,
            filePath,
            startLine,
            endLine,
            state: SegmentState.DETECTED,
            metadata: {
                detectedAt: new Date().toISOString(),
                ...metadata
            }
        };

        this.highlighter.addSegment(block);
        Logger.debug(`Registered block ${blockId}: ${filePath}:${startLine}-${endLine}`);

        // Persist segment
        this._persistSegment(block).catch(error => {
            Logger.error(`Failed to persist segment: ${error}`);
        });

        // Track this edit in the file tracking service
        if (this._fileTrackingService) {
            this._fileTrackingService.recordEdit(
                filePath,
                startLine,
                endLine,
                metadata?.complexityScore
            ).catch(error => {
                Logger.error(`Failed to track file edit: ${error}`);
            });
        }

        // Notify callbacks
        this._onBlockRegisteredCallbacks.forEach(callback => callback());

        return blockId;
    }

    /**
     * Find a duplicate segment with the same file path and line range
     * Returns the existing segment if found, undefined otherwise
     */
    private _findDuplicateSegment(
        filePath: string,
        startLine: number,
        endLine: number
    ): HighlightSegment | undefined {
        const allSegments = this.getAllBlocks();

        return allSegments.find(segment =>
            segment.filePath === filePath &&
            segment.startLine === startLine &&
            segment.endLine === endLine
        );
    }

    /**
     * Mark a block as reviewed
     * Persists the state change
     */
    public markAsReviewed(blockId: string): void {
        this.highlighter.updateSegmentState(blockId, SegmentState.REVIEWED);

        const segment = this.highlighter.getSegment(blockId);
        if (segment) {
            this._persistSegment(segment, { reviewedAt: new Date().toISOString() }).catch((error: Error) => {
                Logger.error(`Failed to persist reviewed state: ${error}`);
            });
        }
    }

    /**
     * Mark a block as flagged for attention
     * Persists the state change
     */
    public markAsFlagged(blockId: string): void {
        this.highlighter.updateSegmentState(blockId, SegmentState.FLAGGED);

        const segment = this.highlighter.getSegment(blockId);
        if (segment) {
            this._persistSegment(segment).catch((error: Error) => {
                Logger.error(`Failed to persist flagged state: ${error}`);
            });
        }
    }

    /**
     * Mark a block as accepted
     * Persists the state change
     */
    public markAsAccepted(blockId: string): void {
        this.highlighter.updateSegmentState(blockId, SegmentState.ACCEPTED);

        const segment = this.highlighter.getSegment(blockId);
        if (segment) {
            this._persistSegment(segment).catch((error: Error) => {
                Logger.error(`Failed to persist accepted state: ${error}`);
            });
        }
    }

    /**
     * Dismiss a block (user doesn't care)
     * Persists the state change
     */
    public dismiss(blockId: string): void {
        this.highlighter.updateSegmentState(blockId, SegmentState.DISMISSED);

        const segment = this.highlighter.getSegment(blockId);
        if (segment) {
            this._persistSegment(segment).catch((error: Error) => {
                Logger.error(`Failed to persist dismissed state: ${error}`);
            });
        }
    }

    /**
     * Remove a block entirely
     * Deletes from both highlighter and repository
     * @param blockId - The ID of the block to remove
     * @param notifyCallbacks - If true, notify registered callbacks to update UI (default: false)
     */
    public remove(blockId: string, notifyCallbacks: boolean = false): void {
        const segment = this.highlighter.getSegment(blockId);
        this.highlighter.removeSegment(blockId);

        if (segment) {
            this._segmentRepository.delete(segment.filePath, segment.startLine, segment.endLine).catch((error: Error) => {
                Logger.error(`Failed to delete segment from repository: ${error}`);
            });
        }

        // Notify callbacks to update UI if requested
        if (notifyCallbacks) {
            this._onBlockRegisteredCallbacks.forEach(callback => callback());
        }
    }

    /**
     * Remove all segments for a specific file
     * Used when a file is deleted from disk
     */
    public removeSegmentsForFile(filePath: string): void {
        const segments = this.highlighter.getSegmentsForFile(filePath);

        if (segments.length === 0) {
            Logger.debug(`No segments found for deleted file: ${filePath}`);
            return;
        }

        Logger.debug(`Removing ${segments.length} segments for deleted file: ${filePath}`);

        // Remove each segment
        segments.forEach(segment => {
            this.highlighter.removeSegment(segment.id);
            this._segmentRepository.delete(segment.filePath, segment.startLine, segment.endLine).catch((error: Error) => {
                Logger.error(`Failed to delete segment from repository: ${error}`);
            });
        });

        Logger.debug(`Successfully removed all segments for deleted file: ${filePath}`);

        // Notify callbacks to update UI
        this._onBlockRegisteredCallbacks.forEach(callback => callback());
    }

    /**
     * Get all blocks for current file
     */
    public getCurrentFileBlocks(): HighlightSegment[] {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return [];
        }

        return this.highlighter.getSegmentsForFile(activeEditor.document.fileName);
    }

    /**
     * Get all segments for a specific file path
     */
    public getSegmentsForFile(filePath: string): HighlightSegment[] {
        return this.highlighter.getSegmentsForFile(filePath);
    }

    /**
     * Get statistics about blocks
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
     * Clear all blocks (reset state)
     * Clears both in-memory and persisted segments
     */
    public clearAll(): void {
        this.highlighter.clearAll();

        this._segmentRepository.clearAll().catch((error: Error) => {
            Logger.error(`Failed to clear segments from repository: ${error}`);
        });

        Logger.debug('Cleared all blocks');
    }

    /**
     * Execute actions on a block
     */
    public async executeActions(blockId: string): Promise<void> {
        await this.highlighter.executeActions(blockId);
    }

    /**
     * Update context note for a segment
     * This updates both the in-memory segment and persists to repository
     */
    public async updateContextNote(
        filePath: string,
        startLine: number,
        endLine: number,
        note: string,
        tags?: string[]
    ): Promise<void> {
        // Find the segment in highlighter (by location, not ID)
        const allSegments = this.getAllBlocks();
        const segment = allSegments.find(
            s => s.filePath === filePath && s.startLine === startLine && s.endLine === endLine
        );

        if (segment) {
            // Update in-memory metadata
            if (!segment.metadata) {
                segment.metadata = {};
            }
            segment.metadata.contextNote = note;
            segment.metadata.tags = tags;

            // Persist to repository
            await this._persistSegment(segment);
            Logger.debug(`Updated context note for segment: ${filePath}:${startLine}-${endLine}`);
        } else {
            Logger.warn(`Cannot update context note: segment not found at ${filePath}:${startLine}-${endLine}`);
        }
    }

    /**
     * Get context note for a segment by location
     */
    public getContextNote(
        filePath: string,
        startLine: number,
        endLine: number
    ): { note?: string; tags?: string[] } | undefined {
        const allSegments = this.getAllBlocks();
        const segment = allSegments.find(
            s => s.filePath === filePath && s.startLine === startLine && s.endLine === endLine
        );

        if (segment?.metadata) {
            return {
                note: segment.metadata.contextNote,
                tags: segment.metadata.tags
            };
        }

        return undefined;
    }

    /**
     * Convert HighlightSegment to PersistedSegment and save to repository
     */
    private async _persistSegment(
        segment: HighlightSegment,
        additionalFields?: { reviewedAt?: string }
    ): Promise<void> {
        const persisted: PersistedSegment = {
            filePath: segment.filePath,
            startLine: segment.startLine,
            endLine: segment.endLine,
            state: segment.state,
            contextNote: segment.metadata?.contextNote,
            tags: segment.metadata?.tags,
            detectedAt: segment.metadata?.detectedAt || new Date().toISOString(),
            lastModified: new Date().toISOString(),
            reviewedAt: additionalFields?.reviewedAt || segment.metadata?.reviewedAt,
            metadata: segment.metadata
        };

        await this._segmentRepository.save(persisted);
    }

    private _generateBlockId(): string {
        return `block_${++this._blockIdCounter}_${Date.now()}`;
    }
}

