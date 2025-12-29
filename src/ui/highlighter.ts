import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Configuration for how to highlight code segments
 */
export interface HighlightConfig {
    backgroundColor: string;
    borderColor?: string;
    borderWidth?: string;
    borderStyle?: string;
}

/**
 * Represents a segment of code to be highlighted
 */
export interface HighlightSegment {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    state: SegmentState;
    metadata?: Record<string, any>;
}

/**
 * State of a highlighted segment - controls behavior and appearance
 */
export enum SegmentState {
    DETECTED = 'detected',      // Just detected, awaiting review
    REVIEWED = 'reviewed',      // User has reviewed
    FLAGGED = 'flagged',       // User marked for attention
    ACCEPTED = 'accepted',     // User accepted the code
    DISMISSED = 'dismissed'    // User dismissed/ignored
}

/**
 * Action plugin interface - allows injecting features on highlighted segments
 */
export interface SegmentActionPlugin {
    name: string;
    canHandle(segment: HighlightSegment): boolean;
    execute(segment: HighlightSegment): Promise<void>;
}

/**
 * Manages highlighting of code segments with configurable appearance and pluggable actions
 *
 * Design principles:
 * - Separation of concerns: Highlighting logic separate from segment detection
 * - Pluggable actions: Easy to add new features via action plugins
 * - State-driven: Segment state controls appearance and available actions
 * - API-based: Exposes clean interface for backend to use
 */
export class Highlighter {
    private _decorationTypes: Map<SegmentState, vscode.TextEditorDecorationType> = new Map();
    private _activeSegments: Map<string, HighlightSegment> = new Map();
    private _actionPlugins: SegmentActionPlugin[] = [];

    constructor(private _configs: Map<SegmentState, HighlightConfig>) {
        this._initializeDecorationTypes();
        Logger.debug('Highlighter initialized with state-based configurations');
    }

    /**
     * Initialize VSCode decoration types for each segment state
     */
    private _initializeDecorationTypes(): void {
        for (const [state, config] of this._configs.entries()) {
            const decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.backgroundColor,
                isWholeLine: true,
                borderColor: config.borderColor,
                borderWidth: config.borderWidth,
                borderStyle: config.borderStyle,
            });

