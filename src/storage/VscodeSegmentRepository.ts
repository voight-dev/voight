/**
 * VSCode Workspace State implementation of segment repository
 * Stores complete segments in VSCode's workspace state (SQLite-backed)
 *
 * Storage structure:
 * {
 *   "hash_of_file_path_1": {
 *     filePath: "/path/to/file.ts",
 *     segments: {
 *       "10:50": { ...PersistedSegment },
 *       "100:150": { ...PersistedSegment }
 *     }
 *   },
 *   "hash_of_file_path_2": { ... }
 * }
 */

import * as vscode from 'vscode';
import { ISegmentRepository, PersistedSegment } from './ISegmentRepository';
import { SegmentState } from '../ui/highlighter';
import { Logger } from '../utils/logger';

/**
 * Helper to generate line range key
 */
function lineRangeKey(startLine: number, endLine: number): string {
    return `${startLine}:${endLine}`;
}

/**
 * Helper to parse line range key
 */
function parseLineRangeKey(key: string): { startLine: number; endLine: number } | null {
    const parts = key.split(':');
    if (parts.length !== 2) {
        return null;
    }
    const startLine = parseInt(parts[0], 10);
    const endLine = parseInt(parts[1], 10);
    if (isNaN(startLine) || isNaN(endLine)) {
        return null;
    }
    return { startLine, endLine };
}

/**
 * Helper to generate file path hash (for storage key)
 */
