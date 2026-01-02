import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Heuristics-based paste detection
 * Determines if a change event was likely a paste operation
 */
export class PasteDetector {
    private _lastChangeTime: number = 0;

    /**
     * Check if a content change was likely pasted
     */
    public isPasted(change: vscode.TextDocumentContentChangeEvent): boolean {
        const now = Date.now();
        const timeDelta = now - this._lastChangeTime;
        this._lastChangeTime = now;

        const text = change.text;
        const textLength = text.length;

        // Heuristic 1: Large insertions are usually pastes
        if (textLength > 50) {
            return true;
        }

        // Heuristic 2: Multi-line changes are usually pastes
        if (text.includes('\n')) {
            const lineCount = (text.match(/\n/g) || []).length + 1;
            if (lineCount >= 2) {
                return true;
            }
        }

        // Heuristic 3: Instant changes (< 10ms) after previous change
        if (timeDelta < 10 && textLength > 5) {
            return true;
        }

        // Heuristic 4: Complete statements (imports, requires, etc.)
        if (this._looksLikeCompleteStatement(text) && textLength >= 10) {
            return true;
        }

        return false;
    }

    /**
     * Analyze an entire change event for paste chunks
     */
    public analyzePasteEvent(event: vscode.TextDocumentChangeEvent): boolean {
        const pasteChunks = event.contentChanges.filter(change => this.isPasted(change));
        return pasteChunks.length > 0;
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
            /^const\s+\w+\s*=\s*require\(["'].*["']\);?$/,
            /^<[A-Z]\w+.*>.*<\/[A-Z]\w+>$/,  // JSX/HTML
        ];
        return patterns.some(pattern => pattern.test(trimmed));
    }
}
