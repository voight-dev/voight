import { Logger } from '../utils/logger';
import { ChangeDetector } from '../detection/changeDetector';
import { ShadowMetadataManager } from './shadowMetadataManager';

/**
 * Garbage collector for shadow states
 * Runs periodically to remove inactive shadows and free memory
 */
export class ShadowGarbageCollector {
    private _changeDetector: ChangeDetector;
    private _metadataManager: ShadowMetadataManager;
    private _intervalHandle?: NodeJS.Timeout;

    // Configuration
    private readonly GC_INTERVAL_MS = 30 * 60 * 1000;      // Run every 30 minutes
    private readonly RETENTION_PERIOD_MS = 30 * 60 * 1000; // Keep shadows for 30 minutes after last edit

    constructor(
        changeDetector: ChangeDetector,
        metadataManager: ShadowMetadataManager
    ) {
        this._changeDetector = changeDetector;
        this._metadataManager = metadataManager;
        Logger.debug('ShadowGarbageCollector initialized');
    }

    /**
     * Start the garbage collector
     * Runs cleanup on an interval
     */
    start(): void {
        if (this._intervalHandle) {
            Logger.warn('GC already running');
            return;
        }

        Logger.debug(`Starting GC: interval=${this.GC_INTERVAL_MS / 60000}min, retention=${this.RETENTION_PERIOD_MS / 60000}min`);

        // Run initial GC after a delay to let extension initialize
        setTimeout(() => {
            this._runGarbageCollection();
        }, 60000); // Wait 1 minute after startup

        // Set up periodic GC
        this._intervalHandle = setInterval(() => {
            this._runGarbageCollection();
        }, this.GC_INTERVAL_MS);
    }

    /**
     * Stop the garbage collector
     */
    stop(): void {
        if (this._intervalHandle) {
            clearInterval(this._intervalHandle);
            this._intervalHandle = undefined;
            Logger.debug('GC stopped');
        }
    }

    /**
     * Manually trigger garbage collection
     * Useful for testing or immediate cleanup
     */
    async collect(): Promise<void> {
        await this._runGarbageCollection();
    }

    /**
     * Run garbage collection cycle
     */
    private async _runGarbageCollection(): Promise<void> {
        const startTime = Date.now();
        Logger.debug(`\n=== Garbage Collection Started ===`);
        Logger.debug(`Active shadows before GC: ${this._changeDetector.getShadowCount()}`);
        Logger.debug(`Total memory before GC: ${this._formatBytes(this._changeDetector.getTotalMemoryUsage())}`);

        const now = Date.now();
        let shadowsRemoved = 0;
        let memoryFreed = 0;

        // Get all active metadata
        const activeMetadata = this._metadataManager.getActiveMetadata();

        for (const [filePath, metadata] of activeMetadata.entries()) {
            // Check if shadow actually exists
            if (!this._changeDetector.hasShadow(filePath)) {
                Logger.debug(`Skipping ${filePath} - no shadow exists`);
                continue;
            }

            // Get last edit time
            const lastEditTime = this._metadataManager.getLastEditTime(filePath);

            if (!lastEditTime) {
                // No edits recorded - this shouldn't happen for active metadata
                Logger.warn(`No edit time for active shadow ${filePath} - skipping`);
                continue;
            }

            const timeSinceLastEdit = now - lastEditTime;

            if (timeSinceLastEdit > this.RETENTION_PERIOD_MS) {
                // Remove shadow
                const shadowSize = this._changeDetector.removeShadow(filePath);

                // Mark metadata as removed
                this._metadataManager.markAsRemoved(filePath);

                shadowsRemoved++;
                memoryFreed += shadowSize;

                const inactiveMinutes = Math.round(timeSinceLastEdit / 60000);
                Logger.debug(`✓ Removed shadow for ${filePath} (inactive for ${inactiveMinutes}min, freed ${this._formatBytes(shadowSize)})`);
            } else {
                const remainingMinutes = Math.round((this.RETENTION_PERIOD_MS - timeSinceLastEdit) / 60000);
                Logger.debug(`Keeping ${filePath} (will be eligible for GC in ${remainingMinutes}min)`);
            }
        }

        // Update GC statistics
        this._metadataManager.updateGCStats(shadowsRemoved, memoryFreed);

        // Save metadata to workspace
        await this._metadataManager.saveToWorkspace();

        const duration = Date.now() - startTime;
        Logger.debug(`Active shadows after GC: ${this._changeDetector.getShadowCount()}`);
        Logger.debug(`Total memory after GC: ${this._formatBytes(this._changeDetector.getTotalMemoryUsage())}`);
        Logger.debug(`GC Complete: removed ${shadowsRemoved} shadows, freed ${this._formatBytes(memoryFreed)} in ${duration}ms`);
        Logger.debug(`=== Garbage Collection Complete ===\n`);

        // Log analytics summary
        const analytics = this._metadataManager.getAnalyticsSummary();
        Logger.debug(`Analytics: ${analytics.activeFiles} active, ${analytics.removedFiles} removed, ${analytics.totalLifecycles} total lifecycles`);
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

    /**
     * Get current GC configuration
     */
    getConfig(): {
        intervalMinutes: number;
        retentionMinutes: number;
        isRunning: boolean;
    } {
        return {
            intervalMinutes: this.GC_INTERVAL_MS / 60000,
            retentionMinutes: this.RETENTION_PERIOD_MS / 60000,
            isRunning: this._intervalHandle !== undefined
        };
    }
}
