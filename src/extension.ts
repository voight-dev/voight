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
import { FileRegistry } from './tracking/fileRegistry';
import { ShadowMetadataManager } from './tracking/shadowMetadataManager';
import { ShadowGarbageCollector } from './tracking/shadowGarbageCollector';

let coordinator: DetectionCoordinator;
let blockManager: BlockManager;
let contextNotesManager: ContextNotesManager;
let debugLogger: DebugLogger | undefined;
let fileTrackingService: FileTrackingService;
let fileRegistry: FileRegistry;
let shadowMetadataManager: ShadowMetadataManager;
let shadowGarbageCollector: ShadowGarbageCollector;

export async function activate(context: vscode.ExtensionContext) {
	// Read debug mode configuration
	const config = vscode.workspace.getConfiguration('voight');
	const debugMode = config.get<boolean>('debug.enabled', false);

	// Configure logger with debug mode
	Logger.configure('Voight', debugMode);

	// Get extension version and running mode
	const extension = vscode.extensions.getExtension('undefined_publisher.voight');
	const version = extension?.packageJSON?.version || 'unknown';

	// Determine if we're running in development/debug mode (F5) or packaged mode
	const extensionMode = context.extensionMode;
	let modeString = 'Unknown';

	switch (extensionMode) {
		case vscode.ExtensionMode.Production:
			modeString = 'Production (Packaged VSIX)';
			break;
		case vscode.ExtensionMode.Development:
			modeString = 'Development (F5 Debug)';
			break;
		case vscode.ExtensionMode.Test:
			modeString = 'Test Mode';
			break;
	}

	// Build information (injected by esbuild at compile time)
	const buildTimestamp = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'unknown';
	const buildMode = typeof __BUILD_MODE__ !== 'undefined' ? __BUILD_MODE__ : 'unknown';

	Logger.info(`=== Voight v${version} ===`);
	Logger.info(`Extension mode: ${modeString}`);
	Logger.info(`Build: ${buildMode} @ ${buildTimestamp}`);
	Logger.info(`Debug logging: ${debugMode ? 'ENABLED' : 'DISABLED'}`);
	Logger.info(`Extension activated`);
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

	// Initialize file registry to track existing files
	fileRegistry = new FileRegistry();
	await fileRegistry.initialize(workspaceRoot);
	Logger.info(`File registry initialized with ${fileRegistry.getCount()} files`);

	// Initialize UI layer
	const highlighter = createDefaultHighlighter();
	blockManager = new BlockManager(highlighter, segmentRepository, fileTrackingService);

	// Initialize context notes manager
	contextNotesManager = new ContextNotesManager(context);
	// Wire up BlockManager so notes are stored as part of segments
	contextNotesManager.setBlockManager(blockManager);

	// Register segments webview for Activity Bar sidebar
	const segmentsWebviewProvider = new SegmentsWebviewProvider(context.extensionUri, blockManager, contextNotesManager, fileRegistry);
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

	// Initialize shadow metadata manager with workspace state
	shadowMetadataManager = new ShadowMetadataManager(context.workspaceState);
	await shadowMetadataManager.loadFromWorkspace();
	Logger.info('Shadow metadata manager initialized');

	// Initialize detection coordinator with file registry, UI and optional debug integration
	coordinator = new DetectionCoordinator(fileRegistry, blockManager, debugLogger);

	// Connect metadata manager to change detector
	coordinator.getChangeDetector().setMetadataManager(shadowMetadataManager);

	// Initialize garbage collector
	shadowGarbageCollector = new ShadowGarbageCollector(
		coordinator.getChangeDetector(),
		shadowMetadataManager
	);
	shadowGarbageCollector.start();
	Logger.info('Shadow garbage collector started');

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

	// Watch for files created and deleted on disk (by AI tools, external processes, etc.)
	const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');

	const fileCreateListener = fileSystemWatcher.onDidCreate(async (uri) => {
		if (uri.scheme !== 'file') {
			return;
		}

		Logger.info(`File system: New file created on disk - ${uri.fsPath}`);

		// Check if file is already known
		if (!fileRegistry.isKnown(uri.fsPath)) {
			Logger.info(`File system: This is a NEW file - marking for tracking`);

			// Wait a brief moment to see if user is actively editing this file
			await new Promise(resolve => setTimeout(resolve, 500));

			// Check if there's an active editor for this file
			const activeEditor = vscode.window.activeTextEditor;
			const isActivelyEditing = activeEditor?.document.uri.fsPath === uri.fsPath;

			if (isActivelyEditing) {
				Logger.info(`File system: User is actively editing - will use normal paste detection`);
				// Don't register yet - let initializeDocument handle it
				return;
			}

			// File was created by AI/external tool and not actively being edited
			// Mark it as a "pending new file" that should be fully tracked when opened
			Logger.info(`File system: Marking as AI-generated file (will process when opened)`);
			// Don't register it - this keeps it "unknown" so initializeDocument will handle it specially
		}
	});

	const fileDeleteListener = fileSystemWatcher.onDidDelete((uri) => {
		if (uri.scheme !== 'file') {
			return;
		}

		const filePath = uri.fsPath;
		Logger.info(`File system: File deleted - ${filePath}`);

		// Remove from file registry
		fileRegistry.unregister(filePath);

		// Remove all segments for this file
		blockManager.removeSegmentsForFile(filePath);

		// Clear shadow state for this file
		coordinator.clearFile(filePath);

		// Remove shadow metadata
		shadowMetadataManager.removeMetadata(filePath);

		Logger.info(`File system: Cleaned up tracking data for deleted file`);
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

	// Show shadow GC statistics
	const showGCStatsCommand = vscode.commands.registerCommand('voight.showGCStats', () => {
		const gcStats = shadowMetadataManager.getGCStats();
		const analytics = shadowMetadataManager.getAnalyticsSummary();
		const changeDetector = coordinator.getChangeDetector();
		const gcConfig = shadowGarbageCollector.getConfig();

		const message = `Shadow Garbage Collector:
Status: ${gcConfig.isRunning ? 'Running' : 'Stopped'}
GC Interval: ${gcConfig.intervalMinutes} minutes
Retention: ${gcConfig.retentionMinutes} minutes

Current State:
Active shadows: ${changeDetector.getShadowCount()}
Total memory: ${formatBytes(changeDetector.getTotalMemoryUsage())}

Metadata:
Total files tracked: ${analytics.totalFiles}
Active files: ${analytics.activeFiles}
Removed files: ${analytics.removedFiles}
Total lifecycles: ${analytics.totalLifecycles}

GC Stats:
Total runs: ${gcStats.totalRuns}
Total shadows removed: ${gcStats.totalShadowsRemoved}
Total memory freed: ${formatBytes(gcStats.totalMemoryFreed)}
Last run: ${gcStats.lastRunAt > 0 ? new Date(gcStats.lastRunAt).toLocaleString() : 'Never'}`;

		vscode.window.showInformationMessage(message);
	});

	// Manually trigger garbage collection
	const runGCCommand = vscode.commands.registerCommand('voight.runGC', async () => {
		vscode.window.showInformationMessage('Running garbage collection...');
		await shadowGarbageCollector.collect();
		const gcStats = shadowMetadataManager.getGCStats();
		vscode.window.showInformationMessage(
			`GC complete: removed ${gcStats.lastRunStats.shadowsRemoved} shadows, freed ${formatBytes(gcStats.lastRunStats.memoryFreed)}`
		);
	});

	// Helper function for formatting bytes
	function formatBytes(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes}B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)}KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}

	context.subscriptions.push(
		healthCheckCommand,
		documentOpenListener,
		documentChangeListener,
		fileSystemWatcher,
		fileCreateListener,
		fileDeleteListener,
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
		showGCStatsCommand,
		runGCCommand,
		fileEditListener
	);

	Logger.info('Detection system ready');
}

// This method is called when your extension is deactivated
export async function deactivate() {
	Logger.info('Extension deactivating...');

	// Stop garbage collector
	if (shadowGarbageCollector) {
		shadowGarbageCollector.stop();
		Logger.info('Garbage collector stopped');
	}

	// Save metadata
	if (shadowMetadataManager) {
		await shadowMetadataManager.saveToWorkspace();
		Logger.info('Shadow metadata saved');
	}

	// Save debug data if enabled
	if (debugLogger) {
		Logger.info('Saving debug data...');
		coordinator.saveDebugData();
	}

	Logger.info('Extension deactivated');
	Logger.dispose();
}