function filePathHash(filePath: string): string {
    // Simple hash - replace non-alphanumeric with underscore
    return filePath.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Container for segments in a single file
 */
interface FileSegments {
    filePath: string;
    segments: Map<string, PersistedSegment>;  // Key: "startLine:endLine"
}

export class VscodeSegmentRepository implements ISegmentRepository {
    private _segmentsByFile: Map<string, FileSegments> = new Map();
    private readonly _storageKey = 'voight.segments';

    constructor(private _context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        try {
            const stored = this._context.workspaceState.get<Record<string, any>>(this._storageKey);
            if (stored) {
                // Convert plain objects back to nested maps
                for (const fileData of Object.values(stored)) {
                    // Type guard: ensure fileData is valid
                    if (!fileData || typeof fileData !== 'object') {
                        Logger.warn('Skipping invalid file data during segment initialization');
                        continue;
                    }

                    const typedFileData = fileData as { filePath: string; segments: Record<string, PersistedSegment> };

                    // Validate required properties
                    if (!typedFileData.filePath || !typedFileData.segments) {
                        Logger.warn('Skipping file data with missing properties');
                        continue;
                    }

                    const segments = new Map<string, PersistedSegment>();
                    for (const [lineKey, segment] of Object.entries(typedFileData.segments)) {
                        // Validate segment structure
                        if (segment && typeof segment === 'object' && segment.filePath) {
                            segments.set(lineKey, segment as PersistedSegment);
                        }
                    }

                    const fileSegments: FileSegments = {
                        filePath: typedFileData.filePath,
                        segments
                    };

                    this._segmentsByFile.set(typedFileData.filePath, fileSegments);
                }

                const totalSegments = Array.from(this._segmentsByFile.values())
                    .reduce((sum, fs) => sum + fs.segments.size, 0);
                Logger.debug(`Loaded ${totalSegments} persisted segments from ${this._segmentsByFile.size} files`);
            } else {
                Logger.debug('No existing segments found - starting fresh');
            }
        } catch (error) {
            Logger.error(`Failed to load segments: ${error}`);
            // Don't throw - allow extension to continue with empty segments
            this._segmentsByFile.clear();
        }
    }

    async save(segment: PersistedSegment): Promise<void> {
        const lineKey = lineRangeKey(segment.startLine, segment.endLine);

        // Get or create file segments container
        if (!this._segmentsByFile.has(segment.filePath)) {
            this._segmentsByFile.set(segment.filePath, {
                filePath: segment.filePath,
                segments: new Map()
            });
        }

        const fileSegments = this._segmentsByFile.get(segment.filePath)!;
        fileSegments.segments.set(lineKey, segment);

        await this._persist();
        Logger.debug(`Segment saved: ${segment.filePath}:${segment.startLine}-${segment.endLine} [${segment.state}]`);
    }

    async get(filePath: string, startLine: number, endLine: number): Promise<PersistedSegment | undefined> {
        const fileSegments = this._segmentsByFile.get(filePath);
        if (!fileSegments) {
            return undefined;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        return fileSegments.segments.get(lineKey);
    }

    async has(filePath: string, startLine: number, endLine: number): Promise<boolean> {
        const fileSegments = this._segmentsByFile.get(filePath);
        if (!fileSegments) {
            return false;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        return fileSegments.segments.has(lineKey);
    }

    async delete(filePath: string, startLine: number, endLine: number): Promise<boolean> {
        const fileSegments = this._segmentsByFile.get(filePath);
        if (!fileSegments) {
            return false;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        const deleted = fileSegments.segments.delete(lineKey);

        // Clean up empty file containers
        if (fileSegments.segments.size === 0) {
            this._segmentsByFile.delete(filePath);
        }

        if (deleted) {
            await this._persist();
            Logger.debug(`Segment deleted: ${filePath}:${startLine}-${endLine}`);
        }

        return deleted;
    }

    async getByFile(filePath: string): Promise<PersistedSegment[]> {
        const fileSegments = this._segmentsByFile.get(filePath);
        if (!fileSegments) {
            return [];
        }

        // Return segments ordered by startLine
        return Array.from(fileSegments.segments.values())
            .sort((a, b) => a.startLine - b.startLine);
    }

    async getByState(state: SegmentState): Promise<PersistedSegment[]> {
        const segments: PersistedSegment[] = [];

        for (const fileSegments of this._segmentsByFile.values()) {
            for (const segment of fileSegments.segments.values()) {
                if (segment.state === state) {
                    segments.push(segment);
                }
            }
        }

        return segments;
    }

    async getAll(): Promise<PersistedSegment[]> {
        const segments: PersistedSegment[] = [];

        for (const fileSegments of this._segmentsByFile.values()) {
            for (const segment of fileSegments.segments.values()) {
                segments.push(segment);
            }
        }

        // Sort by file path, then by start line
        return segments.sort((a, b) => {
            if (a.filePath !== b.filePath) {
                return a.filePath.localeCompare(b.filePath);
            }
            return a.startLine - b.startLine;
        });
    }

    async clearAll(): Promise<void> {
        this._segmentsByFile.clear();
        await this._persist();
        Logger.debug('Cleared all segments from storage');
    }

    async export(): Promise<Record<string, any>> {
        const allSegments = await this.getAll();

        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            segments: allSegments
        };
    }

    async import(data: Record<string, any>): Promise<void> {
        try {
            if (!data.segments || !Array.isArray(data.segments)) {
                throw new Error('Invalid import data: missing segments array');
            }

            // Clear existing data
            this._segmentsByFile.clear();

            // Import segments
            for (const segment of data.segments) {
                if (segment && typeof segment === 'object' && segment.filePath) {
                    await this.save(segment as PersistedSegment);
                }
            }

            Logger.debug(`Imported ${data.segments.length} segments from backup`);
        } catch (error) {
            Logger.error(`Failed to import segments: ${error}`);
            throw error;
        }
    }

    /**
     * Persist in-memory data to VSCode workspace state
     */
    private async _persist(): Promise<void> {
        try {
            // Convert nested maps to plain objects for JSON serialization
            const storageData: Record<string, any> = {};

            for (const [filePath, fileSegments] of this._segmentsByFile.entries()) {
                const fileHash = filePathHash(filePath);
                storageData[fileHash] = {
                    filePath: fileSegments.filePath,
                    segments: Object.fromEntries(fileSegments.segments.entries())
                };
            }

            await this._context.workspaceState.update(this._storageKey, storageData);
        } catch (error) {
            Logger.error(`Failed to persist segments: ${error}`);
            throw error;
        }
    }
}
