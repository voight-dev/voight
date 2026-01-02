/**
 * VSCode Workspace State implementation of context notes repository
 * Stores notes in VSCode's workspace state (SQLite-backed)
 */

import * as vscode from 'vscode';
import { ContextNote, FileContextNotes } from '../ui/contextNotes';
import { IContextNotesRepository } from './IContextNotesRepository';
import { Logger } from '../utils/logger';

/**
 * Helper to generate line range key
 */
function lineRangeKey(startLine: number, endLine: number): string {
    return `${startLine}:${endLine}`;
}

/**
 * Helper to generate file path hash (for storage key)
 */
function filePathHash(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9]/g, '_');
}

export class VscodeWorkspaceRepository implements IContextNotesRepository {
    private _notesByFile: Map<string, FileContextNotes> = new Map();
    private readonly _storageKey = 'voight.contextNotes';

    constructor(private _context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        try {
            const stored = this._context.workspaceState.get<Record<string, any>>(this._storageKey);
            if (stored) {
                // Convert plain objects back to nested maps
                for (const fileData of Object.values(stored)) {
                    // Type guard: ensure fileData is a valid object with expected properties
                    if (!fileData || typeof fileData !== 'object') {
                        Logger.warn('Skipping invalid file data during initialization');
                        continue;
                    }

                    const typedFileData = fileData as { filePath: string; notes: Record<string, ContextNote> };

                    // Validate required properties
                    if (!typedFileData.filePath || !typedFileData.notes) {
                        Logger.warn('Skipping file data with missing properties');
                        continue;
                    }

                    const fileNotes: FileContextNotes = {
                        filePath: typedFileData.filePath,
                        notes: new Map(Object.entries(typedFileData.notes))
                    };
                    this._notesByFile.set(typedFileData.filePath, fileNotes);
                }

                const totalNotes = Array.from(this._notesByFile.values())
                    .reduce((sum, fn) => sum + fn.notes.size, 0);
                Logger.debug(`Loaded ${totalNotes} context notes from ${this._notesByFile.size} files`);
            } else {
                Logger.debug('No existing context notes found - starting fresh');
            }
        } catch (error) {
            Logger.error(`Failed to load context notes: ${error}`);
            // Don't throw - allow extension to continue with empty notes
            this._notesByFile.clear();
        }
    }

    async save(note: ContextNote): Promise<void> {
        const lineKey = lineRangeKey(note.startLine, note.endLine);

        // Get or create file notes container
        if (!this._notesByFile.has(note.filePath)) {
            this._notesByFile.set(note.filePath, {
                filePath: note.filePath,
                notes: new Map()
            });
        }

        const fileNotes = this._notesByFile.get(note.filePath)!;
        fileNotes.notes.set(lineKey, note);

        await this._persist();
        Logger.debug(`Context note saved for ${note.filePath}:${note.startLine}-${note.endLine}`);
    }

    async get(filePath: string, startLine: number, endLine: number): Promise<ContextNote | undefined> {
        const fileNotes = this._notesByFile.get(filePath);
        if (!fileNotes) {
            return undefined;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        return fileNotes.notes.get(lineKey);
    }

    async has(filePath: string, startLine: number, endLine: number): Promise<boolean> {
        const fileNotes = this._notesByFile.get(filePath);
        if (!fileNotes) {
            return false;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        return fileNotes.notes.has(lineKey);
    }

    async delete(filePath: string, startLine: number, endLine: number): Promise<boolean> {
        const fileNotes = this._notesByFile.get(filePath);
        if (!fileNotes) {
            return false;
        }

        const lineKey = lineRangeKey(startLine, endLine);
        const deleted = fileNotes.notes.delete(lineKey);

        // Clean up empty file containers
        if (fileNotes.notes.size === 0) {
            this._notesByFile.delete(filePath);
        }

        if (deleted) {
            await this._persist();
            Logger.debug(`Context note deleted for ${filePath}:${startLine}-${endLine}`);
        }

        return deleted;
    }

    async getByFile(filePath: string): Promise<ContextNote[]> {
        const fileNotes = this._notesByFile.get(filePath);
        if (!fileNotes) {
            return [];
        }

        return Array.from(fileNotes.notes.values());
    }

    async getByFileInRange(filePath: string, startLine: number, endLine: number): Promise<ContextNote[]> {
        const allNotes = await this.getByFile(filePath);

        // Filter notes that overlap with the requested range
        return allNotes.filter(note => {
            return !(note.endLine < startLine || note.startLine > endLine);
        });
    }

    async getAll(): Promise<ContextNote[]> {
        const allNotes: ContextNote[] = [];
        for (const fileNotes of this._notesByFile.values()) {
            allNotes.push(...Array.from(fileNotes.notes.values()));
        }
        return allNotes;
    }

    async search(query: string): Promise<ContextNote[]> {
        const lowerQuery = query.toLowerCase();
        const allNotes = await this.getAll();

        return allNotes.filter(note =>
            note.note.toLowerCase().includes(lowerQuery) ||
            note.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    async clearAll(): Promise<void> {
        this._notesByFile.clear();
        await this._persist();
        Logger.debug('All context notes cleared');
    }

    async export(): Promise<Record<string, any>> {
        const exportData: Record<string, any> = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            notes: {}
        };

        for (const [filePath, fileNotes] of this._notesByFile.entries()) {
            const fileHash = filePathHash(filePath);
            exportData.notes[fileHash] = {
                filePath: fileNotes.filePath,
                notes: Object.fromEntries(fileNotes.notes.entries())
            };
        }

        return exportData;
    }

    async import(data: Record<string, any>): Promise<void> {
        if (!data.notes) {
            throw new Error('Invalid import data: missing notes field');
        }

        // Clear existing data
        this._notesByFile.clear();

        // Import notes
        for (const fileData of Object.values(data.notes)) {
            const typedFileData = fileData as { filePath: string; notes: Record<string, ContextNote> };
            const fileNotes: FileContextNotes = {
                filePath: typedFileData.filePath,
                notes: new Map(Object.entries(typedFileData.notes))
            };
            this._notesByFile.set(typedFileData.filePath, fileNotes);
        }

        await this._persist();
        Logger.debug(`Imported ${this._notesByFile.size} files with context notes`);
    }

    /**
     * Persist the in-memory state to VSCode workspace storage
     */
    private async _persist(): Promise<void> {
        try {
            // Convert nested maps to plain objects for JSON serialization
            const storageData: Record<string, any> = {};

            for (const [filePath, fileNotes] of this._notesByFile.entries()) {
                const fileHash = filePathHash(filePath);
                storageData[fileHash] = {
                    filePath: fileNotes.filePath,
                    notes: Object.fromEntries(fileNotes.notes.entries())
                };
            }

            await this._context.workspaceState.update(this._storageKey, storageData);
        } catch (error) {
            Logger.error(`Failed to save context notes: ${error}`);
            throw error;
        }
    }
}
