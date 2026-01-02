const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const version = packageJson.version;

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// Generate build timestamp
	const buildTimestamp = new Date().toISOString();
	const buildMode = production ? 'production' : 'development';

	console.log(`Building Voight extension...`);
	console.log(`  Mode: ${buildMode}`);
	console.log(`  Timestamp: ${buildTimestamp}`);

	// Build extension
	const extCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
		define: {
			'__BUILD_TIMESTAMP__': JSON.stringify(buildTimestamp),
			'__BUILD_MODE__': JSON.stringify(buildMode),
			'__PRODUCTION__': JSON.stringify(production),
			'__VERSION__': JSON.stringify(version),
		},
	});

	// Build webview JavaScript
	const webviewCtx = await esbuild.context({
		entryPoints: [
			'webview-ui/src/segments.js'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		outfile: 'dist/segments.js',
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	if (watch) {
		await extCtx.watch();
		await webviewCtx.watch();
	} else {
		await extCtx.rebuild();
		await webviewCtx.rebuild();
		await extCtx.dispose();
		await webviewCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
