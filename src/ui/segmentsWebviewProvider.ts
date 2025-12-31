/**
 * SegmentsWebviewProvider - Webview for Voight sidebar
 * Shows segments list with collapsible cards using the new UI components
 */

import * as vscode from 'vscode';
import { BlockManager } from './blockManager';
import { HighlightSegment, SegmentState } from './highlighter';
import { ContextNotesManager } from './contextNotes';
import { AIProviderFactory } from '../ai/providerFactory';
import { Logger } from '../utils/logger';
import { FileRegistry } from '../tracking/fileRegistry';

export class SegmentsWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'voight.segmentsView';
    private _view?: vscode.WebviewView;
    private _lastViewedFilePath?: string; // Persist which file's segments we're showing

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _blockManager: BlockManager,
        private readonly _contextNotesManager: ContextNotesManager,
        private readonly _fileRegistry: FileRegistry
    ) {
        // Listen for block changes and refresh view
        if (_blockManager.onBlockRegistered) {
            _blockManager.onBlockRegistered(() => {
                this._updateSegments();
                this._updateBadge();
            });
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        Logger.debug('[SegmentsWebviewProvider] resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview-ui'),
                vscode.Uri.joinPath(this._extensionUri, 'dist')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        Logger.debug('[SegmentsWebviewProvider] Webview HTML set, setting up message handler');

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'goToCode':
                    // Navigate to the code location
                    const block = this._blockManager.getBlock(message.segmentId);
                    if (block) {
                        const document = await vscode.workspace.openTextDocument(block.filePath);
                        const editor = await vscode.window.showTextDocument(document);

                        // Select the entire segment range (like manual mouse selection)
                        const startLine = block.startLine;
                        const endLine = block.endLine;
                        const startPos = new vscode.Position(startLine, 0);
                        const endPos = new vscode.Position(endLine, document.lineAt(endLine).text.length);

                        // Create selection from start to end
                        editor.selection = new vscode.Selection(startPos, endPos);

                        // Center the view on the selection
                        editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
                    }
                    break;

                case 'saveContext':
                    // Save context for a segment
                    if (message.segmentId && message.context !== undefined) {
                        const block = this._blockManager.getBlock(message.segmentId);
                        if (block) {
                            // Update block metadata with context
                            if (!block.metadata) {
                                block.metadata = {};
                            }
                            block.metadata.context = message.context;

                            // Persist the context note using BlockManager
                            await this._blockManager.updateContextNote(
                                block.filePath,
                                block.startLine,
                                block.endLine,
                                message.context
                            );

                            // Update badge after context action
                            this._updateBadge();

                            // Send confirmation back to webview without re-rendering
                            if (this._view) {
                                this._view.webview.postMessage({
                                    command: 'contextSaved',
                                    segmentId: message.segmentId,
                                    context: message.context
                                });
                            }
                        }
                    }
                    break;

                case 'explainSegment':
                    if (message.segmentId) {
                        await this._handleExplainSegment(message.segmentId);
                    }
                    break;

                case 'dismissSegment':
                    if (message.segmentId) {
                        const block = this._blockManager.getBlock(message.segmentId);
                        if (block) {
                            // Check if segment has star or context - preserve if yes
                            const hasContext = block.metadata?.context && block.metadata.context.trim().length > 0;
                            const isStarred = block.metadata?.isStarred === true;

                            if (hasContext || isStarred) {
                                // Mark as reviewed but keep the segment
                                this._blockManager.markAsReviewed(message.segmentId);
                                Logger.debug(`Segment ${message.segmentId} marked as reviewed but preserved (starred: ${isStarred}, has context: ${hasContext})`);
                            } else {
                                // No star or context - remove completely
                                this._blockManager.remove(message.segmentId);
                                Logger.debug(`Segment ${message.segmentId} removed completely`);
                            }
                        }
                        // Update badge in real-time after dismissal
                        this._updateBadge();
                        // Don't call _updateSegments() here - frontend handles UI removal
                    }
                    break;

                case 'removeSegment':
                    // Force remove segment completely, regardless of star or context
                    if (message.segmentId) {
                        this._blockManager.remove(message.segmentId);
                        // Update badge in real-time after removal
                        this._updateBadge();
                        // Don't call _updateSegments() here - frontend handles UI removal
                    }
                    break;

                case 'toggleStar':
                    if (message.segmentId && typeof message.isStarred === 'boolean') {
                        const block = this._blockManager.getBlock(message.segmentId);
                        if (block) {
                            if (!block.metadata) {
                                block.metadata = {};
                            }
                            block.metadata.isStarred = message.isStarred;
                            // Persist the change
                            await this._blockManager.updateContextNote(
                                block.filePath,
                                block.startLine,
                                block.endLine,
                                block.metadata.contextNote || '',
                                block.metadata.tags
                            );
                            // Update badge after star action
                            this._updateBadge();
                        }
                    }
                    break;

                case 'refresh':
                    Logger.debug('[SegmentsWebviewProvider] Received refresh command');
                    this._updateSegments();
                    this._updateBadge();
                    break;

                case 'openFile':
                    if (message.filePath) {
                        Logger.debug(`[SegmentsWebviewProvider] Opening file: ${message.filePath}`);
                        const uri = vscode.Uri.file(message.filePath);
                        await vscode.window.showTextDocument(uri);
                        // Set this as the last viewed file so segments persist
                        this._lastViewedFilePath = message.filePath;
                    }
                    break;

                case 'goToSegment':
                    if (message.filePath && message.startLine !== undefined && message.endLine !== undefined) {
                        Logger.debug(`[SegmentsWebviewProvider] Navigating to segment: ${message.filePath}:${message.startLine}-${message.endLine}`);
                        const uri = vscode.Uri.file(message.filePath);
                        const document = await vscode.workspace.openTextDocument(uri);
                        const editor = await vscode.window.showTextDocument(document);

                        // Create range for the segment (convert from 1-based to 0-based)
                        const startLine = message.startLine - 1;
                        const endLine = message.endLine - 1;
                        const range = new vscode.Range(startLine, 0, endLine, 999);

                        // Set selection and reveal with InCenter for perfect positioning
                        editor.selection = new vscode.Selection(range.start, range.end);
                        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                    break;

                case 'bulkRemoveSegments':
                    if (message.segmentIds && Array.isArray(message.segmentIds)) {
                        Logger.debug(`[SegmentsWebviewProvider] Bulk removing ${message.segmentIds.length} segments`);

                        // Remove all segments
                        for (const segmentId of message.segmentIds) {
                            const block = this._blockManager.getBlock(segmentId);
                            if (block) {
                                // Check if segment has star or context - preserve if yes
                                const hasContext = block.metadata?.context && block.metadata.context.trim().length > 0;
                                const isStarred = block.metadata?.isStarred === true;

                                if (hasContext || isStarred) {
                                    // Mark as reviewed but keep the segment
                                    this._blockManager.markAsReviewed(segmentId);
                                } else {
                                    // No star or context - remove completely
                                    this._blockManager.remove(segmentId);
                                }
                            }
                        }

                        // Update badge after bulk removal
                        this._updateBadge();
                        Logger.info(`[SegmentsWebviewProvider] Bulk removal complete`);
                    }
                    break;
            }
        });

        // Clear badge when view is opened
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._clearBadge();
            }
        });

        // Update segments when active editor changes (user switches files)
        vscode.window.onDidChangeActiveTextEditor(() => {
            Logger.debug('[SegmentsWebviewProvider] Active editor changed, updating segments');
            this._updateSegments();
        });

        // Update highlighted segment when cursor position changes
        vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === vscode.window.activeTextEditor) {
                this._updateHighlightedSegment();
            }
        });

        // Send initial data after a small delay to ensure webview JS is loaded
        // The webview will also request a refresh, but this ensures we populate immediately
        setTimeout(() => {
            Logger.debug('[SegmentsWebviewProvider] Sending initial segments data');
            this._updateSegments();
            this._updateBadge();
        }, 100);
    }

    /**
     * Update the badge count on the Activity Bar icon
     * Shows count of unseen segments (not interacted with yet)
     */
    private _updateBadge() {
        if (!this._view) {
            return;
        }

        // Filter out segments from deleted files
        const allBlocks = this._blockManager.getAllBlocks();
        const blocks = allBlocks.filter(block => this._fileRegistry.isKnown(block.filePath));

        // Count segments that haven't been interacted with yet
        // A segment is "seen" if ANY of these conditions are true:
        // - Reviewed or dismissed
        // - Starred
        // - Has context notes
        // - Has AI explanation
        const unseenCount = blocks.filter((block: HighlightSegment) => {
            // Dismissed or reviewed = seen
            if (block.state === SegmentState.REVIEWED || block.state === SegmentState.DISMISSED) {
                return false;
            }

            // Starred = seen
            if (block.metadata?.isStarred === true) {
                return false;
            }

            // Has context = seen
            if (block.metadata?.context && block.metadata.context.trim().length > 0) {
                return false;
            }

            // Has AI explanation = seen
            if (block.metadata?.explanation && block.metadata.explanation.trim().length > 0) {
                return false;
            }

            // Not interacted with = unseen
            return true;
        }).length;

        if (unseenCount > 0) {
            this._view.badge = {
                tooltip: `${unseenCount} unseen segment${unseenCount !== 1 ? 's' : ''}`,
                value: unseenCount
            };
        } else {
            this._view.badge = undefined;
        }
    }

    /**
     * Clear the badge (called when user opens the view)
     */
    private _clearBadge() {
        if (this._view) {
            this._view.badge = undefined;
        }
    }

    /**
     * Update the highlighted segment based on cursor position
     */
    private _updateHighlightedSegment() {
        if (!this._view) {
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }

        const cursorLine = activeEditor.selection.active.line;
        const filePath = activeEditor.document.fileName;

        // Find which segment contains the cursor
        // Filter out segments from deleted files
        const allBlocks = this._blockManager.getAllBlocks();
        const blocks = allBlocks.filter(block => this._fileRegistry.isKnown(block.filePath));

        const currentSegment = blocks.find(block =>
            block.filePath === filePath &&
            cursorLine >= block.startLine &&
            cursorLine <= block.endLine
        );

        // Send the highlighted segment ID to webview
        this._view.webview.postMessage({
            command: 'highlightSegment',
            segmentId: currentSegment?.id || null
        });
    }

    /**
     * Show file list view when no segments are available for current context
     */
    private _showFileList(blocks: HighlightSegment[]) {
        if (!this._view) {
            return;
        }

        // Filter out segments from deleted files before grouping
        const existingBlocks = blocks.filter(block => this._fileRegistry.isKnown(block.filePath));

        // Group blocks by file and count segments
        const fileMap = new Map<string, { count: number; blocks: HighlightSegment[] }>();

        existingBlocks.forEach(block => {
            if (!fileMap.has(block.filePath)) {
                fileMap.set(block.filePath, { count: 0, blocks: [] });
            }
            const entry = fileMap.get(block.filePath)!;
            entry.count++;
            entry.blocks.push(block);
        });

        // Transform to file list format
        const fileList = Array.from(fileMap.entries()).map(([filePath, data]) => ({
            filePath,
            fileName: this._getFileName(filePath),
            segmentCount: data.count,
            previewName: this._getSegmentName(data.blocks[0])
        }));

        Logger.debug(`[SegmentsWebviewProvider] Showing file list with ${fileList.length} files`);

        this._view.webview.postMessage({
            command: 'showFileList',
            files: fileList
        });
    }

    /**
     * Update segments data in the webview
     */
    private _updateSegments() {
        if (!this._view) {
            Logger.debug('[SegmentsWebviewProvider] Cannot update segments - view not ready');
            return;
        }

        // Get the currently active file
        const activeEditor = vscode.window.activeTextEditor;
        const activeFilePath = activeEditor?.document.fileName;

        // Filter out segments from deleted files
        const allBlocks = this._blockManager.getAllBlocks();
        const blocks = allBlocks.filter(block => this._fileRegistry.isKnown(block.filePath));

        const filteredCount = allBlocks.length - blocks.length;
        if (filteredCount > 0) {
            Logger.debug(`[SegmentsWebviewProvider] Filtered out ${filteredCount} segments from deleted files`);
        }

        Logger.debug(`[SegmentsWebviewProvider] Active file: ${activeFilePath || 'none'}`);
        Logger.debug(`[SegmentsWebviewProvider] Last viewed file: ${this._lastViewedFilePath || 'none'}`);
        Logger.debug(`[SegmentsWebviewProvider] Total blocks (after filtering): ${blocks.length}`);

        // Log all block file paths for debugging
        blocks.forEach(b => {
            Logger.debug(`  Block ${b.id}: ${b.filePath} (lines ${b.startLine}-${b.endLine})`);
        });

        // Determine which file to show segments for
        let fileToShow: string | undefined;

        let shouldShowFileList = false;

        if (activeFilePath) {
            // Check if active file has any segments
            const activeFileHasSegments = blocks.some(block => block.filePath === activeFilePath);

            if (activeFileHasSegments) {
                // Active file has segments, switch to it
                fileToShow = activeFilePath;
                this._lastViewedFilePath = activeFilePath;
                Logger.debug(`[SegmentsWebviewProvider] Active file has segments, switching to it`);
            } else {
                // Active file has no segments - show file list view
                shouldShowFileList = true;
                Logger.debug(`[SegmentsWebviewProvider] Active file has no segments, will show file list view`);
            }
        } else {
            // No active file, keep showing last viewed file if it exists
            fileToShow = this._lastViewedFilePath;
            Logger.debug(`[SegmentsWebviewProvider] No active file, keeping last viewed file`);
        }

        // If we should show file list, do so
        if (shouldShowFileList && blocks.length > 0) {
            Logger.debug('[SegmentsWebviewProvider] Showing file list view');
            this._showFileList(blocks);
            return;
        }

        // If we don't have a file to show yet (first time or no context), initialize it to the first file with segments
        if (!fileToShow && blocks.length > 0) {
            // Get the first file that has segments
            const firstFileWithSegments = blocks[0]?.filePath;
            if (firstFileWithSegments) {
                fileToShow = firstFileWithSegments;
                this._lastViewedFilePath = firstFileWithSegments;
                Logger.debug(`[SegmentsWebviewProvider] No file selected yet, initializing to first file with segments: ${firstFileWithSegments}`);
            }
        }

        // If we still don't have a file to show, show empty state (no segments exist)
        if (!fileToShow) {
            Logger.debug('[SegmentsWebviewProvider] No segments exist, showing empty state');
            this._view.webview.postMessage({
                command: 'updateSegments',
                segments: []
            });
            return;
        }

        // Filter: Show all segments from the file we're displaying, except reviewed/dismissed ones
        // Exception: Always show starred or segments with context notes
        const filteredBlocks = blocks.filter((block: HighlightSegment) => {
            // Only show segments from the file we're displaying
            if (block.filePath !== fileToShow) {
                return false;
            }

            // Check if segment is reviewed or dismissed
            const isReviewedOrDismissed = block.state === SegmentState.REVIEWED || block.state === SegmentState.DISMISSED;

            // Always show if starred or has context (even if reviewed/dismissed)
            const hasContext = block.metadata?.context && block.metadata.context.trim().length > 0;
            const isStarred = block.metadata?.isStarred === true;

            if (isReviewedOrDismissed && !hasContext && !isStarred) {
                return false;
            }

            return true;
        });

        Logger.debug(`[SegmentsWebviewProvider] Showing ${filteredBlocks.length} segments from ${fileToShow}`);

        // If the file we're showing has no segments (all reviewed/dismissed), show file list
        if (filteredBlocks.length === 0 && blocks.length > 0) {
            this._showFileList(blocks);
            return;
        }

        // Build file list for selector - group all blocks by file
        const fileMap = new Map<string, { count: number; blocks: HighlightSegment[] }>();
        blocks.forEach(block => {
            if (!fileMap.has(block.filePath)) {
                fileMap.set(block.filePath, { count: 0, blocks: [] });
            }
            const entry = fileMap.get(block.filePath)!;
            entry.count++;
            entry.blocks.push(block);
        });

        const allFiles = Array.from(fileMap.entries()).map(([filePath, data]) => ({
            filePath,
            fileName: this._getFileName(filePath),
            segmentCount: data.count,
            isActive: filePath === fileToShow // Use fileToShow instead of activeFilePath
        }));

        // Transform blocks into segment data for the webview
        const segments = filteredBlocks.map((block: HighlightSegment) => ({
            id: block.id,
            name: this._getSegmentName(block),
            lineRange: `Lines ${block.startLine + 1}-${block.endLine + 1} (${block.endLine - block.startLine + 1} lines)`, // Add line range and count
            fileName: this._getFileName(block.filePath),
            filePath: block.filePath,
            startLine: block.startLine + 1, // Convert to 1-based
            endLine: block.endLine + 1,
            complexity: this._getComplexity(block),
            state: block.state,
            metadata: block.metadata
        }));

        this._view.webview.postMessage({
            command: 'updateSegments',
            segments,
            files: allFiles,
            currentFile: activeFilePath
        });
    }

    /**
     * Get segment name (function name if available, or code preview)
     */
    private _getSegmentName(block: HighlightSegment): string {
        // Try to get function name from metadata
        if (block.metadata?.functionName) {
            return block.metadata.functionName;
        }

        // Try to get function name from complexity analysis
        if (block.metadata?.complexity && typeof block.metadata.complexity === 'object') {
            const complexityData = block.metadata.complexity as any;
            if (complexityData.name || complexityData.functionName || complexityData.longName) {
                return complexityData.name || complexityData.functionName || complexityData.longName;
            }
        }

        // Try functions array from complexity
        if (block.metadata?.functions && Array.isArray(block.metadata.functions) && block.metadata.functions.length > 0) {
            const firstFunc = block.metadata.functions[0];
            // Skip "(anonymous)" - treat it as if there's no name
            if (firstFunc.name && firstFunc.name !== '(anonymous)') {
                return firstFunc.name;
            }
        }

        // Generate preview from code content
        try {
            const fs = require('fs');
            const content = fs.readFileSync(block.filePath, 'utf8');
            const lines = content.split('\n');

            // Get the first line of the segment that isn't empty
            for (let i = block.startLine; i <= block.endLine && i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && line !== '{' && line !== '}') {
                    // Extract up to 40 chars for preview
                    const preview = line.substring(0, 40);
                    return preview.length < line.length ? `${preview}...` : preview;
                }
            }
        } catch (error) {
            Logger.debug(`Failed to read file for preview: ${error}`);
        }

        // Fallback to line range (shouldn't reach here often)
        return `Lines ${block.startLine + 1}-${block.endLine + 1}`;
    }

    /**
     * Extract file name from path
     */
    private _getFileName(filePath: string): string {
        return filePath.split('/').pop() || filePath;
    }

    /**
     * Get complexity score from metadata
     */
    private _getComplexity(block: HighlightSegment): number | null {
        if (block.metadata?.complexity) {
            if (typeof block.metadata.complexity === 'object' && 'score' in block.metadata.complexity) {
                return block.metadata.complexity.score;
            }
            if (typeof block.metadata.complexity === 'number') {
                return block.metadata.complexity;
            }
        }

        if (typeof block.metadata?.complexityScore === 'number') {
            return block.metadata.complexityScore;
        }

        return null;
    }

    /**
     * Handle explaining a segment with AI
     */
    private async _handleExplainSegment(segmentId: string): Promise<void> {
        const block = this._blockManager.getBlock(segmentId);
        if (!block) {
            Logger.error(`[SegmentsWebviewProvider] Block not found: ${segmentId}`);
            return;
        }

        try {
            // Send loading state
            this._view?.webview.postMessage({
                command: 'explanationLoading',
                segmentId,
                loading: true
            });

            // Get AI provider
            const provider = AIProviderFactory.createProvider();

            // Check if configured
            if (!provider.isConfigured()) {
                // Show a more helpful message with action buttons
                const action = await vscode.window.showErrorMessage(
                    'AI provider not configured. Please add your API key in settings to enable code explanations.',
                    'Open Settings',
                    'View Setup Guide'
                );

                if (action === 'Open Settings') {
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'voight.ai.apiKey');
                } else if (action === 'View Setup Guide') {
                    const guideUri = vscode.Uri.joinPath(this._extensionUri, 'API_SETUP_GUIDE.md');
                    try {
                        await vscode.commands.executeCommand('markdown.showPreview', guideUri);
                    } catch {
                        // Fallback: just open settings if guide doesn't exist
                        await vscode.commands.executeCommand('workbench.action.openSettings', 'voight.ai');
                    }
                }

                throw new Error('API key not configured');
            }

            // Read the code from the document
            const document = await vscode.workspace.openTextDocument(block.filePath);
            const range = new vscode.Range(block.startLine, 0, block.endLine, Number.MAX_VALUE);
            const code = document.getText(range);

            // Detect language from file extension
            const language = this._detectLanguage(block.filePath);

            Logger.info(`[SegmentsWebviewProvider] Explaining segment ${segmentId} (${language})`);

            // Get explanation from AI
            const explanation = await provider.explain(code, language);

            // Store in segment metadata
            if (!block.metadata) {
                block.metadata = {};
            }
            block.metadata.explanation = explanation;
            block.metadata.explainedAt = new Date().toISOString();
            block.metadata.explainedBy = provider.name;

            // Update badge after AI explanation
            this._updateBadge();

            // Send success
            this._view?.webview.postMessage({
                command: 'updateExplanation',
                segmentId,
                explanation
            });

            Logger.info(`[SegmentsWebviewProvider] Explanation generated successfully`);

        } catch (error) {
            Logger.error(`[SegmentsWebviewProvider] Explanation error: ${error}`);
            const errorMessage = error instanceof Error ? error.message : 'Failed to explain code';

            this._view?.webview.postMessage({
                command: 'explanationError',
                segmentId,
                error: errorMessage
            });
        } finally {
            // Clear loading state
            this._view?.webview.postMessage({
                command: 'explanationLoading',
                segmentId,
                loading: false
            });
        }
    }

    /**
     * Detect programming language from file path
     */
    private _detectLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'go': 'go',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'rs': 'rust',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin'
        };
        return langMap[ext || ''] || 'typescript';
    }

    /**
     * Generate HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get URIs for styles
        const stylesUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview-ui', 'styles', 'base', 'index.css')
        );

        // Get URI for segments JavaScript
        const segmentsJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'segments.js')
        );

        // Use VSCode's built-in codicons
        const codiconsUri = 'https://unpkg.com/@vscode/codicons@0.0.35/dist/codicon.css';

        // Marked.js for markdown rendering
        const markedUri = 'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js';

        // Generate nonce for CSP
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; font-src ${webview.cspSource} https://unpkg.com; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${stylesUri}" rel="stylesheet">
    <script nonce="${nonce}" src="${markedUri}"></script>
    <title>Voight Segments</title>
</head>
<body>
    <div class="segments-container">
        <div class="segments-header">
            <h1>Segments</h1>
            <div class="file-selector-container" id="file-selector-container" style="display: none;">
                <select id="file-selector" class="file-selector">
                    <option value="">Select a file...</option>
                </select>
            </div>
            <div class="segments-header-bottom">
                <p id="segment-count" class="segment-count">Loading...</p>
                <div class="header-actions">
                    <button class="bulk-remove-btn" title="Remove all segments">
                        <span class="codicon codicon-trash"></span>
                    </button>
                    <div class="sort-controls">
                        <button class="sort-button active" data-sort="line" title="Sort by line number">
                            <span class="codicon codicon-list-ordered"></span>
                        </button>
                        <button class="sort-button" data-sort="complexity" title="Sort by complexity">
                            <span class="codicon codicon-graph"></span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="bulk-remove-confirm" style="display: none;">
                <div class="bulk-remove-confirm-content">
                    <span class="bulk-remove-confirm-text">Remove all segments?</span>
                    <div class="bulk-remove-confirm-actions">
                        <button class="confirm-bulk-remove-btn">Remove</button>
                        <button class="cancel-bulk-remove-btn">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="segments-list" class="segments-list"></div>
    </div>

    <script nonce="${nonce}" src="${segmentsJsUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
