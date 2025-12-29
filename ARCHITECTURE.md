# Voight Architecture

## Overview

Voight is a VSCode extension that detects and highlights AI-generated code. The architecture is designed with clear separation of concerns, making it extensible and maintainable.

## Directory Structure

```
src/
├── detection/          # Core detection engine (business logic)
│   ├── changeDetector.ts       # Document diff and block detection
│   ├── pasteDetector.ts        # Paste operation heuristics
│   └── detectionCoordinator.ts # Orchestrates detection flow
├── ui/                 # User interface and visual feedback
│   ├── highlighter.ts          # Visual highlighting system
│   ├── blockManager.ts         # Block lifecycle management
│   └── plugins/                # Action plugins for blocks
│       ├── reviewPlugin.ts
│       └── analyzePlugin.ts
├── debug/              # Debug utilities (logging, output)
│   └── debugLogger.ts          # JSON output for debugging
├── utils/              # Shared utilities
│   └── logger.ts               # Logging utility
├── commands/           # VSCode commands
│   └── health.ts               # Health check command
└── extension.ts        # Extension entry point
```

## Core Components

### 1. Detection Layer (`src/detection/`)

The detection layer is responsible for analyzing document changes and identifying AI-generated code blocks.

#### **ChangeDetector** (`changeDetector.ts`)
- **Purpose**: Core detection engine that analyzes document changes
- **Responsibilities**:
  - Maintains shadow state of documents for diff analysis
  - Uses Myers diff algorithm to detect changed lines
  - Groups changed lines into contiguous ranges
  - Expands ranges to semantic boundaries (functions, classes)
  - Merges overlapping ranges to prevent duplicates
- **Key Methods**:
  - `initializeDocument()` - Start tracking a document
  - `detectChanges()` - Analyze and return detected blocks
  - Configuration-aware semantic expansion (none/minimal/balanced/maximum)

#### **PasteDetector** (`pasteDetector.ts`)
- **Purpose**: Heuristics-based paste detection
- **Responsibilities**:
  - Analyzes content changes to determine if they're paste operations
  - Uses multiple heuristics: size, timing, multi-line, complete statements
- **Heuristics**:
  - Large insertions (>50 chars)
  - Multi-line changes (≥2 lines)
  - Rapid succession (<10ms)
  - Complete programming statements

#### **DetectionCoordinator** (`detectionCoordinator.ts`)
- **Purpose**: Orchestrates the detection flow
- **Responsibilities**:
  - Coordinates between ChangeDetector and PasteDetector
  - Integrates with UI (BlockManager) for visual feedback
  - Integrates with DebugLogger for debugging output
  - Provides unified API for the extension
- **Entry Point**: `analyzeEvent()` - Main method for processing document changes

### 2. UI Layer (`src/ui/`)

The UI layer handles visual feedback and user interactions.

#### **Highlighter** (`highlighter.ts`)
- **Purpose**: Visual highlighting system with state-based decorations
- **Features**:
  - State-based coloring (DETECTED, REVIEWED, FLAGGED, ACCEPTED, DISMISSED)
  - Configurable colors and borders per state
  - Plugin system for extensible actions
  - Automatic refresh on editor changes

#### **BlockManager** (`blockManager.ts`)
- **Purpose**: Bridge between detection backend and UI
- **Responsibilities**:
  - Manages lifecycle of detected blocks
  - Provides state transition methods
  - Tracks statistics
  - Executes action plugins

#### **Action Plugins** (`plugins/`)
- **Purpose**: Extensible actions on detected blocks
- **Interface**: `BlockActionPlugin`
  - `name`: Display name
  - `canHandle()`: Check if plugin can handle a block
  - `execute()`: Perform action on block
- **Built-in Plugins**:
  - **ReviewPlugin**: Mark blocks as reviewed
  - **AnalyzePlugin**: Analyze code quality/characteristics

### 3. Debug Layer (`src/debug/`)

The debug layer provides utilities for development and analysis.

#### **DebugLogger** (`debugLogger.ts`)
- **Purpose**: Log detection events to JSON files for debugging
- **Outputs**:
  - `paste-events-{timestamp}.json` - All content changes with metadata
  - `solution_{timestamp}.json` - Detected blocks with code
