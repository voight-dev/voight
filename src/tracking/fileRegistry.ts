import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Tracks all files in the workspace to detect newly created files
 * This helps distinguish between existing files and AI-generated new files
 */
export class FileRegistry {
    private _knownFiles: Set<string> = new Set();

    /**
     * Initialize registry with all files currently in the workspace
     */
    async initialize(workspaceRoot: string): Promise<void> {
        Logger.info('FileRegistry: Scanning workspace for existing files...');

        // Find all files in workspace (excluding common ignore patterns)
        const files = await vscode.workspace.findFiles(
            '**/*',
            '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.voight-debug/**}'
        );

        // Add all file paths to known files set
        files.forEach(file => {
            this._knownFiles.add(file.fsPath);
        });

        Logger.info(`FileRegistry: Registered ${this._knownFiles.size} existing files`);
    }

    /**
     * Check if a file is known (existed at startup or was registered)
     */
    isKnown(filePath: string): boolean {
        return this._knownFiles.has(filePath);
    }

    /**
     * Register a file as known (call when a new file is detected and processed)
     */
    register(filePath: string): void {
        if (!this._knownFiles.has(filePath)) {
            Logger.debug(`FileRegistry: Registering new file: ${filePath}`);
            this._knownFiles.add(filePath);
        }
    }

    /**
     * Remove a file from registry (useful if file is deleted)
     */
    unregister(filePath: string): void {
        this._knownFiles.delete(filePath);
        Logger.debug(`FileRegistry: Unregistered file: ${filePath}`);
    }

    /**
     * Get total count of known files
     */
    getCount(): number {
        return this._knownFiles.size;
    }

    /**
     * Clear all tracked files (useful for testing)
     */
    clear(): void {
        this._knownFiles.clear();
        Logger.debug('FileRegistry: Cleared all tracked files');
    }
}
