import * as vscode from 'vscode';
import * as Diff from 'diff';
import { Logger } from '../utils/logger';
import { ComplexityScorer } from './complexity/scorer';
import { ComplexityAnalyzer } from './complexity/analyzer';
import { FunctionInfo, Language } from './complexity/types';
import { FunctionBoundaryDetector } from './complexity/functionBoundaryDetector';

/**
 * Represents a document snapshot at a point in time
 */
export interface DocumentSnapshot {
    lines: string[];
    version: number;
    timestamp: number;
}

/**
 * Represents a detected change in a document
 */
export interface DetectedChange {
    startLine: number;
    endLine: number;
    text: string;
    timestamp: string;
}

/**
 * Represents a detected code block with metadata
 */
export interface DetectedBlock {
    startLine: number;
    endLine: number;
    coreChangeStart: number;
    coreChangeEnd: number;
    code: string;
    timestamp: string;
    expandedContext: boolean;
    complexityScore?: number; // 1-10 score indicating code complexity
    complexityData?: {
        ccn: number;
        nloc: number;
        level: string;
    };
    functions?: FunctionInfo[]; // Phase 2: Detected functions within this block
}

/**
 * Core detection engine that analyzes document changes
 * Responsible for diff analysis and block detection
 */
export class ChangeDetector {
    private _shadowDocuments: Map<string, DocumentSnapshot> = new Map();

    /**
     * Initialize tracking for a document
     * Sets up shadow state without triggering detection
     */
    public initializeDocument(document: vscode.TextDocument): void {
        const filePath = document.fileName;

        if (!this._shadowDocuments.has(filePath)) {
            // Initialize shadow state to current document state
            // This prevents treating existing file content as "new" when opened
            this._updateShadow(document);
            Logger.debug(`ChangeDetector: Initialized shadow state for ${filePath}`);
        } else {
            Logger.debug(`ChangeDetector: File already tracked ${filePath}`);
        }
    }

    /**
     * Detect changes in a document compared to its shadow state
     * Returns detected blocks with metadata
     */
    public detectChanges(document: vscode.TextDocument): DetectedBlock[] {
        const filePath = document.fileName;
        const initialState = this._shadowDocuments.get(filePath);

        if (!initialState) {
            Logger.warn(`ChangeDetector: No shadow state for ${filePath}, treating entire document as new`);
            this._updateShadow(document);

            // Treat entire document as changed
            const allLines = new Set<number>();
            for (let i = 0; i < document.lineCount; i++) {
                allLines.add(i);
            }

            return this._detectBlocksFromChangedLines(allLines, document);
        }

        // Capture final state
        const finalState = this._captureDocumentState(document);

        // Calculate what changed using Myers diff
        const changedLines = this._diffDocuments(initialState, finalState);

        if (changedLines.size === 0) {
            Logger.debug('ChangeDetector: No changes detected');
            this._updateShadow(document);
            return [];
        }

        Logger.debug(`ChangeDetector: Detected ${changedLines.size} changed lines`);

        this._updateShadow(document);

        return this._detectBlocksFromChangedLines(changedLines, document);
    }

    /**
     * Clear shadow state for a document
     */
    public clearDocument(filePath: string): void {
        this._shadowDocuments.delete(filePath);
    }

