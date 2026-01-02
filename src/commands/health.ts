import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { AIProviderFactory } from '../ai/providerFactory';

interface HealthCheckResult {
	category: string;
	status: 'pass' | 'warn' | 'fail';
	message: string;
	details?: string;
}

export async function healthCheck(): Promise<void> {
	Logger.info('=== Voight Health Check ===');

	const results: HealthCheckResult[] = [];

	// 1. Check workspace
	results.push(checkWorkspace());

	// 2. Check configuration
	results.push(...checkConfiguration());

	// 3. Check AI provider (async)
	results.push(await checkAIProvider());

	// 4. Check extension activation
	results.push(checkExtensionActivation());

	// 5. Check storage systems
	results.push(await checkStorageSystems());

	// Log all results
	Logger.info('');
	Logger.info('Health Check Results:');
	Logger.info('━'.repeat(60));

	let passCount = 0;
	let warnCount = 0;
	let failCount = 0;

	for (const result of results) {
		const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
		const statusText = result.status.toUpperCase().padEnd(4);

		Logger.info(`${icon} [${statusText}] ${result.category}: ${result.message}`);
		if (result.details) {
			Logger.info(`         ${result.details}`);
		}

		if (result.status === 'pass') passCount++;
		else if (result.status === 'warn') warnCount++;
		else failCount++;
	}

	Logger.info('━'.repeat(60));
	Logger.info(`Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
	Logger.info('===========================');
	Logger.show();

	// Show user-friendly message
	const hasFailures = failCount > 0;
	const hasWarnings = warnCount > 0;

	if (hasFailures) {
		vscode.window.showErrorMessage(
			`Voight Health Check: ${failCount} critical issue(s) found. Check output for details.`,
			'View Output'
		).then(selection => {
			if (selection === 'View Output') {
				Logger.show();
			}
		});
	} else if (hasWarnings) {
		vscode.window.showWarningMessage(
			`Voight Health Check: ${warnCount} warning(s) found. Extension will work but some features may be limited.`,
			'View Output'
		).then(selection => {
			if (selection === 'View Output') {
				Logger.show();
			}
		});
	} else {
		vscode.window.showInformationMessage(
			'Voight Health Check: All systems operational! ✓'
		);
	}
}

function checkWorkspace(): HealthCheckResult {
	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (!workspaceFolders || workspaceFolders.length === 0) {
		return {
			category: 'Workspace',
			status: 'fail',
			message: 'No workspace folder open',
			details: 'Please open a folder to use Voight'
		};
	}

	return {
		category: 'Workspace',
		status: 'pass',
		message: `Workspace folder: ${vscode.workspace.asRelativePath(workspaceFolders[0].uri.fsPath)}`
	};
}

function checkConfiguration(): HealthCheckResult[] {
	const results: HealthCheckResult[] = [];
	const config = vscode.workspace.getConfiguration('voight');

	// Check detection settings
	const minChars = config.get<number>('detection.minCharacters', 50);
	const minLines = config.get<number>('detection.minLines', 2);

	if (minChars < 10) {
		results.push({
			category: 'Configuration',
			status: 'warn',
			message: `Min characters (${minChars}) is very low`,
			details: 'May cause excessive false positives'
		});
	} else {
		results.push({
			category: 'Configuration',
			status: 'pass',
			message: `Detection thresholds: ${minChars} chars, ${minLines} lines`
		});
	}

	// Check semantic expansion setting
	const expansion = config.get<string>('detection.semanticExpansion', 'none');
	results.push({
		category: 'Configuration',
		status: 'pass',
		message: `Semantic expansion: ${expansion}`
	});

	// Check UI settings
	const statusBarEnabled = config.get<boolean>('statusBar.enabled', true);
	const hoverEnabled = config.get<boolean>('hover.enabled', true);
	const gutterIconsEnabled = config.get<boolean>('gutterIcons.enabled', false);

	results.push({
		category: 'Configuration',
		status: 'pass',
		message: `UI: StatusBar=${statusBarEnabled}, Hover=${hoverEnabled}, Gutter=${gutterIconsEnabled}`
	});

	// Check debug settings
	const debugEnabled = config.get<boolean>('debug.enabled', false);
	const saveDebugData = config.get<boolean>('debug.saveDebugData', false);

	if (saveDebugData && !debugEnabled) {
		results.push({
			category: 'Configuration',
			status: 'warn',
			message: 'Debug data saving enabled but debug mode disabled',
			details: 'Enable debug.enabled to see debug output'
		});
	} else {
		results.push({
			category: 'Configuration',
			status: 'pass',
			message: `Debug: ${debugEnabled ? 'enabled' : 'disabled'}${saveDebugData ? ' (saving data)' : ''}`
		});
	}

	// Check exclude patterns
	const excludePatterns = config.get<string[]>('detection.excludePatterns', []);
	results.push({
		category: 'Configuration',
		status: 'pass',
		message: `${excludePatterns.length} file exclusion patterns configured`
	});

	return results;
}

async function checkAIProvider(): Promise<HealthCheckResult> {
	const config = vscode.workspace.getConfiguration('voight');
	const provider = config.get<string>('ai.provider', 'gemini');
	const apiKey = config.get<string>('ai.apiKey', '');
	const model = config.get<string>('ai.model', '');
	const maxTokens = config.get<number>('ai.maxTokens', 2048);

	// Check if API key is configured
	if (!apiKey || apiKey.trim() === '') {
		return {
			category: 'AI Provider',
			status: 'warn',
			message: `Provider: ${provider} (no API key configured)`,
			details: 'AI explanations will not work until API key is set'
		};
	}

	// Check max tokens range
	if (maxTokens < 256 || maxTokens > 8192) {
		return {
			category: 'AI Provider',
			status: 'warn',
			message: `Provider: ${provider} (maxTokens ${maxTokens} out of range)`,
			details: 'Should be between 256-8192'
		};
	}

	// Try to initialize the provider
	try {
		const aiProvider = AIProviderFactory.createProvider();

		// Check if provider is properly configured
		if (!aiProvider.isConfigured()) {
			return {
				category: 'AI Provider',
				status: 'warn',
				message: `Provider: ${provider} (initialized but not configured)`,
				details: 'API key may be invalid or missing'
			};
		}

		// Get the model name from the provider
		const modelName = model || aiProvider.getDefaultModel();

		// Provider initialized successfully
		return {
			category: 'AI Provider',
			status: 'pass',
			message: `Provider: ${provider}, Model: ${modelName}, MaxTokens: ${maxTokens}`
		};
	} catch (error) {
		return {
			category: 'AI Provider',
			status: 'fail',
			message: `Failed to initialize ${provider} provider`,
			details: error instanceof Error ? error.message : String(error)
		};
	}
}

function checkExtensionActivation(): HealthCheckResult {
	const extension = vscode.extensions.getExtension('voight-dev.voight');

	if (!extension) {
		return {
			category: 'Extension',
			status: 'fail',
			message: 'Extension not found',
			details: 'This should not happen during health check'
		};
	}

	if (!extension.isActive) {
		return {
			category: 'Extension',
			status: 'fail',
			message: 'Extension is not active',
			details: 'Extension failed to activate properly'
		};
	}

	const version = extension.packageJSON?.version || 'unknown';

	return {
		category: 'Extension',
		status: 'pass',
		message: `Version ${version}, active and running`
	};
}

async function checkStorageSystems(): Promise<HealthCheckResult> {
	// Check if we can access workspace state (via a command that uses it)
	try {
		const cmdList = await vscode.commands.getCommands(true);
		const voightCommands = cmdList.filter(cmd => cmd.startsWith('voight.'));

		if (voightCommands.length < 10) {
			return {
				category: 'Commands',
				status: 'warn',
				message: `Only ${voightCommands.length} commands registered`,
				details: 'Expected at least 10 commands'
			};
		}

		return {
			category: 'Commands',
			status: 'pass',
			message: `${voightCommands.length} commands registered`
		};
	} catch {
		return {
			category: 'Commands',
			status: 'warn',
			message: 'Could not verify command registration'
		};
	}
}