- **Features**:
  - Incremental saving
  - Statistics tracking
  - Timestamped sessions

### 4. Extension Entry Point (`extension.ts`)

Wires all components together and registers VSCode commands.

**Initialization Flow**:
1. Initialize UI layer (Highlighter → BlockManager → Plugins)
2. Initialize debug logger
3. Create DetectionCoordinator with UI and debug integration
4. Register document listeners
5. Register commands

**Commands**:
- `voight.healthCheck` - System health check
- `voight.showStats` - Paste detection statistics
- `voight.showBlockStats` - Block state statistics
- `voight.clearBlocks` - Clear all highlighted blocks
- `voight.showCurrentFileBlocks` - Show blocks in active file

## Data Flow

### Change Detection Flow

```
User pastes code
    ↓
Document Change Event
    ↓
DetectionCoordinator.analyzeEvent()
    ↓
PasteDetector checks if paste → isPasted?
    ↓ (yes)
ChangeDetector.detectChanges()
    ↓
1. Diff with shadow state (Myers algorithm)
2. Group changed lines into ranges
3. Expand to semantic boundaries
4. Merge overlapping ranges
    ↓
Detected Blocks (with metadata)
    ↓
├── BlockManager.registerDetectedBlock() → UI highlighting
└── DebugLogger.recordBlocks() → JSON output
```

## Configuration

Users can configure detection behavior via VSCode settings:

### `voight.detection.semanticExpansion`
Controls context inclusion around detected changes:
- **`none`**: No expansion - exact changed lines only
- **`minimal`**: Up to 5 lines of context
- **`balanced`** (default): Up to 15 lines of context
- **`maximum`**: Up to 30 lines of context

### `voight.highlighting.showContextBorder`
Future: Show different border style for expanded context vs actual changes

## Block Metadata

Each detected block includes rich metadata:

```typescript
{
  startLine: number          // Expanded range start
  endLine: number            // Expanded range end
  coreChangeStart: number    // Actual changed lines start
  coreChangeEnd: number      // Actual changed lines end
  code: string               // Full code text
  timestamp: string          // Detection time
  expandedContext: boolean   // Was semantic expansion applied?
}
```

This metadata enables:
- Precise vs contextual highlighting
- Smart quiz questions focusing on actual changes
- Context-aware analysis plugins
- Future visual differentiation

## Extensibility Points

### 1. Action Plugins
Add new actions on detected blocks by implementing `BlockActionPlugin`:

```typescript
export class MyPlugin implements BlockActionPlugin {
    public readonly name = 'My Action';

    public canHandle(block: HighlightBlock): boolean {
        return true; // or conditional logic
    }

    public async execute(block: HighlightBlock): Promise<void> {
        // Your action logic
    }
}

// Register in extension.ts
blockManager.highlighter.registerActionPlugin(new MyPlugin());
```

### 2. Detection Heuristics
Add new paste detection heuristics in `PasteDetector.isPasted()`.

### 3. Semantic Expansion Rules
Customize boundary detection in `ChangeDetector._expandToSemanticBoundaries()`.

### 4. Block States
Add new states to `BlockState` enum and configure colors in `createDefaultHighlighter()`.

## Design Principles

1. **Separation of Concerns**
   - Detection logic separate from UI
   - Debug utilities separate from core functionality
   - Clear interfaces between layers

2. **Extensibility**
   - Plugin architecture for actions
   - Configuration-driven behavior
   - Rich metadata for future enhancements

3. **Maintainability**
   - Single Responsibility Principle
   - Clear module boundaries
   - Comprehensive type safety

4. **Performance**
   - Efficient Myers diff algorithm
   - Shadow state tracking (no re-parsing)
   - Lazy evaluation where possible

## Future Enhancements

- **Quiz Plugin**: Interactive quizzes on detected code
- **Security Analysis**: Scan for security vulnerabilities
- **Code Quality Metrics**: Analyze complexity, style violations
- **Visual Differentiation**: Different highlighting for core vs context
- **Machine Learning**: Improve detection accuracy with ML models
- **Multi-language Support**: Enhanced parsing for specific languages
