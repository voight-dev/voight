/**
 * Shadow State Metadata Tracking
 * Tracks lifecycle, edit patterns, and removal history for shadow states
 */

/**
 * Record of a shadow state removal by garbage collector
 */
export interface RemovalRecord {
    removedAt: number;      // Unix timestamp when removed
    editCount: number;      // Total edits at time of removal
    activeDuration: number; // How long shadow was active (ms)
}

/**
 * Metadata for a shadow state
 * Tracks both active state and historical lifecycle data
 */
export interface ShadowMetadata {
    filePath: string;
    status: 'active' | 'removed';

    // Active tracking (cleared on removal)
    activeEditHistory: Map<number, number>;  // bucketTimestamp -> editCount in that bucket

    // Lifecycle tracking (persists across removals)
    createdAt: number;              // When shadow first created
    totalLifecycles: number;        // How many times shadow was created
    removalHistory: RemovalRecord[]; // History of all removals

    // Analytics fields
    firstEditAt?: number;           // When first edit happened (null if never edited)
    peakEditRate?: number;          // Max edits per hour (for pattern analysis)
    lastShadowSize?: number;        // Size in bytes (for memory analytics)
}

/**
 * Serializable version of metadata for workspace storage
 * Maps are converted to arrays for JSON serialization
 */
export interface SerializedShadowMetadata {
    filePath: string;
    status: 'active' | 'removed';
    activeEditHistory: [number, number][];  // Array of [timestamp, count] tuples
    createdAt: number;
    totalLifecycles: number;
    removalHistory: RemovalRecord[];
    firstEditAt?: number;
    peakEditRate?: number;
    lastShadowSize?: number;
}

/**
 * Statistics about garbage collection runs
 */
export interface GCStats {
    lastRunAt: number;              // When GC last ran
    totalRuns: number;              // Total GC runs
    totalShadowsRemoved: number;    // Total shadows removed across all runs
    totalMemoryFreed: number;       // Estimated total bytes freed
    lastRunStats: {
        shadowsRemoved: number;
        memoryFreed: number;
    };
}
