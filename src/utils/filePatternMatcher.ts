import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Utility for matching files against exclusion patterns
 * Supports both glob patterns and regex
 */
export class FilePatternMatcher {
    private globPatterns: string[] = [];
    private regexPatterns: RegExp[] = [];

    constructor() {
        this.loadPatterns();

        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('voight.detection.excludePatterns')) {
                Logger.debug('[FilePatternMatcher] Exclude patterns changed, reloading...');
                this.loadPatterns();
            }
        });
    }

    /**
     * Load patterns from configuration
     */
    private loadPatterns(): void {
        const config = vscode.workspace.getConfiguration('voight.detection');
        const patterns = config.get<string[]>('excludePatterns', []);

        this.globPatterns = [];
        this.regexPatterns = [];

        for (const pattern of patterns) {
            if (pattern.startsWith('!')) {
                // Regex pattern (starts with !)
                try {
                    // Remove the ! prefix and create regex
                    const regexStr = pattern.substring(1);
                    const regex = new RegExp(regexStr);
                    this.regexPatterns.push(regex);
                    Logger.debug(`[FilePatternMatcher] Loaded regex pattern: ${regexStr}`);
                } catch (error) {
                    Logger.warn(`[FilePatternMatcher] Invalid regex pattern: ${pattern} - ${error}`);
                }
            } else {
                // Glob pattern
                this.globPatterns.push(pattern);
                Logger.debug(`[FilePatternMatcher] Loaded glob pattern: ${pattern}`);
            }
        }

        Logger.info(`[FilePatternMatcher] Loaded ${this.globPatterns.length} glob patterns and ${this.regexPatterns.length} regex patterns`);
    }

    /**
     * Check if a file should be excluded from detection
     */
    public shouldExclude(filePath: string): boolean {
        // Convert to workspace-relative path for glob matching
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let relativePath = filePath;

        if (workspaceFolder) {
            const workspacePath = workspaceFolder.uri.fsPath;
            if (filePath.startsWith(workspacePath)) {
                relativePath = filePath.substring(workspacePath.length + 1);
            }
        }

        // Check glob patterns
        for (const pattern of this.globPatterns) {
            const matcher = new vscode.RelativePattern(
                workspaceFolder?.uri.fsPath || '',
                pattern
            );

            // Use VS Code's built-in glob matching
            if (this.matchGlob(relativePath, pattern)) {
                Logger.debug(`[FilePatternMatcher] File excluded by glob pattern "${pattern}": ${filePath}`);
                return true;
            }
        }

        // Check regex patterns
        for (const regex of this.regexPatterns) {
            if (regex.test(filePath) || regex.test(relativePath)) {
                Logger.debug(`[FilePatternMatcher] File excluded by regex pattern "${regex}": ${filePath}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob matcher for common patterns
     * Supports: *, **, ?, and basic path matching
     */
    private matchGlob(path: string, pattern: string): boolean {
        // Normalize path separators
        path = path.replace(/\\/g, '/');
        pattern = pattern.replace(/\\/g, '/');

        // Convert glob pattern to regex
        let regexPattern = pattern
            // Escape special regex characters except * and ?
            .replace(/[.+^${}()|[\]]/g, '\\$&')
            // ** matches any number of directories
            .replace(/\*\*/g, '⚡') // Temporary placeholder
            // * matches anything except /
            .replace(/\*/g, '[^/]*')
            // ? matches any single character except /
            .replace(/\?/g, '[^/]')
            // Replace placeholder with correct pattern
            .replace(/⚡/g, '.*');

        // Anchor the pattern
        regexPattern = '^' + regexPattern + '$';

        const regex = new RegExp(regexPattern);
        return regex.test(path);
    }
}