    /**
     * Clear all shadow states
     */
    public clearAll(): void {
        this._shadowDocuments.clear();
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
     * Diff two document states using Myers algorithm
     * Returns set of line numbers that were added or modified
     */
    private _diffDocuments(initial: DocumentSnapshot, final: DocumentSnapshot): Set<number> {
        const changedLines = new Set<number>();

        const initialText = initial.lines.join('\n');
        const finalText = final.lines.join('\n');

        const changes = Diff.diffLines(initialText, finalText);
        Logger.debug(`  → Myers diff: ${changes.length} change chunks`);

        let currentLine = 0;

        for (const change of changes) {
            const lineCount = change.count || 0;

            if (change.added) {
                Logger.debug(`    Added: ${lineCount} lines at position ${currentLine}`);
                for (let i = 0; i < lineCount; i++) {
                    changedLines.add(currentLine + i);
                }
                currentLine += lineCount;
            } else if (change.removed) {
                Logger.debug(`    Removed: ${lineCount} lines (ignored in final)`);
            } else {
                currentLine += lineCount;
            }
        }

        return changedLines;
    }

    /**
     * Detect blocks from a set of changed line numbers
     */
    private _detectBlocksFromChangedLines(
        changedLines: Set<number>,
        document: vscode.TextDocument
    ): DetectedBlock[] {
        if (changedLines.size === 0) {
            return [];
        }

        const sortedLines = Array.from(changedLines).sort((a, b) => a - b);
        Logger.debug(`  → Grouping ${sortedLines.length} changed lines into ranges...`);

        // Group into contiguous ranges
        const ranges = this._groupIntoRanges(sortedLines, document);
        Logger.debug(`  → Grouped into ${ranges.length} contiguous ranges`);

        // Expand ranges to semantic boundaries
        Logger.debug(`  → Expanding to semantic boundaries...`);
        const expandedData = ranges.map((range, idx) => {
            const expanded = this._expandToSemanticBoundaries(range, document);
            Logger.debug(`    Range ${idx}: [${range.start}-${range.end}] → [${expanded.start}-${expanded.end}]`);
            return {
                expanded,
                original: range
            };
        });

        // Merge overlapping ranges
        const mergedData = this._mergeOverlappingRanges(expandedData);
        if (mergedData.length < expandedData.length) {
            Logger.debug(`  → Merged overlapping ranges: ${expandedData.length} → ${mergedData.length}`);
        }

        // Create DetectedBlock objects with complexity scoring
        const blocks = mergedData.flatMap(({ expanded, original }) => {
            const lines: string[] = [];
            for (let lineNum = expanded.start; lineNum <= expanded.end && lineNum < document.lineCount; lineNum++) {
                lines.push(document.lineAt(lineNum).text);
            }

            const code = lines.join('\n');

            // Filter out segments that are only whitespace/empty lines
            const hasNonWhitespaceContent = lines.some(line => line.trim().length > 0);
            if (!hasNonWhitespaceContent) {
                Logger.debug(`  → Skipping empty/whitespace-only segment [${expanded.start}-${expanded.end}]`);
                return [];
            }

            // Calculate complexity score and detect functions (Phase 2)
            try {
                // Use analyzer directly to get both score and functions
                const analyzer = ComplexityAnalyzer.forFile(document.fileName);
                const analysisResult = analyzer.analyze(code);

                // Get functions from analysis (Phase 2)
                const functions = analysisResult.functions.length > 0 ? analysisResult.functions : undefined;

                if (functions && functions.length > 1) {
                    // Multiple functions detected - split into separate blocks
                    Logger.debug(`  → Detected ${functions.length} functions - splitting into separate blocks`);

                    return this._splitBlockByFunctions(
                        expanded,
                        original,
                        functions,
                        document
                    );
                } else {
                    // Single function or no functions - treat as single block
                    const scoreResult = ComplexityScorer.scoreAnalysis(analysisResult);
                    const complexityScore = scoreResult.score;
                    const complexityData = {
                        ccn: scoreResult.ccn,
                        nloc: scoreResult.nloc,
                        level: ComplexityScorer.getComplexityLevel(scoreResult.score)
                    };

                    if (functions && functions.length > 0) {
                        Logger.debug(`  → Complexity: Score=${scoreResult.score}/10, CCN=${scoreResult.ccn}, NLOC=${scoreResult.nloc}, Functions=1`);
                        Logger.debug(`    • ${functions[0].name}: CCN=${functions[0].cyclomaticComplexity}`);
                    } else {
                        Logger.debug(`  → Complexity: Score=${scoreResult.score}/10, CCN=${scoreResult.ccn}, NLOC=${scoreResult.nloc}`);
                    }

                    return [{
                        startLine: expanded.start,
                        endLine: expanded.end,
                        coreChangeStart: original.start,
                        coreChangeEnd: original.end,
                        code,
                        timestamp: new Date().toISOString(),
                        expandedContext: expanded.start !== original.start || expanded.end !== original.end,
                        complexityScore,
                        complexityData,
                        functions
                    }];
                }
            } catch (error) {
                Logger.warn(`Failed to calculate complexity for block: ${error}`);

                // Continue without complexity score if calculation fails
                return [{
                    startLine: expanded.start,
                    endLine: expanded.end,
                    coreChangeStart: original.start,
                    coreChangeEnd: original.end,
                    code,
                    timestamp: new Date().toISOString(),
                    expandedContext: expanded.start !== original.start || expanded.end !== original.end,
                    complexityScore: undefined,
                    complexityData: undefined,
                    functions: undefined
                }];
            }
        });

        Logger.info(`Created ${blocks.length} blocks (after function-level splitting)`);
        return blocks;
    }

    /**
     * Split a block into multiple blocks based on detected functions
     * Phase 2: Function-aware segmentation
     */
    private _splitBlockByFunctions(
        expanded: { start: number; end: number },
        original: { start: number; end: number },
        functions: FunctionInfo[],
        document: vscode.TextDocument
    ): DetectedBlock[] {
        const blocks: DetectedBlock[] = [];

        // Note: Function line numbers from analyzer are relative to the code snippet
        // We need to map them to absolute document line numbers
        // Extract the code snippet for boundary detection
        const codeLines: string[] = [];
        for (let lineNum = expanded.start; lineNum <= expanded.end && lineNum < document.lineCount; lineNum++) {
            codeLines.push(document.lineAt(lineNum).text);
        }
        const code = codeLines.join('\n');

        // Detect language
        const ext = document.fileName.split('.').pop()?.toLowerCase();
        let language: Language;
        switch (ext) {
            case 'go':
                language = Language.Go;
                break;
            case 'ts':
            case 'tsx':
            case 'js':
            case 'jsx':
            case 'mjs':
            case 'cjs':
                language = Language.TypeScript;
                break;
            case 'py':
                language = Language.Python;
                break;
            default:
                language = Language.TypeScript;
        }

        // Detect function boundaries in the source code
        const boundaries = FunctionBoundaryDetector.detectBoundaries(code, functions, language);

        if (boundaries.length !== functions.length) {
            Logger.warn(`Boundary detection mismatch: found ${boundaries.length} boundaries for ${functions.length} functions`);
        }

        // Debug logging for function-boundary pairing
        Logger.debug(`[Function Splitting] Functions detected: ${functions.map(f => f.name).join(', ')}`);
        Logger.debug(`[Function Splitting] Boundaries found: ${boundaries.map(b => `${b.name}:${b.startLine}-${b.endLine}`).join(', ')}`);

        // Create a map of boundaries by function name for O(1) lookup
        const boundaryMap = new Map<string, typeof boundaries[0]>();
        boundaries.forEach(boundary => {
            boundaryMap.set(boundary.name, boundary);
        });

        // Use detected boundaries or fall back to simple distribution
        for (let i = 0; i < functions.length; i++) {
            const func = functions[i];
            // Match boundary by NAME, not by index!
            const boundary = boundaryMap.get(func.name);

            Logger.debug(`[Function Splitting] Processing function "${func.name}": ${boundary ? `found boundary at ${boundary.startLine}-${boundary.endLine}` : 'no boundary found'}`);

            let functionStart: number;
            let functionEnd: number;

            if (boundary) {
                // Use detected boundary
                functionStart = expanded.start + boundary.startLine;
                functionEnd = expanded.start + boundary.endLine;
                Logger.debug(`    ✓ Using detected boundary: lines ${functionStart}-${functionEnd}`);
            } else {
                // Fallback: distribute evenly (this won't be accurate but better than nothing)
                const totalLines = expanded.end - expanded.start + 1;
                const linesPerFunc = Math.floor(totalLines / functions.length);
                functionStart = expanded.start + (i * linesPerFunc);
                functionEnd = (i === functions.length - 1)
                    ? expanded.end
                    : functionStart + linesPerFunc - 1;
                Logger.warn(`    ⚠️  No boundary found, using estimated range: lines ${functionStart}-${functionEnd}`);
            }

            // Extract function code
            const functionLines: string[] = [];
            for (let lineNum = functionStart; lineNum <= functionEnd && lineNum < document.lineCount; lineNum++) {
                functionLines.push(document.lineAt(lineNum).text);
            }
            const functionCode = functionLines.join('\n');

            // Score this specific function
            const functionAnalysis = {
                totalCCN: func.cyclomaticComplexity,
                nloc: func.nloc,
                tokenCount: func.tokenCount,
                decisionPoints: func.cyclomaticComplexity - 1,
                functions: [func]
            };
            const scoreResult = ComplexityScorer.scoreAnalysis(functionAnalysis);

            Logger.debug(`    • ${func.name}: CCN=${func.cyclomaticComplexity}, Score=${scoreResult.score}/10, Lines=${functionStart}-${functionEnd}`);

            blocks.push({
                startLine: functionStart,
                endLine: functionEnd,
                coreChangeStart: Math.max(functionStart, original.start),
                coreChangeEnd: Math.min(functionEnd, original.end),
                code: functionCode,
                timestamp: new Date().toISOString(),
                expandedContext: false, // Function boundaries are precise
                complexityScore: scoreResult.score,
                complexityData: {
                    ccn: func.cyclomaticComplexity,
                    nloc: func.nloc,
                    level: ComplexityScorer.getComplexityLevel(scoreResult.score)
                },
                functions: [func]
            });
        }

        return blocks;
    }

    /**
     * Group sorted line numbers into contiguous ranges
     */
    private _groupIntoRanges(
        sortedLines: number[],
        document: vscode.TextDocument
    ): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];
        let rangeStart = sortedLines[0];
        let rangeEnd = sortedLines[0];

