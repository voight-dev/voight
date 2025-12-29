# Voight

**Voight** ensures human intent drives AI generation, bridging the gap between speed and understanding.

## Features

Voight automatically detects AI-generated code segments in your workspace and helps you:

- **Track AI-Generated Code**: Automatically detects and highlights code segments that may have been AI-generated
- **Analyze Complexity**: Measures code complexity using cyclomatic complexity analysis
- **Add Context**: Annotate segments with notes explaining the purpose and intent
- **Star Important Segments**: Mark critical segments for quick access
- **Multi-Language Support**: Works with JavaScript, TypeScript, Python, and Go

## Requirements

- Visual Studio Code 1.106.1 or higher
- Optional: API keys for AI explanations (Anthropic Claude, Google Gemini, or OpenAI)
  - 📖 **[View API Setup Guide](API_SETUP_GUIDE.md)** for detailed instructions

## Extension Settings

This extension contributes the following settings:

### AI Settings
* `voight.ai.provider`: AI provider for code explanations (`gemini`, `anthropic`, or `openai`)
* `voight.ai.apiKey`: API key for your chosen AI provider ([Setup Guide](API_SETUP_GUIDE.md))
* `voight.ai.model`: Model to use (defaults to provider's default model)
* `voight.ai.maxTokens`: Maximum tokens for AI response (default: 2048)

> **💡 Need help setting up AI explanations?** Check out the [API Setup Guide](API_SETUP_GUIDE.md) for step-by-step instructions.

### Detection Settings
* `voight.detection.excludePatterns`: File patterns to exclude from detection
  - Supports glob patterns like `**/*.css`, `**/test/**`
  - Supports regex patterns with `!` prefix like `!/test\d+\.js$/`
  - Default excludes: minified files, dist, build, node_modules, .git

**Examples:**
```json
{
  "voight.detection.excludePatterns": [
    "**/*.css",           // Exclude all CSS files
    "**/*.min.js",        // Exclude minified JavaScript
    "**/test/**",         // Exclude test directories
    "**/generated/**",    // Exclude generated code
    "!/.*\\.test\\.ts$/", // Regex: exclude files ending with .test.ts
    "!/temp\\d+\\.js$/"   // Regex: exclude temp1.js, temp2.js, etc.
  ]
}
```

## Usage

1. Open any code file in your workspace
2. Voight will automatically detect AI-generated segments
3. Click on the Voight icon in the Activity Bar to see detected segments
4. Expand segments to view details, add notes, or request AI explanations
5. Star important segments to keep them visible across sessions

## Commands

- `Voight: Health Check` - Check if the extension is working correctly
- `Voight: Show Paste Detection Stats` - View statistics about paste detection
- `Voight: Show Block Statistics` - View statistics about detected blocks
- `Voight: Clear All Blocks` - Clear all detected segments

## Development

### Local Development Workflow

For rapid iteration during development:

```bash
# Install the latest version locally
pnpm dev-install

# Then reload VS Code windows:
# Press Cmd+Shift+P → "Developer: Reload Window"
```

This script will:
1. Build and package the extension
2. Uninstall the old version
3. Install the new version
4. Prompt you to reload VS Code

See [scripts/README.md](scripts/README.md) for more details.

## Release Notes

### 0.0.1

Initial development release of Voight.

---

**Enjoy using Voight!**
