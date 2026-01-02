import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ChangeDetector } from './changeDetector';
import { PasteDetector } from './pasteDetector';
import { BlockManager } from '../ui/blockManager';
import { DebugLogger } from '../debug/debugLogger';
import { FilePatternMatcher } from '../utils/filePatternMatcher';
import { FileRegistry } from '../tracking/fileRegistry';
import { StalenessValidator } from './stalenessValidator';
import { hashContent, getContentAtLines } from '../utils/contentHash';

/**
 * Coordinates detection, UI updates, and debug logging
 * This is the main entry point for the detection system
 */
export class DetectionCoordinator {
    private _changeDetector: ChangeDetector;
    private _pasteDetector: PasteDetector;
    private _blockManager?: BlockManager;
    private _debugLogger?: DebugLogger;
    private _filePatternMatcher: FilePatternMatcher;
    private _fileRegistry: FileRegistry;
    private _stalenessValidator?: StalenessValidator;

    constructor(
        fileRegistry: FileRegistry,
        blockManager?: BlockManager,
        debugLogger?: DebugLogger
    ) {
        this._changeDetector = new ChangeDetector();
        this._pasteDetector = new PasteDetector();
        this._blockManager = blockManager;
        this._debugLogger = debugLogger;
        this._filePatternMatcher = new FilePatternMatcher();
        this._fileRegistry = fileRegistry;

        // Initialize staleness validator if block manager is available
        if (blockManager) {
            this._stalenessValidator = new StalenessValidator(blockManager);
        }

        Logger.debug('DetectionCoordinator initialized');
    }

    /**
     * Initialize document tracking
     * Sets up tracking for the document without triggering detection
     */
    public initializeDocument(document: vscode.TextDocument): void {
        if (document.uri.scheme !== 'file') {
            return;
        }

        // Check if file should be excluded (handles dotfiles and patterns)
        if (this._filePatternMatcher.shouldExclude(document.fileName)) {
            Logger.debug(`DetectionCoordinator: File excluded by pattern: ${document.fileName}`);
            return;
        }

        // Check if this is a file that existed at startup
        const isKnownFile = this._fileRegistry.isKnown(document.fileName);

        if (isKnownFile) {
            // File existed at startup - initialize shadow state to current content
            // This prevents treating existing file content as AI-generated
            this._changeDetector.initializeDocument(document);
            Logger.debug(`DetectionCoordinator: Initialized tracking for existing file: ${document.fileName}`);
        } else {
            // File was NOT in workspace at startup - this is a NEW file
            // Process it as AI-generated content
            Logger.debug(`DetectionCoordinator: NEW FILE opened - will process entire content: ${document.fileName}`);
            this.handleNewFileCreated(document);
        }
    }

    /**
     * Analyze a document change event
     * This is the main entry point for processing changes
     */
    public analyzeEvent(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.uri.scheme !== 'file') {
            return;
        }

        const filePath = event.document.fileName;

        // Check if file should be excluded (handles dotfiles and patterns)
        if (this._filePatternMatcher.shouldExclude(filePath)) {
            Logger.debug(`DetectionCoordinator: Change event ignored for excluded file: ${filePath}`);
            return;
        }

        Logger.debug(`\n=== Document Change Event ===`);
        Logger.debug(`File: ${filePath}`);
        Logger.debug(`Total chunks: ${event.contentChanges.length}`);

        // Log details about each change chunk
        event.contentChanges.forEach((change, idx) => {
            const preview = change.text.substring(0, 100).replace(/\n/g, '\\n');
            Logger.debug(`  Chunk ${idx + 1}: ${change.text.length} chars, range: ${change.range.start.line}:${change.range.start.character}-${change.range.end.line}:${change.range.end.character}`);
            Logger.debug(`    Preview: "${preview}${change.text.length > 100 ? '...' : ''}"`);
        });

        // Detect if this is a paste operation
        const isPaste = this._pasteDetector.analyzePasteEvent(event);

        // Record changes for debugging
        if (this._debugLogger) {
            const debugLogger = this._debugLogger;
            event.contentChanges.forEach(change => {
                const detected = this._pasteDetector.isPasted(change);
                debugLogger.recordChange(change, event.document, detected);
            });
        }

        if (!isPaste) {
            Logger.debug(`NOT detected as paste operation - skipping block detection`);

            // For non-paste edits, check for stale segments
            if (this._stalenessValidator && this._blockManager) {
                const changedLines = StalenessValidator.getChangedLines(event.contentChanges);
                if (changedLines.size > 0) {
                    const results = this._stalenessValidator.validateAndCleanup(
                        filePath,
                        event.document,
                        changedLines
                    );
                    const staleCount = results.filter(r => r.isStale).length;
                    if (staleCount > 0) {
                        Logger.debug(`[StalenessValidator] Removed ${staleCount} stale segments`);
                    }
                }
            }

            return;
        }

        Logger.debug('PASTE DETECTED - analyzing changes...');

        // Detect changed blocks
        const blocks = this._changeDetector.detectChanges(event.document);

        if (blocks.length === 0) {
            Logger.debug('No blocks detected');
            return;
        }

        Logger.debug(`Detected ${blocks.length} code blocks`);

        // Get document lines for content hash calculation
        const documentLines = event.document.getText().split('\n');

