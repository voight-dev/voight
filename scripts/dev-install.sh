#!/bin/bash

# Dev Install Script for Voight Extension
# This script builds, packages, and installs the extension locally for development
# WARNING: This is for LOCAL DEVELOPMENT ONLY - NOT for production releases

set -e  # Exit on any error

echo "========================================="
echo "🔧 Voight Development Install"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "📍 Project root: $PROJECT_ROOT"
echo ""

# Step 1: Build the extension
echo "🔨 Step 1: Building extension..."
node esbuild.js --production
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Step 2: Package the extension
echo "📦 Step 2: Packaging extension..."
npx @vscode/vsce package --allow-missing-repository --no-dependencies --out voight-dev.vsix 2>&1 | grep -v "^npm warn"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Packaging successful${NC}"
else
    echo -e "${RED}❌ Packaging failed${NC}"
    exit 1
fi
echo ""

# Step 3: Get the extension ID
EXTENSION_ID="undefined_publisher.voight"
echo "🔍 Extension ID: $EXTENSION_ID"
echo ""

# Step 4: Uninstall old version
echo "🗑️  Step 3: Uninstalling old version..."
code --uninstall-extension "$EXTENSION_ID" > /dev/null 2>&1 || true
echo -e "${GREEN}✅ Old version uninstalled${NC}"
echo ""

# Step 5: Install new version
echo "📥 Step 4: Installing new version..."
code --install-extension voight-dev.vsix --force
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Installation successful${NC}"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi
echo ""

# Step 6: Prompt to reload VS Code windows
echo "========================================="
echo -e "${YELLOW}⚠️  IMPORTANT: Reload VS Code windows${NC}"
echo "========================================="
echo ""
echo "The extension has been installed, but VS Code needs to reload to use it."
echo ""
echo "Please do ONE of the following:"
echo "  1. Run: code --reuse-window"
echo "  2. Press Cmd+Shift+P and run 'Developer: Reload Window' in each VS Code window"
echo "  3. Close and reopen all VS Code windows"
echo ""
echo -e "${GREEN}✅ Dev install complete!${NC}"
echo ""
