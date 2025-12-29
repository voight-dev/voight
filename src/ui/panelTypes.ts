/**
 * Shared types between extension and webview
 * This ensures type safety across the boundary
 */

import { HighlightSegment } from './highlighter';
import { ContextNote } from './contextNotes';

/**
 * Messages sent from webview to extension
 */
export type WebviewToExtensionMessage =
    | { command: 'saveNote'; note: string; tags?: string[] }
    | { command: 'deleteNote' }
    | { command: 'navigateToCode'; filePath?: string; startLine?: number; endLine?: number }
    | { command: 'requestRefresh' }
    | { command: 'markAsReviewed'; segmentId?: string }
    | { command: 'markAsFlagged'; segmentId?: string }
    | { command: 'markAsAccepted'; segmentId?: string }
    | { command: 'dismiss'; segmentId?: string }
    | { command: 'deleteSegment'; segmentId: string }
    | { command: 'updateCustomLabel'; segmentId: string; label: string }
    | { command: 'analyzeWithAI'; provider?: string }
    | { command: 'saveContext'; segmentId: string; context: string }
    | { command: 'explainSegment'; segmentId: string; code: string; language: string };

/**
 * Messages sent from extension to webview
 */
export type ExtensionToWebviewMessage =
    | { command: 'updateSegment'; segment: HighlightSegment; note?: ContextNote }
    | { command: 'updateSegments'; segments: any[] }
    | { command: 'updateNote'; note: ContextNote }
    | { command: 'showError'; message: string }
    | { command: 'showSuccess'; message: string }
    | { command: 'updateExplanation'; segmentId: string; explanation: string }
    | { command: 'explanationError'; segmentId: string; error: string }
    | { command: 'explanationLoading'; segmentId: string; loading: boolean };

/**
 * State that the webview maintains
 */
export interface WebviewState {
    segmentId?: string;
    note?: string;
    tags?: string[];
    isDirty: boolean;
}
