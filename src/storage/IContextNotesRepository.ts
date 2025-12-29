/**
 * Repository interface for context notes storage
 * This abstraction allows swapping storage backends (local, database, cloud, etc.)
 */

import { ContextNote } from '../ui/contextNotes';

/**
 * Abstract repository interface for storing and retrieving context notes
 */
export interface IContextNotesRepository {
    /**
     * Initialize the repository (load data, connect to DB, etc.)
     */
    initialize(): Promise<void>;

    /**
     * Save or update a context note
     */
    save(note: ContextNote): Promise<void>;

    /**
     * Get a specific note by location
     */
    get(filePath: string, startLine: number, endLine: number): Promise<ContextNote | undefined>;

    /**
     * Check if a note exists
     */
    has(filePath: string, startLine: number, endLine: number): Promise<boolean>;

    /**
     * Delete a note
     */
    delete(filePath: string, startLine: number, endLine: number): Promise<boolean>;

    /**
     * Get all notes for a specific file
     */
    getByFile(filePath: string): Promise<ContextNote[]>;

    /**
     * Get all notes for a file within a line range
     */
    getByFileInRange(filePath: string, startLine: number, endLine: number): Promise<ContextNote[]>;

    /**
     * Get all notes across all files
     */
    getAll(): Promise<ContextNote[]>;

    /**
     * Search notes by text query
     */
    search(query: string): Promise<ContextNote[]>;

    /**
     * Clear all notes
     */
    clearAll(): Promise<void>;

    /**
     * Export all notes (for backup/migration)
     */
    export(): Promise<Record<string, any>>;

    /**
     * Import notes (for restore/migration)
     */
    import(data: Record<string, any>): Promise<void>;
}
