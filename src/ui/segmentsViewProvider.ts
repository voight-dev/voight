/**
 * SegmentsViewProvider - Tree view for Activity Bar
 * Shows all detected segments in the sidebar with sorting options
 */

import * as vscode from 'vscode';
import { HighlightSegment } from './highlighter';

export enum SegmentSortOrder {
    LINE_NUMBER = 'lineNumber',
    COMPLEXITY = 'complexity'
}

export class SegmentsViewProvider implements vscode.TreeDataProvider<SegmentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SegmentTreeItem | undefined | null | void> = new vscode.EventEmitter<SegmentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SegmentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private _sortOrder: SegmentSortOrder = SegmentSortOrder.LINE_NUMBER;

    constructor(private blockManager: any) {
        // Listen for block changes
        if (blockManager.onBlockRegistered) {
            blockManager.onBlockRegistered(() => {
                this.refresh();
            });
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Set the sort order for segments
     */
    setSortOrder(sortOrder: SegmentSortOrder): void {
        this._sortOrder = sortOrder;
        this.refresh();
    }

    /**
     * Get current sort order
     */
    getSortOrder(): SegmentSortOrder {
        return this._sortOrder;
    }

    getTreeItem(element: SegmentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SegmentTreeItem): Thenable<SegmentTreeItem[]> {
        if (!element) {
            // Root level - show all blocks grouped by file
            const blocks = this.blockManager.getAllBlocks();

            if (!blocks || blocks.length === 0) {
                return Promise.resolve([]);
            }

            // Group by file
            const fileMap = new Map<string, HighlightSegment[]>();
            for (const block of blocks) {
                const fileName = this.getFileName(block.filePath);
                if (!fileMap.has(fileName)) {
                    fileMap.set(fileName, []);
                }
                fileMap.get(fileName)!.push(block);
            }

            // Create file items
            const items: SegmentTreeItem[] = [];
            for (const [fileName, fileBlocks] of fileMap) {
                items.push(new SegmentTreeItem(
                    fileName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'file',
                    fileBlocks[0].filePath,
                    undefined,
                    fileBlocks.length
                ));
            }

            return Promise.resolve(items);
        } else if (element.contextValue === 'file') {
            // Show segments for this file
            const blocks = this.blockManager.getAllBlocks();
            let fileBlocks = blocks.filter((b: HighlightSegment) => b.filePath === element.filePath);

            // Sort segments based on current sort order
            fileBlocks = this._sortSegments(fileBlocks);

            const items = fileBlocks.map((block: HighlightSegment) => {
                const complexity = this._getComplexityScore(block);
                const complexityLabel = complexity !== null ? ` (complexity: ${complexity})` : '';
                const label = `Lines ${block.startLine + 1}-${block.endLine + 1}${complexityLabel}`;

                return new SegmentTreeItem(
                    label,
                    vscode.TreeItemCollapsibleState.None,
                    'segment',
                    block.filePath,
                    block
                );
            });

            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }

    private getFileName(filePath: string): string {
        return filePath.split('/').pop() || filePath;
    }

    /**
     * Sort segments based on current sort order
     */
    private _sortSegments(segments: HighlightSegment[]): HighlightSegment[] {
        const sorted = [...segments];

        switch (this._sortOrder) {
            case SegmentSortOrder.LINE_NUMBER:
                // Sort by start line (ascending)
                sorted.sort((a, b) => a.startLine - b.startLine);
                break;

            case SegmentSortOrder.COMPLEXITY:
                // Sort by complexity (descending - highest first)
                sorted.sort((a, b) => {
                    const complexityA = this._getComplexityScore(a) ?? 0;
                    const complexityB = this._getComplexityScore(b) ?? 0;
                    return complexityB - complexityA; // Descending order
                });
                break;
        }

        return sorted;
    }

    /**
     * Extract complexity score from segment metadata
     */
    private _getComplexityScore(segment: HighlightSegment): number | null {
        // Try different metadata fields where complexity might be stored
        if (segment.metadata?.complexity) {
            // If it's an object with a score property
            if (typeof segment.metadata.complexity === 'object' && 'score' in segment.metadata.complexity) {
                return segment.metadata.complexity.score;
            }
            // If it's a direct number
            if (typeof segment.metadata.complexity === 'number') {
                return segment.metadata.complexity;
            }
        }

        // Check for complexityScore field
        if (typeof segment.metadata?.complexityScore === 'number') {
            return segment.metadata.complexityScore;
        }

        // Check for score field
        if (typeof segment.metadata?.score === 'number') {
            return segment.metadata.score;
        }

        return null;
    }
}

class SegmentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: 'file' | 'segment',
        public readonly filePath: string,
        public readonly block?: HighlightSegment,
        public readonly segmentCount?: number
    ) {
        super(label, collapsibleState);

        if (contextValue === 'file') {
            this.iconPath = new vscode.ThemeIcon('file');
            this.description = `${segmentCount} segment${segmentCount !== 1 ? 's' : ''}`;
        } else if (contextValue === 'segment' && block) {
            this.iconPath = new vscode.ThemeIcon('symbol-snippet');
            this.description = this.getStateLabel(block.state);
            this.tooltip = `${block.state} - Lines ${block.startLine + 1}-${block.endLine + 1}`;

            // Make segments clickable
            this.command = {
                command: 'voight.openBlockDetail',
                title: 'Open Block Detail',
                arguments: [block]
            };
        }
    }

    private getStateLabel(state: string): string {
        // NOTE: No emojis - using text labels for professional appearance
        const stateMap: { [key: string]: string } = {
            'new': 'New',
            'detected': 'Detected',
            'reviewing': 'Reviewing',
            'reviewed': 'Reviewed',
            'flagged': 'Flagged',
            'accepted': 'Accepted',
            'dismissed': 'Dismissed'
        };
        return stateMap[state] || state;
    }
}
