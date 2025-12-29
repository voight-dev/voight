import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { IContextNotesRepository } from '../storage/IContextNotesRepository';
import { VscodeWorkspaceRepository } from '../storage/VscodeWorkspaceRepository';

/**
 * Represents a context note for a code segment
 * This is the "Temporal Anchor" - user's description in their own words
 *
 * Now keyed by file path + line range instead of transient segment IDs
 */
export interface ContextNote {
    // Location-based identity (NEW)
    filePath: string;           // Full file path
    startLine: number;          // Start line (0-indexed)
    endLine: number;            // End line (0-indexed)

    // Content
    note: string;               // User's note text

    // Metadata
    createdAt: string;          // ISO timestamp of creation
    updatedAt: string;          // ISO timestamp of last update
    tags?: string[];            // Optional categorization tags

    // Optional: Backward compatibility
    segmentId?: string;         // Reference to segment (if needed)
}

/**
 * Container for all context notes in a single file
 */
export interface FileContextNotes {
    filePath: string;
    notes: Map<string, ContextNote>;  // Key: "startLine:endLine"
}


/**
 * Manages context notes for detected segments
 * Provides storage and retrieval of user-written descriptions
 *
 * Now stores notes by file path + line range for stability across re-detections
 *
 * Architecture:
 * - Notes are stored as part of segment data in SegmentRepository
 * - This class provides a facade/compatibility layer for the old API
 * - BlockManager handles the actual persistence
 *
 * @deprecated Consider using BlockManager.updateContextNote() directly
 */
export class ContextNotesManager {
    private _repository: IContextNotesRepository;
    private _blockManager?: import('./blockManager').BlockManager;

    /**
     * Create a new ContextNotesManager
     * @param context VSCode extension context
     * @param repository Optional custom repository (defaults to VscodeWorkspaceRepository)
     */
    constructor(
        private _context: vscode.ExtensionContext,
        repository?: IContextNotesRepository
    ) {
        // Use provided repository or default to VSCode workspace storage
        // NOTE: This is kept for backward compatibility, but notes are now stored in segments
        this._repository = repository || new VscodeWorkspaceRepository(_context);

        // Initialize repository (load data)
        this._repository.initialize().catch(error => {
            Logger.error(`Failed to initialize context notes repository: ${error}`);
        });

        // Migrate old notes if needed
        this._migrateOldNotes();
    }

    /**
     * Set the block manager (for delegation)
     * Called from extension.ts after BlockManager is created
     */
    public setBlockManager(blockManager: import('./blockManager').BlockManager): void {
        this._blockManager = blockManager;
    }

    /**
     * Add or update a context note for a segment
     * Now delegates to BlockManager if available
     */
    public setNote(
        filePath: string,
        startLine: number,
        endLine: number,
        noteText: string,
        tags?: string[]
    ): void {
        // If BlockManager is available, delegate to it (notes stored in segments)
        if (this._blockManager) {
            this._blockManager.updateContextNote(filePath, startLine, endLine, noteText, tags).catch(error => {
                Logger.error(`Failed to save context note via BlockManager: ${error}`);
                vscode.window.showErrorMessage('Failed to save context note');
            });
            return;
        }

        // Fallback to old repository (for backward compatibility during migration)
        const now = new Date().toISOString();
        this._repository.get(filePath, startLine, endLine).then(existingNote => {
            const note: ContextNote = {
                filePath,
                startLine,
                endLine,
                note: noteText,
                createdAt: existingNote?.createdAt || now,
                updatedAt: now,
                tags: tags || existingNote?.tags
            };

            this._repository.save(note).catch(error => {
                Logger.error(`Failed to save context note: ${error}`);
                vscode.window.showErrorMessage('Failed to save context note');
            });
        });
    }

