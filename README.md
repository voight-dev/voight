<p align="center">
  <img src="resources/icon.png" alt="Voight" width="128" height="128">
</p>

<h1 align="center">Voight</h1>

<p align="center">
  Track and review AI-generated code in VS Code.
  <br>
  <a href="https://voight.dev">voight.dev</a>
</p>

## What It Does

Voight detects code insertions from AI assistants and organizes them into reviewable segments. When you're moving fast with AI-assisted development, it keeps you oriented without requiring you to stop.

- **Timeline View**: Chronological sequence of AI edits across all files. Useful when changes span multiple files and you need to understand the order.
- **Segments**: Detected code blocks displayed in a sidebar panel. Click to navigate, review at your own pace.
- **Complexity Indicators**: Cyclomatic complexity scores per segment. Higher scores indicate denser control flow.
- **Context Markers**: Attach notes to segments. Useful for flagging code that needs review or documenting intent.
- **BYOK Explanations**: Request an AI explanation for any segment using your own API key. Independent of the AI that generated the code.

## Installation

### From Marketplace

```
ext install voight-dev.voight
```

Or search "Voight" in the VS Code Extensions panel.

### From Source

```bash
git clone https://github.com/voight-dev/voight.git
cd voight
pnpm install
pnpm package
code --install-extension voight-0.0.1.vsix
```

## Configuration

### Detection

| Setting | Default | Description |
|---------|---------|-------------|
| `voight.detection.minCharacters` | 50 | Minimum characters for insertion detection |
| `voight.detection.minLines` | 2 | Minimum lines for multi-line detection |
| `voight.detection.semanticExpansion` | none | Context expansion: `none`, `minimal`, `balanced`, `maximum` |
| `voight.detection.excludePatterns` | See below | Glob/regex patterns to exclude |

Default exclusions: `**/*.min.js`, `**/*.min.css`, `**/dist/**`, `**/build/**`, `**/node_modules/**`, `**/.git/**`

Regex patterns use `!` prefix: `!/test\d+\.js$/`

### AI Provider

| Setting | Default | Description |
|---------|---------|-------------|
| `voight.ai.provider` | gemini | `gemini`, `anthropic`, or `openai` |
| `voight.ai.apiKey` | - | API key for chosen provider |
| `voight.ai.maxTokens` | 2048 | Response token limit (256-8192) |

The extension automatically selects the best available model from your provider.

### Debug

| Setting | Default | Description |
|---------|---------|-------------|
| `voight.debug.enabled` | true | Verbose logging |
| `voight.debug.saveDebugData` | false | Save debug JSON to `.voight-debug/` |

## Commands

| Command | Description |
|---------|-------------|
| `Voight: Health Check` | Run diagnostics |
| `Voight: Show Paste Detection Stats` | Detection statistics |
| `Voight: Show Block Statistics` | Segment counts and metrics |
| `Voight: Clear All Blocks` | Remove all segments |
| `Voight: Show Current File Blocks` | List segments in active file |
| `Voight: Show All Context Notes for File` | Browse annotations |
| `Voight: Show Top Edited Files` | Files ranked by edit frequency |
| `Voight: Show File Tracking Statistics` | Edit analytics |
| `Voight: Export File Rankings` | Export as JSON |
| `Voight: Show Current File Tracking` | Tracking info for active file |
| `Voight: Clear File Tracking Data` | Reset analytics |
| `Voight: Show Shadow GC Statistics` | Memory management stats |
| `Voight: Run Garbage Collection Now` | Force garbage collection |

## Supported Languages

Complexity analysis: TypeScript, JavaScript, Python, Go

Detection works with any text file.

## Development

```bash
git clone https://github.com/voight-dev/voight.git
cd voight
pnpm install
```

```bash
pnpm compile      # Type check + lint + build
pnpm watch        # Watch mode
pnpm package      # Production build
pnpm test         # Run tests
pnpm dev-install  # Install locally, then reload VS Code
```

## Credits

Complexity analysis ported from [Lizard](https://github.com/terryyin/lizard) by Terry Yin.

## License

MIT
