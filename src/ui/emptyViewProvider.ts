/**
 * EmptyViewProvider - Minimal view for Activity Bar
 * Shows a single "Open Voight" button that opens the Block Detail Panel
 */

import * as vscode from 'vscode';

export class EmptyViewProvider implements vscode.TreeDataProvider<ViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ViewItem | undefined | null | void> = new vscode.EventEmitter<ViewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ViewItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<ViewItem[]> {
        // Show a single button to open the main panel
        const openButton = new ViewItem(
            'Open Voight Panel',
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'voight.openBlockDetail',
                title: 'Open Voight Panel',
                arguments: []
            }
        );
        openButton.iconPath = new vscode.ThemeIcon('open-preview');
        openButton.tooltip = 'Click to open the Voight panel';

        return Promise.resolve([openButton]);
    }
}

class ViewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}