        for (let i = 1; i < sortedLines.length; i++) {
            const line = sortedLines[i];
            const gap = line - rangeEnd;

            let shouldExtend = false;

            // Allow gaps up to 10 lines if they're mostly empty/whitespace
            if (gap <= 10) {
                // Always extend for small gaps
                if (gap <= 3) {
                    shouldExtend = true;
                } else {
                    // For larger gaps (4-10), check if gap is mostly empty
                    let emptyOrSimpleLines = 0;
                    for (let gapLine = rangeEnd + 1; gapLine < line; gapLine++) {
                        const text = document.lineAt(gapLine).text.trim();
                        if (text === '' || text === '{' || text === '}' ||
                            text === '};' || text === '});' || text.startsWith('//')) {
                            emptyOrSimpleLines++;
                        }
                    }
                    // If >70% of gap lines are empty/simple, extend the range
                    if (emptyOrSimpleLines / (gap - 1) > 0.7) {
                        shouldExtend = true;
                    }
                }
            }

            if (shouldExtend) {
                rangeEnd = line;
            } else {
                ranges.push({ start: rangeStart, end: rangeEnd });
                rangeStart = line;
                rangeEnd = line;
            }
        }

        ranges.push({ start: rangeStart, end: rangeEnd });
        return ranges;
    }

    /**
     * Expand a range to semantic boundaries
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

        let maxUpwardExpansion: number;
        let maxDownwardExpansion: number;

        switch (expansionMode) {
            case 'none':
                return range;
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

        // Expand upward
        while (start > 0 && upwardSteps < maxUpwardExpansion) {
            const line = document.lineAt(start).text;
            const trimmed = line.trim();
            const prevLine = start > 0 ? document.lineAt(start - 1).text.trim() : '';

            if (start === range.start && this._isFunctionOrClassStart(trimmed)) {
                break;
            }

            if (this._isFunctionOrClassStart(prevLine)) {
                break;
            }

            if (trimmed === '' && prevLine === '') {
                break;
            }

            if (prevLine === '' && !line.match(/^[\s\t]/)) {
                break;
            }

            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                start--;
                upwardSteps++;
                continue;
            }

            if (trimmed === '{') {
                break;
            }

            if (this._isStrongSeparator(trimmed)) {
                break;
            }

            start--;
            upwardSteps++;
        }

        // Expand downward
        while (end < document.lineCount - 1 && downwardSteps < maxDownwardExpansion) {
            const line = document.lineAt(end).text;
            const trimmed = line.trim();
            const nextLine = end < document.lineCount - 1 ? document.lineAt(end + 1).text.trim() : '';

            if (trimmed === '}' || trimmed === '})' || trimmed === '};' || trimmed.endsWith('};')) {
                if (nextLine === '' || this._isFunctionOrClassStart(nextLine) || this._isStrongSeparator(nextLine)) {
                    break;
                }
            }

            if (trimmed === '' && nextLine === '') {
                break;
            }

            if (this._isFunctionOrClassStart(nextLine)) {
                break;
            }

            end++;
            downwardSteps++;
        }

        return { start, end };
    }

    /**
     * Merge overlapping ranges
     */
    private _mergeOverlappingRanges(
        data: Array<{ expanded: { start: number; end: number }; original: { start: number; end: number } }>
    ): Array<{ expanded: { start: number; end: number }; original: { start: number; end: number } }> {
        if (data.length === 0) {
            return [];
        }

        const sorted = [...data].sort((a, b) => a.expanded.start - b.expanded.start);
        const merged: Array<{ expanded: { start: number; end: number }; original: { start: number; end: number } }> = [];
        let current = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];

            if (next.expanded.start <= current.expanded.end + 1) {
                current = {
                    expanded: {
                        start: current.expanded.start,
                        end: Math.max(current.expanded.end, next.expanded.end)
                    },
                    original: {
                        start: Math.min(current.original.start, next.original.start),
                        end: Math.max(current.original.end, next.original.end)
                    }
                };
            } else {
                merged.push(current);
                current = next;
            }
        }

        merged.push(current);
        return merged;
    }

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

    private _isFunctionOrClassStart(line: string): boolean {
        const patterns = [
            /^func\s+/,
            /^function\s+/,
            /^const\s+\w+\s*=/,
            /^let\s+\w+\s*=/,
            /^def\s+/,
            /^class\s+/,
            /^export\s+(default\s+)?(function|class|const|let)/,
            /^public\s+(static\s+)?(\w+\s+)?\w+\s*\(/,
            /^private\s+(static\s+)?(\w+\s+)?\w+\s*\(/,
        ];
        return patterns.some(pattern => pattern.test(line));
    }
}
