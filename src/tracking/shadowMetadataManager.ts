import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import {
    ShadowMetadata,
    SerializedShadowMetadata,
    RemovalRecord,
    GCStats
} from './shadowMetadata';

/**
 * Manages metadata for shadow states
 * Handles lifecycle tracking, edit history, and persistence
 */
export class ShadowMetadataManager {
    private _metadata: Map<string, ShadowMetadata> = new Map();
    private _gcStats: GCStats;
    private _workspaceState: vscode.Memento;

    // Configuration
    private readonly EDIT_BUCKET_SIZE_MS = 5 * 60 * 1000;  // 5-minute buckets
    private readonly MAX_REMOVAL_RECORDS = 1000;  // Prevent unbounded growth

    constructor(workspaceState: vscode.Memento) {
        this._workspaceState = workspaceState;
        this._gcStats = {
            lastRunAt: 0,
            totalRuns: 0,
            totalShadowsRemoved: 0,
            totalMemoryFreed: 0,
            lastRunStats: {
                shadowsRemoved: 0,
                memoryFreed: 0
            }
        };
        Logger.info('ShadowMetadataManager initialized');
    }

    /**
     * Load metadata from workspace state
     */
    async loadFromWorkspace(): Promise<void> {
        try {
            const serialized = this._workspaceState.get<Record<string, SerializedShadowMetadata>>('shadowMetadata', {});
            const gcStats = this._workspaceState.get<GCStats>('gcStats');

            // Deserialize metadata
            for (const [filePath, data] of Object.entries(serialized)) {
                this._metadata.set(filePath, this._deserialize(data));
            }

            // Load GC stats
            if (gcStats) {
                this._gcStats = gcStats;
            }

            Logger.info(`Loaded metadata for ${this._metadata.size} files from workspace`);
        } catch (error) {
            Logger.error(`Failed to load metadata: ${error}`);
        }
    }

    /**
     * Save metadata to workspace state
     */
    async saveToWorkspace(): Promise<void> {
        try {
            const serialized: Record<string, SerializedShadowMetadata> = {};

            for (const [filePath, metadata] of this._metadata.entries()) {
                serialized[filePath] = this._serialize(metadata);
            }

            await this._workspaceState.update('shadowMetadata', serialized);
            await this._workspaceState.update('gcStats', this._gcStats);

            Logger.debug(`Saved metadata for ${this._metadata.size} files to workspace`);
        } catch (error) {
            Logger.error(`Failed to save metadata: ${error}`);
        }
    }

    /**
     * Create metadata for a new shadow state
     */
    createMetadata(filePath: string, shadowSize: number): void {
        const existing = this._metadata.get(filePath);
        const now = Date.now();

        if (existing && existing.status === 'removed') {
            // Restart lifecycle for previously removed shadow
            existing.status = 'active';
            existing.totalLifecycles++;
            existing.activeEditHistory.clear();
            existing.lastShadowSize = shadowSize;
            Logger.info(`Restarted lifecycle ${existing.totalLifecycles} for ${filePath}`);
        } else if (!existing) {
            // Create new metadata
            this._metadata.set(filePath, {
                filePath,
                status: 'active',
                activeEditHistory: new Map(),
                createdAt: now,
                totalLifecycles: 1,
                removalHistory: [],
                lastShadowSize: shadowSize
            });
            Logger.debug(`Created metadata for ${filePath}`);
        }
    }

    /**
     * Record an edit for a file
     * Uses bucketed timestamps to prevent unbounded growth
     */
    recordEdit(filePath: string, shadowSize: number): void {
        const metadata = this._metadata.get(filePath);
        if (!metadata || metadata.status !== 'active') {
            Logger.warn(`Cannot record edit for ${filePath} - no active metadata`);
            return;
        }

        const now = Date.now();
        const bucket = this._getBucket(now);

        // Update bucketed edit count
        const currentCount = metadata.activeEditHistory.get(bucket) || 0;
        metadata.activeEditHistory.set(bucket, currentCount + 1);

        // Update analytics
        if (!metadata.firstEditAt) {
            metadata.firstEditAt = now;
        }
        metadata.lastShadowSize = shadowSize;

        // Calculate peak edit rate (edits per hour)
        this._updatePeakEditRate(metadata);

        Logger.debug(`Recorded edit for ${filePath} in bucket ${bucket}`);
    }

    /**
     * Mark shadow as removed and record removal data
     */
    markAsRemoved(filePath: string): void {
        const metadata = this._metadata.get(filePath);
        if (!metadata || metadata.status !== 'active') {
            return;
        }

        const now = Date.now();
        const activeDuration = now - (metadata.firstEditAt || metadata.createdAt);
        const totalEdits = this._getTotalEdits(metadata);

        // Create removal record
        const record: RemovalRecord = {
            removedAt: now,
            editCount: totalEdits,
            activeDuration
        };

        // Add to history (bounded by MAX_REMOVAL_RECORDS)
        metadata.removalHistory.push(record);
        if (metadata.removalHistory.length > this.MAX_REMOVAL_RECORDS) {
            metadata.removalHistory.shift();  // Remove oldest
        }

        // Clear active state
        metadata.status = 'removed';
        metadata.activeEditHistory.clear();
        metadata.firstEditAt = undefined;
        metadata.peakEditRate = undefined;

        Logger.info(`Marked ${filePath} as removed (${totalEdits} edits, ${Math.round(activeDuration / 1000)}s active)`);
    }

