import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as Diff from 'diff';
import { Logger } from '../utils/logger';
import { BlockManager } from '../ui/blockManager';

/**
 * Minimal paste detection with JSON output
 * Only one job: Is this content pasted? Yes or No.
 */

interface PasteEvent {
    timestamp: string;
    file: string;
    detected: boolean;
    textLength: number;
    completeText: string;
    rangeStart: { line: number; char: number };
    rangeEnd: { line: number; char: number };
    rangeIsEmpty: boolean;
    timeSinceLastChange: number;
    documentVersion: number;
}

interface CodeBlock {
    block_no: number;
    line_number_start: number;
    line_number_end: number;
    code: string;
    timestamp: string;
    file: string;
}

interface DocumentSnapshot {
    lines: string[];
    version: number;
    timestamp: number;
}

export class PasteDebugger {
    private _events: PasteEvent[] = [];
    private _blocks: CodeBlock[] = [];
    private _lastChangeTime: number = 0;
    private _sessionStart: string;
    private _outputPath: string;
    private _solutionPath: string;

    // Shadow document state tracking (I = Initial state)
    private _shadowDocuments: Map<string, DocumentSnapshot> = new Map();

    // Optional UI integration
    private _blockManager?: BlockManager;

    constructor(workspaceRoot: string, blockManager?: BlockManager) {
        this._sessionStart = new Date().toISOString().replace(/[:.]/g, '-');
        this._blockManager = blockManager;

        // Set up output directory immediately
        const debugDir = path.join(workspaceRoot, '.voight-debug');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }

