import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ChangeDetector } from './changeDetector';
import { PasteDetector } from './pasteDetector';
import { BlockManager } from '../ui/blockManager';
import { DebugLogger } from '../debug/debugLogger';
import { FilePatternMatcher } from '../utils/filePatternMatcher';

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

    constructor(
        blockManager?: BlockManager,
        debugLogger?: DebugLogger
    ) {
        this._changeDetector = new ChangeDetector();
        this._pasteDetector = new PasteDetector();
        this._blockManager = blockManager;
        this._debugLogger = debugLogger;
        this._filePatternMatcher = new FilePatternMatcher();

        Logger.info('DetectionCoordinator initialized');
    }

    /**
     * Initialize document tracking
     * Sets up tracking for the document without triggering detection
     */
    public initializeDocument(document: vscode.TextDocument): void {
        if (document.uri.scheme !== 'file') {
            return;
        }

        // Check if file should be excluded
        if (this._filePatternMatcher.shouldExclude(document.fileName)) {
            Logger.debug(`DetectionCoordinator: File excluded by pattern: ${document.fileName}`);
            return;
        }

        // Initialize shadow state - this does NOT treat existing content as AI-generated
        this._changeDetector.initializeDocument(document);
        Logger.info(`DetectionCoordinator: Initialized tracking for ${document.fileName}`);
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

        // Check if file should be excluded
        if (this._filePatternMatcher.shouldExclude(filePath)) {
            Logger.debug(`DetectionCoordinator: Change event ignored for excluded file: ${filePath}`);
            return;
        }

        Logger.debug(`\n=== Document Change Event ===`);
        Logger.debug(`File: ${filePath}`);
        Logger.debug(`Total chunks: ${event.contentChanges.length}`);

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
            Logger.debug('Not a paste operation - skipping block detection');
            return;
        }

        Logger.info('Paste detected - analyzing changes...');

        // Detect changed blocks
        const blocks = this._changeDetector.detectChanges(event.document);

        if (blocks.length === 0) {
            Logger.debug('No blocks detected');
            return;
        }

        Logger.info(`Detected ${blocks.length} code blocks`);

        // Register with UI
        if (this._blockManager) {
            blocks.forEach((block, idx) => {
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
                        functions: block.functions
                    }
                );
                Logger.debug(`  ✓ Registered ${blockId} with UI`);
            });
        }

        // Record for debugging
        if (this._debugLogger) {
            this._debugLogger.recordBlocks(blocks, filePath);
        }

        Logger.debug(`=== Event Complete ===\n`);
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
     * Clear all state
     */
    public clearAll(): void {
        this._changeDetector.clearAll();
    }
}
