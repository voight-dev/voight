/**
 * Repository interface for persisting code segments
 *
 * Segments are the complete detected blocks with all metadata, state, and user notes.
 * This allows segments to survive extension reloads and provides a single source of truth.
 */

import { SegmentState } from '../ui/highlighter';

/**
 * Persisted representation of a code segment
 *
 * Note: Runtime segment IDs (block_1_123456) are NOT persisted.
 * Segments are keyed by filePath + startLine + endLine (stable identity).
 * Runtime IDs are regenerated on each load.
 */
export interface PersistedSegment {
    // Identity (stable across reloads)
    filePath: string;           // Full file path
    startLine: number;          // Start line (0-indexed)
    endLine: number;            // End line (0-indexed)

    // State
    state: SegmentState;        // DETECTED, REVIEWED, FLAGGED, ACCEPTED, DISMISSED

    // User content (Temporal Anchors)
    contextNote?: string;       // User's description in their own words
    tags?: string[];            // Optional categorization tags

    // Timestamps
    detectedAt: string;         // ISO timestamp of first detection
    lastModified: string;       // ISO timestamp of last update
    reviewedAt?: string;        // ISO timestamp when marked as reviewed

    // Detection metadata (from complexity analysis, etc.)
    metadata?: Record<string, any>;  // Complexity scores, code snapshot, etc.
}

/**
 * Repository interface for segment persistence
 *
 * Implementations:
 * - VscodeSegmentRepository: Local storage using VSCode workspace state
 * - RemoteSegmentRepository: Cloud/database storage (future)
 */
export interface ISegmentRepository {
    /**
     * Initialize repository (connect to storage, load data)
     */
    initialize(): Promise<void>;

    /**
     * Save or update a segment
     * If segment exists (same filePath + line range), it will be updated
     */
    save(segment: PersistedSegment): Promise<void>;

    /**
     * Get a specific segment by location
     */
    get(filePath: string, startLine: number, endLine: number): Promise<PersistedSegment | undefined>;

    /**
     * Check if a segment exists
     */
    has(filePath: string, startLine: number, endLine: number): Promise<boolean>;

    /**
     * Delete a segment
     * Returns true if deleted, false if didn't exist
     */
    delete(filePath: string, startLine: number, endLine: number): Promise<boolean>;

    /**
     * Get all segments for a specific file
     * Returns segments ordered by startLine
     */
    getByFile(filePath: string): Promise<PersistedSegment[]>;

    /**
     * Get all segments with a specific state
     */
    getByState(state: SegmentState): Promise<PersistedSegment[]>;

    /**
     * Get all segments across all files
     */
    getAll(): Promise<PersistedSegment[]>;

    /**
     * Delete all segments (reset state)
     */
    clearAll(): Promise<void>;

    /**
     * Export all segments (for backup/migration)
     */
    export(): Promise<Record<string, any>>;

    /**
     * Import segments (for restore/migration)
     */
    import(data: Record<string, any>): Promise<void>;
}