            this._decorationTypes.set(state, decorationType);
            Logger.debug(`Created decoration type for state: ${state}`);
        }
    }

    /**
     * Register an action plugin
     */
    public registerActionPlugin(plugin: SegmentActionPlugin): void {
        this._actionPlugins.push(plugin);
        Logger.debug(`Registered action plugin: ${plugin.name}`);
    }

    /**
     * Add a new segment to highlight
     */
    public addSegment(segment: HighlightSegment): void {
        this._activeSegments.set(segment.id, segment);
        this._applyHighlighting();
        Logger.debug(`Added segment ${segment.id} at ${segment.filePath}:${segment.startLine}-${segment.endLine}`);
    }

    /**
     * Update the state of an existing segment
     */
    public updateSegmentState(segmentId: string, newState: SegmentState): void {
        const segment = this._activeSegments.get(segmentId);
        if (!segment) {
            Logger.error(`Segment ${segmentId} not found`);
            return;
        }

        segment.state = newState;
        this._applyHighlighting();
        Logger.debug(`Updated segment ${segmentId} state to ${newState}`);
    }

    /**
     * Remove a segment from highlighting
     */
    public removeSegment(segmentId: string): void {
        if (this._activeSegments.delete(segmentId)) {
            this._applyHighlighting();
            Logger.debug(`Removed segment ${segmentId}`);
        }
    }

    /**
     * Get all segments for a specific file
     */
    public getSegmentsForFile(filePath: string): HighlightSegment[] {
        return Array.from(this._activeSegments.values())
            .filter(segment => segment.filePath === filePath);
    }

    /**
     * Get a specific segment by ID
     */
    public getSegment(segmentId: string): HighlightSegment | undefined {
        return this._activeSegments.get(segmentId);
    }

    /**
     * Get all segments in a specific state
     */
    public getSegmentsByState(state: SegmentState): HighlightSegment[] {
        return Array.from(this._activeSegments.values())
            .filter(segment => segment.state === state);
    }

    /**
     * Execute available actions for a segment
     */
    public async executeActions(segmentId: string): Promise<void> {
        const segment = this._activeSegments.get(segmentId);
        if (!segment) {
            Logger.error(`Segment ${segmentId} not found`);
            return;
        }

        const availablePlugins = this._actionPlugins.filter(plugin => plugin.canHandle(segment));

        if (availablePlugins.length === 0) {
            Logger.debug(`No action plugins available for segment ${segmentId}`);
            return;
        }

        // For now, show quick pick to choose action
        const selected = await vscode.window.showQuickPick(
            availablePlugins.map(p => p.name),
            { placeHolder: 'Choose an action for this code segment' }
        );

        if (selected) {
            const plugin = availablePlugins.find(p => p.name === selected);
            if (plugin) {
                await plugin.execute(segment);
            }
        }
    }

    /**
     * Apply highlighting to all visible editors
     */
    private _applyHighlighting(): void {
        // Group segments by file and state
        const segmentsByFileAndState = new Map<string, Map<SegmentState, HighlightSegment[]>>();

        for (const segment of this._activeSegments.values()) {
            if (!segmentsByFileAndState.has(segment.filePath)) {
                segmentsByFileAndState.set(segment.filePath, new Map());
            }

            const fileSegments = segmentsByFileAndState.get(segment.filePath)!;
            if (!fileSegments.has(segment.state)) {
                fileSegments.set(segment.state, []);
            }

            fileSegments.get(segment.state)!.push(segment);
        }

        // Apply decorations to all visible editors
        for (const editor of vscode.window.visibleTextEditors) {
            const filePath = editor.document.fileName;
            const fileSegments = segmentsByFileAndState.get(filePath);

            // Clear all decorations first
            for (const decorationType of this._decorationTypes.values()) {
                editor.setDecorations(decorationType, []);
            }

            // Apply decorations for each state
            if (fileSegments) {
                for (const [state, segments] of fileSegments.entries()) {
                    const decorationType = this._decorationTypes.get(state);
                    if (!decorationType) {
                        continue;
                    }

                    const ranges = segments.map(segment =>
                        new vscode.Range(
                            new vscode.Position(segment.startLine, 0),
                            new vscode.Position(segment.endLine, Number.MAX_VALUE)
                        )
                    );

                    editor.setDecorations(decorationType, ranges);
                }
            }
        }
    }

    /**
     * Clear all highlights
     */
    public clearAll(): void {
        this._activeSegments.clear();
        this._applyHighlighting();
        Logger.debug('Cleared all highlights');
    }

    /**
     * Dispose of all decoration types
     */
    public dispose(): void {
        for (const decorationType of this._decorationTypes.values()) {
            decorationType.dispose();
        }
        this._decorationTypes.clear();
        this._activeSegments.clear();
        Logger.debug('Highlighter disposed');
    }

    /**
     * Refresh highlighting when active editor changes
     */
    public onActiveEditorChanged(): void {
        this._applyHighlighting();
    }
}

/**
 * Factory function to create a Highlighter with default configurations
 */
export function createDefaultHighlighter(): Highlighter {
    const configs = new Map<SegmentState, HighlightConfig>([
        [SegmentState.DETECTED, {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // No background highlight
            borderColor: 'rgba(255, 200, 0, 0.5)',
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid'
        }],
        [SegmentState.REVIEWED, {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // No background highlight
            borderColor: 'rgba(100, 150, 255, 0.4)',
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid'
        }],
        [SegmentState.FLAGGED, {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // No background highlight
            borderColor: 'rgba(255, 100, 100, 0.5)',
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid'
        }],
        [SegmentState.ACCEPTED, {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // No background highlight
            borderColor: 'rgba(100, 200, 100, 0.4)',
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid'
        }],
        [SegmentState.DISMISSED, {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // No background highlight
            borderColor: 'rgba(128, 128, 128, 0.2)',
            borderWidth: '0 0 0 3px',
            borderStyle: 'dotted'
        }]
    ]);

    return new Highlighter(configs);
}
