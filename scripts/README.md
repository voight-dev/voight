# Development Scripts

This directory contains scripts for local development of the Voight extension.

## dev-install.sh

**Purpose**: Hot reload workflow for local development

**What it does**:
1. Builds the extension (`node esbuild.js --production`)
2. Packages into a VSIX file (`voight-dev.vsix`)
3. Uninstalls the old version from VS Code
4. Installs the new version
5. Prompts you to reload VS Code windows

**Usage**:
```bash
# Option 1: Run directly
./scripts/dev-install.sh

# Option 2: Use npm/pnpm script
pnpm dev-install
```

**After running**:
You need to reload VS Code windows to pick up the changes. Do one of:
- Press `Cmd+Shift+P` → "Developer: Reload Window" (in each window)
- Close and reopen VS Code
- Run `code --reuse-window` from terminal

**Note**: This is for **LOCAL DEVELOPMENT ONLY**. For production releases, use the standard `vsce package` workflow.

## Workflow Tips

### Typical development cycle:
```bash
# 1. Make changes to source code
vim src/ui/segmentsWebviewProvider.ts

# 2. Install and test
pnpm dev-install

# 3. Reload VS Code windows (Cmd+Shift+P → "Developer: Reload Window")

# 4. Test the changes

# 5. Repeat
```

### Quick iteration:
If you're making rapid changes and want to skip the type-checking/linting:
```bash
# Build only (fast)
node esbuild.js --production

# Then manually install
code --uninstall-extension undefined_publisher.voight
code --install-extension voight-dev.vsix --force
```

Then reload VS Code windows.
