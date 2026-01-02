#!/usr/bin/env node

/**
 * Voight Release Script
 *
 * Usage:
 *   node scripts/release.js patch       # 0.0.5 -> 0.0.6
 *   node scripts/release.js minor       # 0.0.5 -> 0.1.0
 *   node scripts/release.js major       # 0.0.5 -> 1.0.0
 *   node scripts/release.js 0.2.0       # Manual override to specific version
 *   node scripts/release.js --dry-run patch  # Preview without making changes
 *
 * This script:
 *   1. Updates version in package.json
 *   2. Builds production vsix
 *   3. Creates git commit with version bump
 *   4. Creates git tag (v0.0.6)
 *   5. Pushes commit and tag to origin
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter(arg => arg !== '--dry-run');
const versionArg = filteredArgs[0];

if (!versionArg) {
    console.error('Usage: node scripts/release.js [--dry-run] <patch|minor|major|x.y.z>');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/release.js patch       # 0.0.5 -> 0.0.6');
    console.error('  node scripts/release.js minor       # 0.0.5 -> 0.1.0');
    console.error('  node scripts/release.js major       # 0.0.5 -> 1.0.0');
    console.error('  node scripts/release.js 0.2.0       # Set specific version');
    console.error('  node scripts/release.js --dry-run patch  # Preview changes');
    process.exit(1);
}

function readPackageJson() {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
}

function writePackageJson(pkg) {
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`Invalid version format: ${version}`);
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10)
    };
}

function formatVersion(v) {
    return `${v.major}.${v.minor}.${v.patch}`;
}

function bumpVersion(currentVersion, bumpType) {
    const v = parseVersion(currentVersion);

    switch (bumpType) {
        case 'patch':
            v.patch++;
            break;
        case 'minor':
            v.minor++;
            v.patch = 0;
            break;
        case 'major':
            v.major++;
            v.minor = 0;
            v.patch = 0;
            break;
        default:
            // Assume it's a specific version string
            return bumpType;
    }

    return formatVersion(v);
}

function exec(command, options = {}) {
    console.log(`  $ ${command}`);
    if (!dryRun || options.allowInDryRun) {
        try {
            return execSync(command, {
                encoding: 'utf-8',
                stdio: options.silent ? 'pipe' : 'inherit',
                cwd: path.join(__dirname, '..')
            });
        } catch (error) {
            if (!options.ignoreError) {
                throw error;
            }
            return '';
        }
    }
    return '';
}

function checkGitStatus() {
    const status = execSync('git status --porcelain', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
    }).trim();

    if (!status) return;

    // Files that are allowed to have changes (will be committed or are build artifacts)
    const allowedPatterns = [
        'package.json',
        'pnpm-lock.yaml',
        'dist/',           // Build output
        'scripts/release', // Release script itself
        '.vsix',           // Built packages
        'README.md'        // Documentation updates
    ];

    const nonAllowedChanges = status.split('\n')
        .filter(line => line.trim())
        .filter(line => !allowedPatterns.some(pattern => line.includes(pattern)));

    if (nonAllowedChanges.length > 0) {
        console.error('Error: Working directory has uncommitted changes:');
        console.error(nonAllowedChanges.join('\n'));
        console.error('\nPlease commit or stash changes before releasing.');
        process.exit(1);
    }
}

function checkGitBranch() {
    const branch = execSync('git branch --show-current', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
    }).trim();

    if (branch !== 'main' && branch !== 'master') {
        console.warn(`Warning: You are on branch '${branch}', not 'main' or 'master'.`);
        console.warn('Press Ctrl+C within 5 seconds to cancel...\n');
        execSync('sleep 5');
    }
}

async function main() {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║         Voight Release Script          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Read current version
    const pkg = readPackageJson();
    const currentVersion = pkg.version;
    const newVersion = bumpVersion(currentVersion, versionArg);

    // Validate new version
    parseVersion(newVersion); // Throws if invalid

    console.log(`📦 Current version: ${currentVersion}`);
    console.log(`📦 New version:     ${newVersion}`);
    console.log('');

    // Pre-flight checks
    console.log('🔍 Running pre-flight checks...');
    checkGitStatus();
    checkGitBranch();
    console.log('   ✓ Git status clean');
    console.log('');

    // Step 1: Update package.json
    console.log('📝 Step 1: Updating package.json...');
    if (!dryRun) {
        pkg.version = newVersion;
        writePackageJson(pkg);
    }
    console.log(`   ✓ Updated version to ${newVersion}`);
    console.log('');

    // Step 2: Build production vsix
    console.log('🔨 Step 2: Building production vsix...');
    exec('pnpm run package:prod');
    console.log(`   ✓ Built voight-${newVersion}-prod.vsix`);
    console.log('');

    // Step 3: Git commit
    console.log('📝 Step 3: Creating git commit...');
    exec('git add package.json');
    exec('git add README.md', { ignoreError: true }); // Include if changed
    exec(`git commit -m "chore(release): v${newVersion}"`);
    console.log(`   ✓ Committed version bump`);
    console.log('');

    // Step 4: Create git tag
    console.log('🏷️  Step 4: Creating git tag...');
    exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`   ✓ Created tag v${newVersion}`);
    console.log('');

    // Step 5: Push to origin
    console.log('🚀 Step 5: Pushing to origin...');
    exec('git push origin');
    exec('git push origin --tags');
    console.log('   ✓ Pushed commit and tags');
    console.log('');

    // Done
    console.log('════════════════════════════════════════');
    console.log('');
    if (dryRun) {
        console.log('✅ Dry run complete! No changes were made.');
        console.log('   Run without --dry-run to perform the release.');
    } else {
        console.log(`✅ Released v${newVersion} successfully!`);
        console.log('');
        console.log('   Next steps:');
        console.log(`   1. Upload voight-${newVersion}-prod.vsix to VS Code Marketplace`);
        console.log(`   2. Create GitHub release for tag v${newVersion}`);
    }
    console.log('');
}

main().catch(error => {
    console.error('');
    console.error('❌ Release failed:', error.message);
    process.exit(1);
});
