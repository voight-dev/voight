import * as vscode from 'vscode';

/**
 * Represents tracking data for a single file
 */
export interface FileTrackingData {
    /** Absolute file path */
    filePath: string;
    /** Total number of AI edits detected in this file */
    editCount: number;
    /** First time this file was edited by AI */
    firstEditedAt: string;
    /** Most recent time this file was edited by AI */
    lastEditedAt: string;
    /** Total lines changed across all edits */
    totalLinesChanged: number;
    /** Individual edit records */
    edits: EditRecord[];
}

/**
 * Individual edit record
 */
export interface EditRecord {
    /** ISO timestamp of when edit was detected */
    timestamp: string;
    /** Line range of the edit */
    startLine: number;
    endLine: number;
    /** Number of lines in this edit */
    linesChanged: number;
    /** Complexity score if available */
    complexityScore?: number;
}

/**
 * Ranked file entry for API responses
 */
export interface RankedFile {
    filePath: string;
    rank: number;
    editCount: number;
    totalLinesChanged: number;
    firstEditedAt: string;
    lastEditedAt: string;
}

/**
 * Event data emitted when a file is edited
 */
export interface FileEditEvent {
    filePath: string;
    editCount: number;
    timestamp: string;
    linesChanged: number;
}

/**
 * Service for tracking and ranking files edited by AI
 */
export class FileTrackingService {
    private static readonly STORAGE_KEY = 'voight.fileTracking';
    private readonly context: vscode.ExtensionContext;
    private readonly eventEmitter = new vscode.EventEmitter<FileEditEvent>();

    /** Event fired when a file is edited by AI */
    public readonly onFileEdited: vscode.Event<FileEditEvent> = this.eventEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Record an AI edit for a file
     */
    async recordEdit(
        filePath: string,
        startLine: number,
        endLine: number,
        complexityScore?: number
    ): Promise<void> {
        const trackingData = await this.loadTrackingData();
        const linesChanged = endLine - startLine + 1;
        const timestamp = new Date().toISOString();

        let fileData = trackingData[filePath];

        if (!fileData) {
            // First edit for this file
            fileData = {
                filePath,
                editCount: 0,
                firstEditedAt: timestamp,
                lastEditedAt: timestamp,
                totalLinesChanged: 0,
                edits: []
            };
        }

        // Update tracking data
        fileData.editCount++;
        fileData.lastEditedAt = timestamp;
        fileData.totalLinesChanged += linesChanged;
        fileData.edits.push({
            timestamp,
            startLine,
            endLine,
            linesChanged,
            complexityScore
        });

        trackingData[filePath] = fileData;
        await this.saveTrackingData(trackingData);

        // Emit event for real-time tracking
        this.eventEmitter.fire({
            filePath,
            editCount: fileData.editCount,
            timestamp,
            linesChanged
        });
    }

    /**
     * Get all tracked files ranked by edit count
     */
    async getRankedFiles(): Promise<RankedFile[]> {
        const trackingData = await this.loadTrackingData();
        const files = Object.values(trackingData);

        // Sort by edit count descending
        const sorted = files.sort((a, b) => b.editCount - a.editCount);

        // Map to RankedFile with rank
        return sorted.map((file, index) => ({
            filePath: file.filePath,
            rank: index + 1,
            editCount: file.editCount,
            totalLinesChanged: file.totalLinesChanged,
            firstEditedAt: file.firstEditedAt,
            lastEditedAt: file.lastEditedAt
        }));
    }

    /**
     * Get top N most edited files
     */
    async getTopFiles(limit: number): Promise<RankedFile[]> {
        const ranked = await this.getRankedFiles();
        return ranked.slice(0, limit);
    }

    /**
     * Get tracking data for a specific file
     */
    async getFileData(filePath: string): Promise<FileTrackingData | undefined> {
        const trackingData = await this.loadTrackingData();
        return trackingData[filePath];
    }

    /**
     * Export all tracking data to JSON
     */
    async exportToJson(): Promise<string> {
        const ranked = await this.getRankedFiles();
        return JSON.stringify(ranked, null, 2);
    }

    /**
     * Clear all tracking data
     */
    async clearAll(): Promise<void> {
        await this.context.workspaceState.update(FileTrackingService.STORAGE_KEY, {});
    }

    /**
     * Clear tracking data for a specific file
     */
    async clearFile(filePath: string): Promise<void> {
        const trackingData = await this.loadTrackingData();
        delete trackingData[filePath];
        await this.saveTrackingData(trackingData);
    }

    /**
     * Get statistics about tracked files
     */
    async getStatistics(): Promise<{
        totalFiles: number;
        totalEdits: number;
        totalLinesChanged: number;
        mostEditedFile?: RankedFile;
    }> {
        const trackingData = await this.loadTrackingData();
        const files = Object.values(trackingData);

        const totalFiles = files.length;
        const totalEdits = files.reduce((sum, file) => sum + file.editCount, 0);
        const totalLinesChanged = files.reduce((sum, file) => sum + file.totalLinesChanged, 0);

        const ranked = await this.getRankedFiles();
        const mostEditedFile = ranked.length > 0 ? ranked[0] : undefined;

        return {
            totalFiles,
            totalEdits,
            totalLinesChanged,
            mostEditedFile
        };
    }

    /**
     * Load tracking data from workspace state
     */
    private async loadTrackingData(): Promise<Record<string, FileTrackingData>> {
        const data = this.context.workspaceState.get<Record<string, FileTrackingData>>(
            FileTrackingService.STORAGE_KEY,
            {}
        );
        return data;
    }

    /**
     * Save tracking data to workspace state
     */
    private async saveTrackingData(data: Record<string, FileTrackingData>): Promise<void> {
        await this.context.workspaceState.update(FileTrackingService.STORAGE_KEY, data);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.eventEmitter.dispose();
    }
}
