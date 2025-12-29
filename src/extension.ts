// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { healthCheck } from './commands/health';
import { createDefaultHighlighter } from './ui/highlighter';
import { BlockManager } from './ui/blockManager';
import { ReviewPlugin } from './ui/plugins/reviewPlugin';
import { AnalyzePlugin } from './ui/plugins/analyzePlugin';
import { DetectionCoordinator } from './detection/detectionCoordinator';
import { DebugLogger } from './debug/debugLogger';
import { ContextNotesManager } from './ui/contextNotes';
import { SegmentsWebviewProvider } from './ui/segmentsWebviewProvider';
import { VscodeSegmentRepository } from './storage/VscodeSegmentRepository';
import { FileTrackingService } from './tracking/fileTracker';

let coordinator: DetectionCoordinator;
let blockManager: BlockManager;
let contextNotesManager: ContextNotesManager;
let debugLogger: DebugLogger | undefined;
let fileTrackingService: FileTrackingService;

export async function activate(context: vscode.ExtensionContext) {
	// Read debug mode configuration
	const config = vscode.workspace.getConfiguration('voight');
	const debugMode = config.get<boolean>('debug.enabled', false);

	// Configure logger with debug mode
	Logger.configure('Voight', debugMode);
	Logger.info(`Extension activated (debug mode: ${debugMode ? 'enabled' : 'disabled'})`);
	Logger.show();

	// Register health check command
	const healthCheckCommand = vscode.commands.registerCommand('voight.healthCheck', healthCheck);

	// Get workspace root
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		Logger.error('No workspace folder found - extension will not activate');
		vscode.window.showErrorMessage('Voight: Please open a folder to use this extension');
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	Logger.info(`Workspace root: ${workspaceRoot}`);

	// Initialize segment repository
	const segmentRepository = new VscodeSegmentRepository(context);
	await segmentRepository.initialize();
	Logger.info('Segment repository initialized');

	// Initialize file tracking service
	fileTrackingService = new FileTrackingService(context);
	Logger.info('File tracking service initialized');

	// Subscribe to real-time file edit events
	const fileEditListener = fileTrackingService.onFileEdited((event) => {
		Logger.debug(`File edited: ${vscode.workspace.asRelativePath(event.filePath)} (edit #${event.editCount}, ${event.linesChanged} lines)`);
	});

	// Initialize UI layer
	const highlighter = createDefaultHighlighter();
	blockManager = new BlockManager(highlighter, segmentRepository, fileTrackingService);

	// Initialize context notes manager
	contextNotesManager = new ContextNotesManager(context);
	// Wire up BlockManager so notes are stored as part of segments
	contextNotesManager.setBlockManager(blockManager);

	// Register segments webview for Activity Bar sidebar
	const segmentsWebviewProvider = new SegmentsWebviewProvider(context.extensionUri, blockManager, contextNotesManager);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SegmentsWebviewProvider.viewType,
			segmentsWebviewProvider
		)
	);

	// Register action plugins
	blockManager.highlighter.registerActionPlugin(new ReviewPlugin());
	blockManager.highlighter.registerActionPlugin(new AnalyzePlugin());

	// Initialize debug logger only if debug mode is enabled
	if (debugMode) {
		debugLogger = new DebugLogger(workspaceRoot);
		Logger.info('Debug logger initialized - JSON files will be saved to .voight-debug/');
	} else {
		debugLogger = undefined;
	}

	// Initialize detection coordinator with UI and optional debug integration
	coordinator = new DetectionCoordinator(blockManager, debugLogger);

	// Initialize tracking for all currently open documents
	vscode.workspace.textDocuments.forEach(doc => {
		coordinator.initializeDocument(doc);
	});

	// Initialize tracking when new documents are opened
	const documentOpenListener = vscode.workspace.onDidOpenTextDocument((doc) => {
		coordinator.initializeDocument(doc);
	});

	// Set up document change listener - analyze all changes
	const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
		coordinator.analyzeEvent(event);
	});

	// Show paste detection stats command
	const showStatsCommand = vscode.commands.registerCommand('voight.showStats', () => {
		const stats = coordinator.getStats();
		vscode.window.showInformationMessage(
			`Voight: ${stats.pastes} pastes, ${stats.types} typed, ${stats.total} total events`
		);
	});

	// Show block statistics command
	const showBlockStatsCommand = vscode.commands.registerCommand('voight.showBlockStats', () => {
		const stats = blockManager.getStats();
		vscode.window.showInformationMessage(
			`Blocks: ${stats.total} total | ${stats.detected} detected | ${stats.reviewed} reviewed | ${stats.flagged} flagged | ${stats.accepted} accepted`
		);
	});

	// Clear all blocks command
	const clearBlocksCommand = vscode.commands.registerCommand('voight.clearBlocks', () => {
		blockManager.clearAll();
		vscode.window.showInformationMessage('All blocks cleared');
	});

	// Show blocks in current file command
	const showCurrentFileBlocksCommand = vscode.commands.registerCommand('voight.showCurrentFileBlocks', () => {
		const blocks = blockManager.getCurrentFileBlocks();
		if (blocks.length === 0) {
			vscode.window.showInformationMessage('No detected blocks in current file');
		} else {
			const blockInfo = blocks.map(b =>
				`Block ${b.id}: lines ${b.startLine}-${b.endLine} [${b.state}]`
			).join('\n');
			vscode.window.showInformationMessage(`Current file has ${blocks.length} blocks:\n${blockInfo}`);
		}
	});

	// Open block detail panel command - removed, panel no longer used

	// Open detail for block at cursor position - removed, panel no longer used

	// Show all context notes for current file
	const showFileContextsCommand = vscode.commands.registerCommand('voight.showFileContexts', async () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showInformationMessage('No active file');
			return;
		}

		const filePath = activeEditor.document.fileName;
		const notes = contextNotesManager.getNotesForFile(filePath);

		if (notes.length === 0) {
			vscode.window.showInformationMessage('No context notes for this file');
			return;
		}

		// Display in quick pick
		const items = notes.map(note => ({
			label: `Lines ${note.startLine + 1}-${note.endLine + 1}`,
			description: note.note.substring(0, 50) + (note.note.length > 50 ? '...' : ''),
			detail: note.note,
			note
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: `Select a context note to view (${notes.length} note${notes.length > 1 ? 's' : ''} in this file)`
		});

		if (selected) {
			// Navigate to the note's location
			const range = new vscode.Range(
				selected.note.startLine,
				0,
				selected.note.endLine,
				Number.MAX_VALUE
			);
			activeEditor.selection = new vscode.Selection(range.start, range.end);
			activeEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		}
	});

	// Get top N most edited files
	const getTopEditedFilesCommand = vscode.commands.registerCommand('voight.getTopEditedFiles', async () => {
		const input = await vscode.window.showInputBox({
			prompt: 'How many top files to show?',
			value: '10',
			validateInput: (value) => {
				const num = parseInt(value);
				if (isNaN(num) || num < 1) {
					return 'Please enter a positive number';
				}
				return null;
			}
		});

		if (!input) {
			return;
		}

		const limit = parseInt(input);
		const topFiles = await fileTrackingService.getTopFiles(limit);

		if (topFiles.length === 0) {
			vscode.window.showInformationMessage('No files have been edited by AI yet');
			return;
		}

		// Display in quick pick
		const items = topFiles.map(file => ({
			label: `#${file.rank} - ${vscode.workspace.asRelativePath(file.filePath)}`,
			description: `${file.editCount} edits, ${file.totalLinesChanged} lines changed`,
			detail: `First: ${new Date(file.firstEditedAt).toLocaleString()} | Last: ${new Date(file.lastEditedAt).toLocaleString()}`,
			file
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: `Top ${topFiles.length} most edited files`
		});

		if (selected) {
			// Open the file
			const doc = await vscode.workspace.openTextDocument(selected.file.filePath);
			await vscode.window.showTextDocument(doc);
		}
	});

	// Show file tracking statistics
	const showFileTrackingStatsCommand = vscode.commands.registerCommand('voight.showFileTrackingStats', async () => {
		const stats = await fileTrackingService.getStatistics();

		if (stats.totalFiles === 0) {
			vscode.window.showInformationMessage('No files have been edited by AI yet');
			return;
		}

		const message = `File Tracking Stats:
${stats.totalFiles} files tracked
${stats.totalEdits} total AI edits
${stats.totalLinesChanged} total lines changed
Most edited: ${stats.mostEditedFile ? vscode.workspace.asRelativePath(stats.mostEditedFile.filePath) + ' (' + stats.mostEditedFile.editCount + ' edits)' : 'N/A'}`;

		vscode.window.showInformationMessage(message);
	});

	// Export file rankings to JSON
	const exportFileRankingsCommand = vscode.commands.registerCommand('voight.exportFileRankings', async () => {
		const json = await fileTrackingService.exportToJson();

		if (json === '[]') {
			vscode.window.showInformationMessage('No files to export - no AI edits tracked yet');
			return;
		}

		// Ask user where to save
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(workspaceRoot + '/voight-file-rankings.json'),
			filters: {
				'JSON': ['json']
			}
		});

		if (uri) {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
			vscode.window.showInformationMessage(`File rankings exported to ${uri.fsPath}`);
		}
	});

	// Get tracking data for current file
	const getCurrentFileTrackingCommand = vscode.commands.registerCommand('voight.getCurrentFileTracking', async () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showInformationMessage('No active file');
			return;
		}

		const filePath = activeEditor.document.fileName;
		const fileData = await fileTrackingService.getFileData(filePath);

		if (!fileData) {
			vscode.window.showInformationMessage('This file has not been edited by AI yet');
			return;
		}

		const ranked = await fileTrackingService.getRankedFiles();
		const rank = ranked.findIndex(f => f.filePath === filePath) + 1;

		const message = `${vscode.workspace.asRelativePath(filePath)}:
Rank: #${rank} of ${ranked.length}
Edit count: ${fileData.editCount}
Total lines changed: ${fileData.totalLinesChanged}
First edited: ${new Date(fileData.firstEditedAt).toLocaleString()}
Last edited: ${new Date(fileData.lastEditedAt).toLocaleString()}`;

		vscode.window.showInformationMessage(message);
	});

	// Clear file tracking data
	const clearFileTrackingCommand = vscode.commands.registerCommand('voight.clearFileTracking', async () => {
		const result = await vscode.window.showWarningMessage(
			'Are you sure you want to clear all file tracking data? This cannot be undone.',
			'Yes', 'No'
		);

		if (result === 'Yes') {
			await fileTrackingService.clearAll();
			vscode.window.showInformationMessage('File tracking data cleared');
		}
	});

	context.subscriptions.push(
		healthCheckCommand,
		documentOpenListener,
		documentChangeListener,
		showStatsCommand,
		showBlockStatsCommand,
		clearBlocksCommand,
		showCurrentFileBlocksCommand,
		showFileContextsCommand,
		getTopEditedFilesCommand,
		showFileTrackingStatsCommand,
		exportFileRankingsCommand,
		getCurrentFileTrackingCommand,
		clearFileTrackingCommand,
		fileEditListener
	);

	Logger.info('Detection system ready');
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (debugLogger) {
		Logger.info('Extension deactivating - saving debug data...');
		coordinator.saveDebugData();
	} else {
		Logger.info('Extension deactivating');
	}

	Logger.dispose();
}