    /**
     * Get metadata for a file
     */
    getMetadata(filePath: string): ShadowMetadata | undefined {
        return this._metadata.get(filePath);
    }

    /**
     * Get all active metadata (for GC processing)
     */
    getActiveMetadata(): Map<string, ShadowMetadata> {
        const active = new Map<string, ShadowMetadata>();
        for (const [filePath, metadata] of this._metadata.entries()) {
            if (metadata.status === 'active') {
                active.set(filePath, metadata);
            }
        }
        return active;
    }

    /**
     * Get time of last edit for a file
     */
    getLastEditTime(filePath: string): number | undefined {
        const metadata = this._metadata.get(filePath);
        if (!metadata || metadata.activeEditHistory.size === 0) {
            return undefined;
        }

        // Get most recent bucket timestamp
        const buckets = Array.from(metadata.activeEditHistory.keys());
        return Math.max(...buckets);
    }

    /**
     * Remove metadata for deleted files
     */
    removeMetadata(filePath: string): void {
        this._metadata.delete(filePath);
        Logger.debug(`Removed metadata for deleted file: ${filePath}`);
    }

    /**
     * Update GC statistics
     */
    updateGCStats(shadowsRemoved: number, memoryFreed: number): void {
        this._gcStats.lastRunAt = Date.now();
        this._gcStats.totalRuns++;
        this._gcStats.totalShadowsRemoved += shadowsRemoved;
        this._gcStats.totalMemoryFreed += memoryFreed;
        this._gcStats.lastRunStats = {
            shadowsRemoved,
            memoryFreed
        };

        Logger.info(`GC Stats: Run #${this._gcStats.totalRuns}, removed ${shadowsRemoved} shadows, freed ${this._formatBytes(memoryFreed)}`);
    }

    /**
     * Get GC statistics
     */
    getGCStats(): GCStats {
        return { ...this._gcStats };
    }

    /**
     * Get analytics summary
     */
    getAnalyticsSummary(): {
        totalFiles: number;
        activeFiles: number;
        removedFiles: number;
        totalLifecycles: number;
        avgEditRate: number;
    } {
        let totalLifecycles = 0;
        let totalEditRate = 0;
        let filesWithEditRate = 0;
        let activeCount = 0;
        let removedCount = 0;

        for (const metadata of this._metadata.values()) {
            totalLifecycles += metadata.totalLifecycles;

            if (metadata.status === 'active') {
                activeCount++;
            } else {
                removedCount++;
            }

            if (metadata.peakEditRate) {
                totalEditRate += metadata.peakEditRate;
                filesWithEditRate++;
            }
        }

        return {
            totalFiles: this._metadata.size,
            activeFiles: activeCount,
            removedFiles: removedCount,
            totalLifecycles,
            avgEditRate: filesWithEditRate > 0 ? totalEditRate / filesWithEditRate : 0
        };
    }

    /**
     * Clear all metadata (for testing)
     */
    clear(): void {
        this._metadata.clear();
        Logger.debug('Cleared all metadata');
    }

    // ========== Private Helper Methods ==========

    /**
     * Get bucket timestamp for edit history
     */
    private _getBucket(timestamp: number): number {
        return Math.floor(timestamp / this.EDIT_BUCKET_SIZE_MS) * this.EDIT_BUCKET_SIZE_MS;
    }

    /**
     * Calculate total edits from bucketed history
     */
    private _getTotalEdits(metadata: ShadowMetadata): number {
        let total = 0;
        for (const count of metadata.activeEditHistory.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Update peak edit rate (edits per hour)
     */
    private _updatePeakEditRate(metadata: ShadowMetadata): void {
        if (metadata.activeEditHistory.size === 0) {
            return;
        }

        // Calculate edits in last hour
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        let editsInLastHour = 0;

        for (const [bucket, count] of metadata.activeEditHistory.entries()) {
            if (bucket >= oneHourAgo) {
                editsInLastHour += count;
            }
        }

        // Update peak if current rate is higher
        if (!metadata.peakEditRate || editsInLastHour > metadata.peakEditRate) {
            metadata.peakEditRate = editsInLastHour;
        }
    }

    /**
     * Serialize metadata for storage
     */
    private _serialize(metadata: ShadowMetadata): SerializedShadowMetadata {
        return {
            filePath: metadata.filePath,
            status: metadata.status,
            activeEditHistory: Array.from(metadata.activeEditHistory.entries()),
            createdAt: metadata.createdAt,
            totalLifecycles: metadata.totalLifecycles,
            removalHistory: metadata.removalHistory,
            firstEditAt: metadata.firstEditAt,
            peakEditRate: metadata.peakEditRate,
            lastShadowSize: metadata.lastShadowSize
        };
    }

    /**
     * Deserialize metadata from storage
     */
    private _deserialize(data: SerializedShadowMetadata): ShadowMetadata {
        return {
            filePath: data.filePath,
            status: data.status,
            activeEditHistory: new Map(data.activeEditHistory),
            createdAt: data.createdAt,
            totalLifecycles: data.totalLifecycles,
            removalHistory: data.removalHistory,
            firstEditAt: data.firstEditAt,
            peakEditRate: data.peakEditRate,
            lastShadowSize: data.lastShadowSize
        };
    }

    /**
     * Format bytes for logging
     */
    private _formatBytes(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes}B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)}KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
}
