import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { DetectedBlock } from '../detection/changeDetector';

/**
 * Event recorded for debugging purposes
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

/**
 * Code block in debug output format
 */
interface CodeBlock {
    block_no: number;
    line_number_start: number;
    line_number_end: number;
    code: string;
    timestamp: string;
    file: string;
}

/**
 * Debug utility for logging paste events and blocks to JSON files
 * This is purely for debugging and analysis purposes
 */
export class DebugLogger {
    private _events: PasteEvent[] = [];
    private _blocks: CodeBlock[] = [];
    private _lastChangeTime: number = 0;
    private _sessionStart: string;
    private _outputPath: string;
    private _solutionPath: string;

    constructor(workspaceRoot: string) {
        this._sessionStart = new Date().toISOString().replace(/[:.]/g, '-');

        // Set up output directory
        const debugDir = path.join(workspaceRoot, '.voight-debug');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }

        this._outputPath = path.join(debugDir, `paste-events-${this._sessionStart}.json`);
        this._solutionPath = path.join(debugDir, `solution_${this._sessionStart}.json`);

        Logger.debug(`DebugLogger: Will save data to ${debugDir}`);
    }

    /**
     * Record a content change event
     */
    public recordChange(
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
    }

    /**
     * Record detected blocks
     */
    public recordBlocks(blocks: DetectedBlock[], fileName: string): void {
        blocks.forEach((block, idx) => {
            const codeBlock: CodeBlock = {
                block_no: this._blocks.length + idx,
                line_number_start: block.startLine,
                line_number_end: block.endLine,
                code: block.code,
                timestamp: block.timestamp,
                file: fileName
            };

            this._blocks.push(codeBlock);
            Logger.debug(`DebugLogger: Recorded block ${codeBlock.block_no}: lines ${codeBlock.line_number_start}-${codeBlock.line_number_end}`);
        });

        this._saveSolution();
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

    /**
     * Save all collected data to files
     */
    public saveToFile(): void {
        try {
            // Save events
            const eventsJson = JSON.stringify(this._events, null, 2);
            fs.writeFileSync(this._outputPath, eventsJson, 'utf-8');
            Logger.info(`DebugLogger: Saved ${this._events.length} events to ${this._outputPath}`);

            // Solution is saved incrementally via _saveSolution()
        } catch (error) {
            Logger.error(`DebugLogger: Failed to save debug data: ${error}`);
        }
    }

    /**
     * Save solution file incrementally
     */
    private _saveSolution(): void {
        try {
            const solution = {
                blocks: this._blocks,
                metadata: {
                    session: this._sessionStart,
                    totalBlocks: this._blocks.length,
                    lastUpdated: new Date().toISOString()
                }
            };

            const solutionJson = JSON.stringify(solution, null, 2);
            fs.writeFileSync(this._solutionPath, solutionJson, 'utf-8');
        } catch (error) {
            Logger.error(`DebugLogger: Failed to save solution: ${error}`);
        }
    }
}