        // Register with UI
        if (this._blockManager) {
            blocks.forEach((block, idx) => {
                // Calculate content hash for staleness detection
                const contentAtLines = getContentAtLines(documentLines, block.startLine, block.endLine);
                const contentHash = hashContent(contentAtLines);

                const blockId = this._blockManager!.registerDetectedBlock(
                    filePath,
                    block.startLine,
                    block.endLine,
                    {
                        blockNo: idx,
                        detectedAt: block.timestamp,
                        linesChanged: block.endLine - block.startLine + 1,
                        coreChangeStart: block.coreChangeStart,
                        coreChangeEnd: block.coreChangeEnd,
                        expandedContext: block.expandedContext,
                        complexityScore: block.complexityScore,
                        complexityData: block.complexityData,
                        functions: block.functions,
                        beforeCode: block.beforeCode,
                        contentHash: contentHash  // For staleness detection
                    }
                );
                Logger.debug(`  ✓ Registered ${blockId} with UI (hash: ${contentHash})`);
            });
        }

        // Record for debugging
        if (this._debugLogger) {
            this._debugLogger.recordBlocks(blocks, filePath);
        }

        Logger.debug(`=== Event Complete ===\n`);
    }

    /**
     * Validate all persisted segments against current file contents
     * Called at startup to clean up stale segments from previous sessions
     */
    public async validateAllSegments(): Promise<{ validated: number; removed: number }> {
        if (!this._blockManager || !this._stalenessValidator) {
            return { validated: 0, removed: 0 };
        }

        const allSegments = this._blockManager.getAllBlocks();
        if (allSegments.length === 0) {
            return { validated: 0, removed: 0 };
        }

        Logger.debug(`[StalenessValidator] Validating ${allSegments.length} persisted segments at startup...`);

        // Group segments by file
        const segmentsByFile = new Map<string, typeof allSegments>();
        for (const segment of allSegments) {
            const existing = segmentsByFile.get(segment.filePath) || [];
            existing.push(segment);
            segmentsByFile.set(segment.filePath, existing);
        }

        let totalRemoved = 0;

        // Validate each file's segments
        for (const [filePath, _segments] of segmentsByFile) {
            try {
                // Try to open the document
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);

                const results = this._stalenessValidator.validateAndCleanup(
                    filePath,
                    document
                );

                const staleCount = results.filter(r => r.isStale).length;
                totalRemoved += staleCount;
            } catch (error) {
                // File might not exist anymore - remove all segments for it
                Logger.warn(`[StalenessValidator] File not found, removing segments: ${filePath}`);
                this._blockManager.removeSegmentsForFile(filePath);
                totalRemoved += _segments.length;
            }
        }

        if (totalRemoved > 0) {
            Logger.debug(`[StalenessValidator] Startup validation complete: removed ${totalRemoved} stale segments`);
        } else {
            Logger.debug(`[StalenessValidator] Startup validation complete: all segments valid`);
        }

        return { validated: allSegments.length, removed: totalRemoved };
    }

    /**
     * Get debug statistics
     */
    public getStats(): { total: number; pastes: number; types: number } {
        if (this._debugLogger) {
            return this._debugLogger.getStats();
        }
        return { total: 0, pastes: 0, types: 0 };
    }

    /**
     * Save debug data to files
     */
    public saveDebugData(): void {
        if (this._debugLogger) {
            this._debugLogger.saveToFile();
        }
    }

    /**
     * Handle a new file that was created on disk (by AI tools, external processes, etc.)
     * NEW APPROACH: Don't create segments - just track for future edits
     * User should read entire file manually
     */
    public handleNewFileCreated(document: vscode.TextDocument): void {
        const filePath = document.fileName;

        Logger.debug(`\n=== New File Created on Disk ===`);
        Logger.debug(`File: ${filePath}`);
        Logger.debug(`Lines: ${document.lineCount}`);

        // Check if file should be excluded (handles dotfiles and patterns)
        if (this._filePatternMatcher.shouldExclude(filePath)) {
            Logger.debug(`DetectionCoordinator: File excluded by pattern: ${filePath}`);
            return;
        }

        // Check if this is truly a new file
        const isNewFile = !this._fileRegistry.isKnown(filePath);
        if (!isNewFile) {
            Logger.debug(`DetectionCoordinator: File already known, skipping`);
            return;
        }

        Logger.debug(`NEW FILE DETECTED - ${filePath}`);

        // 1. Register as known so future edits are tracked normally
        this._fileRegistry.register(filePath);

        // 2. Initialize shadow state with CURRENT content as baseline
        //    Future edits will diff against this baseline
        this._changeDetector.initializeDocument(document);
        Logger.debug(`Shadow state initialized for new file (baseline = current content)`);

        // 3. DO NOT create segments - let user read entire file
        //    No segments, no UI registration, just tracking setup
        Logger.debug(`No segments created for new file - user should review entire file manually`);
        Logger.debug(`Future edits to this file will be detected normally`);

        // 4. Notify user with action to open file
        const fileName = filePath.split('/').pop() || filePath;
        const lineCount = document.lineCount;
        vscode.window.showInformationMessage(
            `New file created: ${fileName} (${lineCount} line${lineCount !== 1 ? 's' : ''}) - Please review manually`,
            'Open File',
            'Dismiss'
        ).then(selection => {
            if (selection === 'Open File') {
                vscode.window.showTextDocument(document, { preview: false });
            }
        });

        Logger.debug(`=== File Processing Complete ===\n`);
    }

    /**
     * Clear shadow state for a specific file
     * Used when a file is deleted
     */
    public clearFile(filePath: string): void {
        this._changeDetector.clearFile(filePath);
        Logger.debug(`DetectionCoordinator: Cleared shadow state for deleted file: ${filePath}`);
    }

    /**
     * Clear all state
     */
    public clearAll(): void {
        this._changeDetector.clearAll();
    }

    /**
     * Get the change detector instance
     * Used for integrating with metadata manager and garbage collector
     */
    public getChangeDetector(): ChangeDetector {
        return this._changeDetector;
    }
}
