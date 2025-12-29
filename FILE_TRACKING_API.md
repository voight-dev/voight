# File Tracking API Documentation

The File Tracking feature automatically tracks and ranks files based on AI edit frequency. This backend system provides comprehensive tracking, ranking, and analysis capabilities.

## Overview

Every time the AI edits a file (detected as a code block/segment), the system:
1. Records the edit with timestamp and line range
2. Updates the file's edit count and total lines changed
3. Maintains rankings across all tracked files
4. Emits real-time events for integration

## Core Service: `FileTrackingService`

### Initialization

```typescript
import { FileTrackingService } from './tracking/fileTracker';

const fileTrackingService = new FileTrackingService(context);
```

The service automatically persists data to VSCode Workspace State (SQLite-backed).

---

## Data Models

### `FileTrackingData`
Complete tracking information for a single file:

```typescript
interface FileTrackingData {
    filePath: string;              // Absolute file path
    editCount: number;             // Total AI edits
    firstEditedAt: string;         // ISO timestamp
    lastEditedAt: string;          // ISO timestamp
    totalLinesChanged: number;     // Cumulative lines changed
    edits: EditRecord[];           // Individual edit history
}
```

### `EditRecord`
Individual edit record:

```typescript
interface EditRecord {
    timestamp: string;             // ISO timestamp
    startLine: number;             // 0-indexed
    endLine: number;               // 0-indexed
    linesChanged: number;          // endLine - startLine + 1
    complexityScore?: number;      // 1-10 if available
}
```

### `RankedFile`
Simplified ranking entry:

```typescript
interface RankedFile {
    filePath: string;
    rank: number;                  // 1-based ranking
    editCount: number;
    totalLinesChanged: number;
    firstEditedAt: string;
    lastEditedAt: string;
}
```

### `FileEditEvent`
Real-time event payload:

```typescript
interface FileEditEvent {
    filePath: string;
    editCount: number;             // Updated count after this edit
    timestamp: string;             // ISO timestamp
    linesChanged: number;          // Lines in this specific edit
}
```

---

## API Methods

### Recording Edits

#### `recordEdit()`
Records a new AI edit for a file.

```typescript
await fileTrackingService.recordEdit(
    filePath: string,
    startLine: number,
    endLine: number,
    complexityScore?: number
): Promise<void>
```

**Parameters:**
- `filePath`: Absolute path to the file
- `startLine`: Starting line (0-indexed)
- `endLine`: Ending line (0-indexed, inclusive)
- `complexityScore`: Optional complexity score (1-10)

**Example:**
```typescript
await fileTrackingService.recordEdit(
    '/path/to/file.ts',
    10,
    25,
    7.5
);
```

---

### Retrieving Rankings

#### `getRankedFiles()`
Get all tracked files sorted by edit count (descending).

```typescript
const ranked: RankedFile[] = await fileTrackingService.getRankedFiles();
```

**Returns:** Array of `RankedFile` sorted by `editCount` descending, with ranks 1, 2, 3, etc.

**Example:**
```typescript
const ranked = await fileTrackingService.getRankedFiles();
console.log(`Top file: ${ranked[0].filePath} with ${ranked[0].editCount} edits`);
```

---

#### `getTopFiles(limit)`
Get top N most edited files.

```typescript
const topFiles: RankedFile[] = await fileTrackingService.getTopFiles(limit: number);
```

**Parameters:**
- `limit`: Number of top files to return

**Example:**
```typescript
const top10 = await fileTrackingService.getTopFiles(10);
```

---

### File-Specific Data

#### `getFileData(filePath)`
Get complete tracking data for a specific file.

```typescript
const data: FileTrackingData | undefined = await fileTrackingService.getFileData(filePath: string);
```

**Returns:** `FileTrackingData` if file has been tracked, `undefined` otherwise.

**Example:**
```typescript
const data = await fileTrackingService.getFileData('/path/to/file.ts');
if (data) {
    console.log(`This file has ${data.editCount} edits`);
    console.log(`Edit history:`, data.edits);
}
```

---

### Statistics

#### `getStatistics()`
Get aggregate statistics across all tracked files.

```typescript
const stats = await fileTrackingService.getStatistics();
```

**Returns:**
```typescript
{
    totalFiles: number;           // Number of tracked files
    totalEdits: number;           // Sum of all edits
    totalLinesChanged: number;    // Sum of all lines changed
    mostEditedFile?: RankedFile;  // Top ranked file
}
```

**Example:**
```typescript
const stats = await fileTrackingService.getStatistics();
console.log(`Tracking ${stats.totalFiles} files`);
console.log(`Total AI edits: ${stats.totalEdits}`);
console.log(`Most edited: ${stats.mostEditedFile?.filePath}`);
```

---

### Export & Data Management

#### `exportToJson()`
Export rankings as JSON string.

```typescript
const json: string = await fileTrackingService.exportToJson();
```

**Returns:** Pretty-printed JSON string of `RankedFile[]`.

**Example:**
```typescript
const json = await fileTrackingService.exportToJson();
await fs.writeFile('rankings.json', json);
```

---

#### `clearAll()`
Clear all tracking data.

```typescript
await fileTrackingService.clearAll();
```

---

#### `clearFile(filePath)`
Clear tracking data for a specific file.

```typescript
await fileTrackingService.clearFile(filePath: string);
```

---

### Real-Time Events

#### `onFileEdited`
Event emitted when a file is edited.

```typescript
const listener: vscode.Disposable = fileTrackingService.onFileEdited(
    (event: FileEditEvent) => {
        console.log(`File edited: ${event.filePath}`);
        console.log(`Total edits: ${event.editCount}`);
        console.log(`Lines in this edit: ${event.linesChanged}`);
    }
);

// Dispose when done
listener.dispose();
```