        this._outputPath = path.join(debugDir, `paste-events-${this._sessionStart}.json`);
        this._solutionPath = path.join(debugDir, `solution_${this._sessionStart}.json`);
        Logger.debug(`Will save debug data to: ${this._outputPath}`);
        Logger.debug(`Will save solution to: ${this._solutionPath}`);
    }

    /**
     * Initialize shadow state for a document
     * Call this when a document is first opened to establish baseline
     */
    public initializeDocument(document: vscode.TextDocument): void {
        const filePath = document.fileName;

        // Only initialize if not already tracked
        if (!this._shadowDocuments.has(filePath)) {
            this._updateShadow(document);
            Logger.debug(`Initialized shadow state for ${filePath}`);
        }
    }

    /**
     * Analyze an entire document change event to detect blocks
     */
    public analyzeEvent(event: vscode.TextDocumentChangeEvent): void {
        const filePath = event.document.fileName;
        Logger.debug(`\n=== Document Change Event ===`);
        Logger.debug(`File: ${filePath}`);
        Logger.debug(`Total chunks in event: ${event.contentChanges.length}`);

        // Filter to only paste chunks
        const pasteChunks = event.contentChanges.filter(change => this._isPasted(change));
        Logger.debug(`Paste chunks detected: ${pasteChunks.length}`);

        if (pasteChunks.length === 0) {
            // No paste detected, just record typed events and update shadow
            Logger.debug(`No paste detected, treating as typed changes`);
            event.contentChanges.forEach(change => {
                this._recordChange(change, event.document, false);
            });
            this._updateShadow(event.document);
            return;
        }

        // Record all changes for debugging
        event.contentChanges.forEach(change => {
            const isPaste = this._isPasted(change);
            this._recordChange(change, event.document, isPaste);
        });

        // Get initial state (I) from shadow
        const initialState = this._shadowDocuments.get(filePath);

        if (!initialState) {
            // This shouldn't happen if initializeDocument was called properly
            // But handle it gracefully: treat entire document as the change
            Logger.debug(`⚠️  WARNING: No shadow state for ${filePath}, treating entire document as new`);
            this._updateShadow(event.document);

            // Detect blocks from entire document
            const allLines = new Set<number>();
            for (let i = 0; i < event.document.lineCount; i++) {
                allLines.add(i);
            }
            Logger.debug(`Treating all ${allLines.size} lines as changed`);
            const blocks = this._detectBlocksFromDiff(allLines, event.document);
            Logger.debug(`Created ${blocks.length} blocks from entire document`);
            for (const block of blocks) {
                this._blocks.push(block);
                Logger.debug(`✓ Block ${block.block_no}: lines ${block.line_number_start}-${block.line_number_end}`);
            }
            this._saveSolution();
            return;
        }

        Logger.debug(`Shadow state found: ${initialState.lines.length} lines (version ${initialState.version})`);

        // Get final state (F) from event.document
        const finalState = this._captureDocumentState(event.document);
        Logger.debug(`Final state captured: ${finalState.lines.length} lines (version ${finalState.version})`);

        // Calculate conflict set: C = F - I (what changed)
        const changedLines = this._diffDocuments(initialState, finalState);
        Logger.debug(`Diff complete: ${changedLines.size} lines changed`);

        if (changedLines.size === 0) {
            Logger.debug('⚠️  No changes detected in diff (this is unusual)');
            this._updateShadow(event.document);
            return;
        }

        // Log the changed line numbers for debugging
        const changedLineNumbers = Array.from(changedLines).sort((a, b) => a - b);
        Logger.debug(`Changed lines: ${changedLineNumbers.slice(0, 10).join(', ')}${changedLineNumbers.length > 10 ? '...' : ''}`);

        // Detect blocks from changed lines
        const blocks = this._detectBlocksFromDiff(changedLines, event.document);
        Logger.debug(`Block detection: ${blocks.length} blocks identified`);

        // Save blocks
        for (const block of blocks) {
            this._blocks.push(block);
            Logger.debug(`✓ Block ${block.block_no}: lines ${block.line_number_start}-${block.line_number_end} (${block.line_number_end - block.line_number_start + 1} lines)`);
        }

        // Update shadow to final state for next iteration
        this._updateShadow(event.document);
        Logger.debug(`Shadow state updated for next iteration`);

        // Save solution file
        this._saveSolution();
        Logger.debug(`=== Event Complete ===\n`);
    }

    /**
     * Record a single change for debugging
     */
    private _recordChange(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument,
        detected: boolean
    ): void {
        const now = Date.now();
        const timeDelta = now - this._lastChangeTime;
        this._lastChangeTime = now;

        const event: PasteEvent = {
            timestamp: new Date().toISOString(),
            file: document.fileName,
            detected: detected,
            textLength: change.text.length,
            completeText: change.text,
            rangeStart: {
                line: change.range.start.line,
                char: change.range.start.character
            },
            rangeEnd: {
                line: change.range.end.line,
                char: change.range.end.character
            },
            rangeIsEmpty: change.range.isEmpty,
            timeSinceLastChange: timeDelta,
            documentVersion: document.version
        };

        this._events.push(event);
        this._saveDebug();
    }

    /**
     * Detect if a change is pasted
     */
    private _isPasted(change: vscode.TextDocumentContentChangeEvent): boolean {
        const now = Date.now();
        const timeDelta = now - this._lastChangeTime;
        const textLength = change.text.length;
        const lineCount = (change.text.match(/\n/g) || []).length + 1;

        // Heuristic 1: Large insertion
        if (textLength > 40) {
            return true;
        }

        // Heuristic 2: Multi-line
        if (lineCount > 2) {
            return true;
        }

        // Heuristic 3: Fast medium insertion
        if (textLength >= 10 && timeDelta < 100) {
            return true;
        }

        // Heuristic 4: Fast small insertion
        if (textLength >= 5 && timeDelta < 50) {
            return true;
        }

        // Heuristic 5: Complete statement pattern
        if (this._looksLikeCompleteStatement(change.text) && textLength >= 10) {
            return true;
        }

        return false;
    }

    /**
     * Capture current document state as a snapshot
     */
    private _captureDocumentState(document: vscode.TextDocument): DocumentSnapshot {
        const lines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        return {
            lines,
            version: document.version,
            timestamp: Date.now()
        };
    }

    /**
     * Update shadow document to current state
     */
    private _updateShadow(document: vscode.TextDocument): void {
        const snapshot = this._captureDocumentState(document);
        this._shadowDocuments.set(document.fileName, snapshot);
    }

    /**
     * Diff two document states to find added/modified lines using Myers diff
     * Returns a Set of line numbers that were added or modified
     * This ignores pure moves/shifts and focuses on actual new content
     */
    private _diffDocuments(initial: DocumentSnapshot, final: DocumentSnapshot): Set<number> {
        const changedLines = new Set<number>();

        // Join lines to create text for diff
        const initialText = initial.lines.join('\n');
        const finalText = final.lines.join('\n');

        // Use Myers diff algorithm to get structured changes
        const changes = Diff.diffLines(initialText, finalText);

        Logger.debug(`  → Myers diff: ${changes.length} change chunks`);

        let currentLine = 0; // Track position in final document

        for (const change of changes) {
            const lineCount = change.count || 0;

            if (change.added) {
                // These lines were added - mark them as changed
                Logger.debug(`    Added: ${lineCount} lines at position ${currentLine}`);
                for (let i = 0; i < lineCount; i++) {
                    changedLines.add(currentLine + i);
                }
                currentLine += lineCount;
            } else if (change.removed) {
                // These lines were removed from initial - don't advance currentLine
                Logger.debug(`    Removed: ${lineCount} lines (ignored in final)`);
                // Don't increment currentLine since these don't exist in final
            } else {
                // Unchanged lines - advance position but don't mark as changed
                currentLine += lineCount;
            }
        }

        return changedLines;
    }

    /**
     * Detect blocks from set of changed line numbers
     */
    private _detectBlocksFromDiff(
        changedLines: Set<number>,
        document: vscode.TextDocument
    ): CodeBlock[] {
        if (changedLines.size === 0) {
            return [];
        }

        // Convert Set to sorted array
        const sortedLines = Array.from(changedLines).sort((a, b) => a - b);
        Logger.debug(`  → Grouping ${sortedLines.length} changed lines into ranges...`);

        // Group into contiguous ranges with smarter gap detection
        const ranges: Array<{ start: number; end: number }> = [];
        let rangeStart = sortedLines[0];
        let rangeEnd = sortedLines[0];

        for (let i = 1; i < sortedLines.length; i++) {
            const line = sortedLines[i];
            const gap = line - rangeEnd;

            // Determine if we should extend the current range or start a new one
            // Use adaptive grouping: smaller gaps for closely related lines
            let shouldExtend = false;

            if (gap === 1) {
                // Adjacent lines - always extend
                shouldExtend = true;
            } else if (gap === 2) {
                // One line gap - check if it's just whitespace or a brace
                const gapLine = document.lineAt(rangeEnd + 1).text.trim();
                if (gapLine === '' || gapLine === '{' || gapLine === '}') {
                    shouldExtend = true;
                }
            } else if (gap === 3) {
                // Two line gap - only extend if both are whitespace/braces
                const gap1 = document.lineAt(rangeEnd + 1).text.trim();
                const gap2 = document.lineAt(rangeEnd + 2).text.trim();
                if ((gap1 === '' || gap1 === '{' || gap1 === '}') &&
                    (gap2 === '' || gap2 === '{' || gap2 === '}')) {
                    shouldExtend = true;
                }
            }

            if (shouldExtend) {
                rangeEnd = line;
            } else {
                // Gap is too large or contains non-trivial code - start new range
                ranges.push({ start: rangeStart, end: rangeEnd });
                rangeStart = line;
                rangeEnd = line;
            }
        }

        // Don't forget the last range
        ranges.push({ start: rangeStart, end: rangeEnd });
        Logger.debug(`  → Grouped into ${ranges.length} contiguous ranges`);

        // Expand ranges to semantic boundaries and track original vs expanded
        Logger.debug(`  → Expanding to semantic boundaries...`);
        const rangeMetadata: Array<{ original: { start: number; end: number } }> = [];
        const expandedRanges = ranges.map((range, idx) => {
            const expanded = this._expandToSemanticBoundaries(range, document);
            Logger.debug(`    Range ${idx}: [${range.start}-${range.end}] → [${expanded.start}-${expanded.end}]`);
            rangeMetadata.push({ original: range }); // Store metadata separately
            return expanded;
        });

        // Merge overlapping ranges to prevent duplicates
        const mergedRanges = this._mergeOverlappingRanges(expandedRanges);
        if (mergedRanges.length < expandedRanges.length) {
            Logger.debug(`  → Merged overlapping ranges: ${expandedRanges.length} → ${mergedRanges.length}`);
        }

        // Create CodeBlock objects
        const codeBlocks: CodeBlock[] = [];
        for (let i = 0; i < mergedRanges.length; i++) {
            const range = mergedRanges[i];
            const originalRange = i < rangeMetadata.length ? rangeMetadata[i].original : range;
            const lines: string[] = [];

            for (let lineNum = range.start; lineNum <= range.end && lineNum < document.lineCount; lineNum++) {
                lines.push(document.lineAt(lineNum).text);
            }

            const blockNo = this._blocks.length + i;
            const codeBlock: CodeBlock = {
                block_no: blockNo,
                line_number_start: range.start,
                line_number_end: range.end,
                code: lines.join('\n'),
                timestamp: new Date().toISOString(),
                file: document.fileName
            };

            codeBlocks.push(codeBlock);

            // Register with UI if BlockManager is available
            if (this._blockManager) {
                const blockId = this._blockManager.registerDetectedBlock(
                    document.fileName,
                    range.start,
                    range.end,
                    {
                        blockNo: blockNo,
                        detectedAt: codeBlock.timestamp,
                        linesChanged: range.end - range.start + 1,
                        coreChangeStart: originalRange.start,
                        coreChangeEnd: originalRange.end,
                        expandedContext: range.start !== originalRange.start || range.end !== originalRange.end
                    }
                );
                Logger.debug(`    ✓ Registered block ${blockId} with UI (lines ${range.start}-${range.end}, core: ${originalRange.start}-${originalRange.end})`);
            }
        }

        return codeBlocks;
    }

    /**
     * Merge overlapping or adjacent ranges to prevent duplicate blocks
     */
    private _mergeOverlappingRanges(
        ranges: Array<{ start: number; end: number }>
    ): Array<{ start: number; end: number }> {
        if (ranges.length === 0) {
            return [];
        }

        // Sort ranges by start line
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged: Array<{ start: number; end: number }> = [];
        let current = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];

            // If ranges overlap or are adjacent (within 1 line), merge them
            if (next.start <= current.end + 1) {
                current = {
                    start: current.start,
                    end: Math.max(current.end, next.end)
                };
            } else {
                // No overlap, save current and move to next
                merged.push(current);
                current = next;
            }
        }

        // Don't forget the last range
        merged.push(current);

        return merged;
    }

    /**
     * Expand a line range to semantic boundaries (complete functions, blocks, etc.)
     * Improved version with tighter boundaries and limits
     */
    private _expandToSemanticBoundaries(
        range: { start: number; end: number },
        document: vscode.TextDocument
    ): { start: number; end: number } {
        let start = range.start;
        let end = range.end;

        // Get expansion settings from configuration
        const config = vscode.workspace.getConfiguration('voight');
        const expansionMode = config.get<string>('detection.semanticExpansion', 'balanced');

        // Set expansion limits based on mode
        let maxUpwardExpansion: number;
        let maxDownwardExpansion: number;

        switch (expansionMode) {
            case 'none':
                return range; // No expansion at all
            case 'minimal':
                maxUpwardExpansion = 5;
                maxDownwardExpansion = 5;
                break;
            case 'maximum':
                maxUpwardExpansion = 30;
                maxDownwardExpansion = 30;
                break;
            case 'balanced':
            default:
                maxUpwardExpansion = 15;
                maxDownwardExpansion = 15;
                break;
        }

        let upwardSteps = 0;
        let downwardSteps = 0;

        // Expand upward to find function/class start or logical boundary
        while (start > 0 && upwardSteps < maxUpwardExpansion) {
            const line = document.lineAt(start).text;
            const trimmed = line.trim();
            const prevLine = start > 0 ? document.lineAt(start - 1).text.trim() : '';

            // Stop at function/class declaration that's already at start
            if (start === range.start && this._isFunctionOrClassStart(trimmed)) {
                break;
            }

            // If previous line is a function/class declaration, we're at the body - stop here
            if (this._isFunctionOrClassStart(prevLine)) {
                break;
            }

            // Stop at double empty lines (strong separator)
            if (trimmed === '' && prevLine === '') {
                break;
            }

            // Stop at empty line followed by non-indented content (new top-level declaration)
            if (prevLine === '' && !line.match(/^[\s\t]/)) {
                break;
            }

            // Include comments directly above the range
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                start--;
                upwardSteps++;
                continue;
            }

            // Stop if we hit an opening brace on its own line (likely block start above us)
            if (trimmed === '{') {
                break;
            }

            // Check for strong separators (closing braces, export keywords, etc.)
            if (this._isStrongSeparator(trimmed)) {
                break;
            }

            start--;
            upwardSteps++;
        }

        // Expand downward to find closing brace/bracket or logical boundary
        while (end < document.lineCount - 1 && downwardSteps < maxDownwardExpansion) {
            const line = document.lineAt(end).text;
            const trimmed = line.trim();
            const nextLine = end < document.lineCount - 1 ? document.lineAt(end + 1).text.trim() : '';

            // If current line ends with closing brace, check if we should stop
            if (trimmed === '}' || trimmed === '})' || trimmed === '};' || trimmed.endsWith('};')) {
                // Stop if next line is empty or starts a new declaration
                if (nextLine === '' || this._isFunctionOrClassStart(nextLine) || this._isStrongSeparator(nextLine)) {
                    break;
                }
            }

            // Stop at double empty lines
            if (trimmed === '' && nextLine === '') {
                break;
            }

            // Stop if next line is a new function/class declaration
            if (this._isFunctionOrClassStart(nextLine)) {
                break;
            }

            end++;
            downwardSteps++;
        }

        return { start, end };
    }

    /**
     * Check if a line is a strong separator between logical blocks
     */
    private _isStrongSeparator(line: string): boolean {
        const trimmed = line.trim();
        return (
            trimmed === '}' ||
            trimmed === '})' ||
            trimmed === '};' ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('import ') ||
            trimmed.startsWith('from ') ||
            trimmed.startsWith('package ') ||
            trimmed.startsWith('using ')
        );
    }

    /**
     * Check if a line looks like the start of a function or class
     */
    private _isFunctionOrClassStart(line: string): boolean {
        const patterns = [
            /^func\s+/,           // Go
            /^function\s+/,       // JavaScript
            /^const\s+\w+\s*=/,   // JavaScript arrow functions
            /^let\s+\w+\s*=/,     // JavaScript arrow functions
            /^def\s+/,            // Python
            /^class\s+/,          // Multiple languages
            /^export\s+(default\s+)?(function|class|const|let)/,  // JavaScript exports
            /^public\s+(static\s+)?(\w+\s+)?\w+\s*\(/,  // Java/C#
            /^private\s+(static\s+)?(\w+\s+)?\w+\s*\(/,  // Java/C#
        ];
        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * Check if text looks like a complete programming statement
     */
    private _looksLikeCompleteStatement(text: string): boolean {
        const trimmed = text.trim();
        const patterns = [
            /^import\s+["'][\w\/\-\.]+["']$/,
            /^import\s+\w+\s+from\s+["'].*["']$/,
            /^from\s+[\w\.]+\s+import\s+\w+$/,
            /^require\(["'].*["']\)$/,
            /^\w+\.\w+\(.*\);?$/,
            /^(const|let|var)\s+\w+\s*=\s*.+;?$/,
            /^export\s+(default\s+)?(class|function|const)/
        ];
        return patterns.some(pattern => pattern.test(trimmed));
    }

    /**
     * Save debug events to file
     */
    private _saveDebug(): void {
        const output = {
            sessionStart: this._sessionStart,
            sessionEnd: new Date().toISOString(),
            totalEvents: this._events.length,
            pasteEvents: this._events.filter(e => e.detected).length,
            typeEvents: this._events.filter(e => !e.detected).length,
            events: this._events
        };

        fs.writeFileSync(this._outputPath, JSON.stringify(output, null, 2), 'utf-8');
    }

    /**
     * Save solution blocks to file
     */
    private _saveSolution(): void {
        const output = {
            sessionStart: this._sessionStart,
            sessionEnd: new Date().toISOString(),
            totalBlocks: this._blocks.length,
            blocks: this._blocks
        };

        fs.writeFileSync(this._solutionPath, JSON.stringify(output, null, 2), 'utf-8');
        Logger.debug(`Saved ${this._blocks.length} blocks to solution file`);
    }

    /**
     * Save all events to a JSON file
     */
    public saveToFile(): void {
        this._saveDebug();
        this._saveSolution();
        Logger.debug(`Saved ${this._events.length} events and ${this._blocks.length} blocks`);
    }

    /**
     * Get statistics
     */
    public getStats(): { total: number; pastes: number; types: number } {
        return {
            total: this._events.length,
            pastes: this._events.filter(e => e.detected).length,
            types: this._events.filter(e => !e.detected).length
        };
    }
}