    /**
     * Get a context note for a specific segment (synchronous wrapper)
     * Now delegates to BlockManager if available
     */
    public getNote(filePath: string, startLine: number, endLine: number): ContextNote | undefined {
        // If BlockManager is available, get from segment metadata
        if (this._blockManager) {
            const noteData = this._blockManager.getContextNote(filePath, startLine, endLine);
            if (noteData?.note) {
                return {
                    filePath,
                    startLine,
                    endLine,
                    note: noteData.note,
                    tags: noteData.tags,
                    createdAt: '', // Not tracked separately anymore
                    updatedAt: ''  // Not tracked separately anymore
                };
            }
            return undefined;
        }

        // Fallback to old repository (for backward compatibility)
        let result: ContextNote | undefined;
        this._repository.get(filePath, startLine, endLine).then(note => {
            result = note;
        });
        return result;
    }

    /**
     * Get a context note (async version)
     */
    public async getNoteAsync(filePath: string, startLine: number, endLine: number): Promise<ContextNote | undefined> {
        return this._repository.get(filePath, startLine, endLine);
    }

    /**
     * Check if a segment has a note
     */
    public hasNote(filePath: string, startLine: number, endLine: number): boolean {
        let result = false;
        this._repository.has(filePath, startLine, endLine).then(has => {
            result = has;
        });
        return result;
    }

    /**
     * Delete a note
     */
    public deleteNote(filePath: string, startLine: number, endLine: number): boolean {
        let result = false;
        this._repository.delete(filePath, startLine, endLine).then(deleted => {
            result = deleted;
        }).catch(error => {
            Logger.error(`Failed to delete context note: ${error}`);
            vscode.window.showErrorMessage('Failed to delete context note');
        });
        return result;
    }

    /**
     * Get all context notes for a specific file
     */
    public getNotesForFile(filePath: string): ContextNote[] {
        let result: ContextNote[] = [];
        this._repository.getByFile(filePath).then(notes => {
            result = notes;
        });
        return result;
    }

    /**
     * Get all context notes for a file within a line range
     */
    public getNotesForFileInRange(
        filePath: string,
        startLine: number,
        endLine: number
    ): ContextNote[] {
        let result: ContextNote[] = [];
        this._repository.getByFileInRange(filePath, startLine, endLine).then(notes => {
            result = notes;
        });
        return result;
    }

    /**
     * Get all notes across all files
     */
    public getAllNotes(): ContextNote[] {
        let result: ContextNote[] = [];
        this._repository.getAll().then(notes => {
            result = notes;
        });
        return result;
    }

    /**
     * Search notes by text
     */
    public searchNotes(query: string): ContextNote[] {
        let result: ContextNote[] = [];
        this._repository.search(query).then(notes => {
            result = notes;
        });
        return result;
    }

    /**
     * Clear all notes
     */
    public clearAll(): void {
        this._repository.clearAll().catch(error => {
            Logger.error(`Failed to clear context notes: ${error}`);
            vscode.window.showErrorMessage('Failed to clear context notes');
        });
    }

    /**
     * Migrate old segmentId-based notes to file+line based notes
     * This runs once on first load with new storage format
     */
    private _migrateOldNotes(): void {
        const oldStorageKey = 'voight.contextNotes.old';
        const stored = this._context.workspaceState.get<Record<string, any>>('voight.contextNotes');

        if (!stored) { return; }

        // Check if this is old format (flat map of segmentId → note)
        const firstValue = Object.values(stored)[0];
        if (firstValue && 'segmentId' in firstValue && !('filePath' in firstValue)) {
            // Old format detected - needs migration
            Logger.info('Migrating old context notes format...');

            // Back up old notes
            this._context.workspaceState.update(oldStorageKey, stored);

            // Clear old notes - cannot migrate without segment metadata
            this._repository.clearAll().then(() => {
                Logger.warn('Old notes backed up to voight.contextNotes.old. Manual migration needed.');
                vscode.window.showInformationMessage(
                    'Voight: Context notes format updated. Old notes have been backed up.'
                );
            });
        }
    }
}