**Use Cases:**
- Real-time UI updates
- Analytics dashboards
- External tool integration
- Logging and monitoring

---

## VSCode Commands

The following commands are automatically registered:

### `voight.getTopEditedFiles`
Interactive command to view and navigate to top edited files.

**Usage:** Command Palette → "Voight: Show Top Edited Files"

**Features:**
- Prompts for number of files to show
- Displays ranked list with edit counts
- Click to open file

---

### `voight.showFileTrackingStats`
Shows aggregate statistics notification.

**Usage:** Command Palette → "Voight: Show File Tracking Statistics"

**Displays:**
- Total files tracked
- Total AI edits
- Total lines changed
- Most edited file

---

### `voight.exportFileRankings`
Exports rankings to JSON file.

**Usage:** Command Palette → "Voight: Export File Rankings"

**Features:**
- Save dialog to choose location
- Exports all `RankedFile` data as JSON

---

### `voight.getCurrentFileTracking`
Shows tracking data for currently active file.

**Usage:** Command Palette → "Voight: Show Current File Tracking"

**Displays:**
- Rank among all tracked files
- Edit count
- Total lines changed
- First and last edit timestamps

---

### `voight.clearFileTracking`
Clears all tracking data with confirmation.

**Usage:** Command Palette → "Voight: Clear File Tracking Data"

---

## Integration Example

### Custom Plugin Integration

```typescript
import { FileTrackingService } from './tracking/fileTracker';

class MyCustomPlugin {
    constructor(private trackingService: FileTrackingService) {
        // Listen to real-time events
        this.trackingService.onFileEdited(this.onFileEdited.bind(this));
    }

    async onFileEdited(event: FileEditEvent) {
        // Send to external analytics
        await this.sendToAnalytics({
            file: event.filePath,
            count: event.editCount,
            timestamp: event.timestamp
        });

        // Check if file needs attention
        if (event.editCount > 50) {
            vscode.window.showWarningMessage(
                `${event.filePath} has been edited ${event.editCount} times. Consider reviewing.`
            );
        }
    }

    async generateReport() {
        const stats = await this.trackingService.getStatistics();
        const top10 = await this.trackingService.getTopFiles(10);

        return {
            summary: stats,
            topFiles: top10,
            timestamp: new Date().toISOString()
        };
    }
}
```

---

## Storage Details

### Location
Data is stored in VSCode Workspace State under key `voight.fileTracking`.

### Structure
```typescript
{
    "voight.fileTracking": {
        "/absolute/path/to/file1.ts": FileTrackingData,
        "/absolute/path/to/file2.ts": FileTrackingData,
        ...
    }
}
```

### Persistence
- Survives VSCode restarts
- Workspace-specific (not global)
- Backed by SQLite
- Automatically saved on each edit

---

## Performance Considerations

### Scalability
- Optimized for typical projects (hundreds of files)
- In-memory rankings computed on-demand
- Efficient O(n log n) sorting for rankings

### Storage Size
Each tracked file uses approximately:
- Base metadata: ~200 bytes
- Each edit record: ~100 bytes

Example: 100 files with 10 edits each = ~100KB

### Recommendations
- Periodically export and clear data for long-term projects
- Use `clearFile()` to remove abandoned files
- Monitor storage with `getStatistics()`

---

## Example Workflows

### Weekly Review Report

```typescript
async function generateWeeklyReport() {
    const stats = await fileTrackingService.getStatistics();
    const top20 = await fileTrackingService.getTopFiles(20);

    const report = `
# Weekly AI Edit Report

## Summary
- Files tracked: ${stats.totalFiles}
- Total edits: ${stats.totalEdits}
- Lines changed: ${stats.totalLinesChanged}

## Top 20 Most Edited Files
${top20.map(f => `${f.rank}. ${f.filePath} - ${f.editCount} edits`).join('\n')}
    `;

    // Save or send report
    await fs.writeFile('weekly-report.md', report);
}
```

### Hot File Alert

```typescript
fileTrackingService.onFileEdited(async (event) => {
    if (event.editCount === 25) {
        const result = await vscode.window.showInformationMessage(
            `${event.filePath} has reached 25 AI edits. Generate review report?`,
            'Yes', 'No'
        );

        if (result === 'Yes') {
            const data = await fileTrackingService.getFileData(event.filePath);
            // Generate detailed report
        }
    }
});
```

---

## Future Enhancements

Potential additions (not yet implemented):
- Time-based rankings (edits per day/week)
- Weighted rankings by complexity
- File category grouping
- Edit pattern analysis
- Trend visualization

---

## API Summary Table

| Method | Purpose | Returns |
|--------|---------|---------|
| `recordEdit()` | Record new edit | `Promise<void>` |
| `getRankedFiles()` | Get all ranked files | `Promise<RankedFile[]>` |
| `getTopFiles(n)` | Get top N files | `Promise<RankedFile[]>` |
| `getFileData(path)` | Get file details | `Promise<FileTrackingData?>` |
| `getStatistics()` | Get aggregate stats | `Promise<Statistics>` |
| `exportToJson()` | Export rankings | `Promise<string>` |
| `clearAll()` | Clear all data | `Promise<void>` |
| `clearFile(path)` | Clear file data | `Promise<void>` |
| `onFileEdited` | Event listener | `Event<FileEditEvent>` |

---

## Questions?

For implementation details, see [fileTracker.ts](src/tracking/fileTracker.ts).

For integration example, see [extension.ts](src/extension.ts) lines 51-58 and 183-309.
