# Context Notes Storage Architecture

## Overview

The context notes storage system uses the **Repository Pattern** to abstract storage implementation. This allows easy switching between different storage backends (local, database, cloud) without changing business logic.

## Directory Structure

```
src/
├── storage/                         ← Infrastructure/Persistence layer
│   ├── IContextNotesRepository.ts   ← Interface (contract)
│   ├── VscodeWorkspaceRepository.ts ← Default implementation (local)
│   ├── RemoteRepository.ts          ← Template for remote storage
│   └── README.md                    ← This file
│
├── ui/
│   └── contextNotes.ts              ← Business logic (uses storage)
│
└── utils/
    └── logger.ts
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (UI components, commands, webviews)    │
└───────────────┬─────────────────────────┘
                │
                │ uses
                ↓
┌─────────────────────────────────────────┐
│        Business Logic Layer             │
│     ContextNotesManager                 │
│     (src/ui/contextNotes.ts)            │
└───────────────┬─────────────────────────┘
                │
                │ depends on (interface)
                ↓
┌─────────────────────────────────────────┐
│    Infrastructure/Persistence Layer     │
│         (src/storage/)                  │
│                                         │
│  Interface:                             │
│  └─ IContextNotesRepository             │
│                                         │
│  Implementations:                       │
│  ├─ VscodeWorkspaceRepository (default)│  ← SQLite-backed
│  ├─ RemoteRepository (template)        │  ← Database/API
│  └─ SqliteFileRepository (future)      │  ← Team-shared
└─────────────────────────────────────────┘
```

**Key Principles:**
- ✅ **Dependency Inversion**: Business logic depends on interface, not implementation
- ✅ **Separation of Concerns**: Storage logic separated from business logic
- ✅ **Open/Closed Principle**: Easy to add new storage backends without modifying existing code
- ✅ **Testability**: Can mock repository for unit tests

## Current Implementation

**VscodeWorkspaceRepository** (Default)
- **Storage**: VSCode Workspace State API (SQLite-backed)
- **Location**: `~/Library/Application Support/Code/User/workspaceStorage/`
- **Scope**: Per-workspace (isolated between projects)
- **Persistence**: Survives VSCode restarts and reboots
- **Syncing**: Local only (can enable with `setKeysForSync()`)
- **Size Limit**: ~5-10MB practical limit

## How to Switch Storage Backends

### Option 1: Use a Different Repository at Runtime

In `src/extension.ts`, pass a custom repository to ContextNotesManager:

```typescript
// Current (default):
contextNotesManager = new ContextNotesManager(context);

// Or with custom repository:
import { RemoteRepository } from './storage/RemoteRepository';
const remoteRepo = new RemoteRepository('https://api.example.com', 'your-api-key');
contextNotesManager = new ContextNotesManager(context, remoteRepo);
```

### Option 2: Use Configuration to Choose Backend

Add to `package.json`:

```json
{
  "configuration": {
    "properties": {
      "voight.storage.backend": {
        "type": "string",
        "enum": ["local", "remote", "sqlite-file"],
        "default": "local",
        "description": "Storage backend for context notes"
      },
      "voight.storage.remote.url": {
        "type": "string",
        "description": "Remote API URL (when using remote backend)"
      }
    }
  }
}
```

Then in `src/extension.ts`:

```typescript
const config = vscode.workspace.getConfiguration('voight.storage');
const backend = config.get<string>('backend', 'local');

let repository: IContextNotesRepository;
switch (backend) {
    case 'remote':
        const url = config.get<string>('remote.url', '');
        repository = new RemoteRepository(url);
        break;
    case 'sqlite-file':
        repository = new SqliteFileRepository(workspaceRoot);
        break;
    default:
        repository = new VscodeWorkspaceRepository(context);
}

contextNotesManager = new ContextNotesManager(context, repository);
```

## Implementing a New Storage Backend

### Step 1: Create Repository Class

Create a new file: `src/storage/YourRepository.ts`

```typescript
import { IContextNotesRepository } from './IContextNotesRepository';
import { ContextNote } from '../ui/contextNotes';

export class YourRepository implements IContextNotesRepository {
    async initialize(): Promise<void> {
        // Connect to your storage (database, API, etc.)
    }

    async save(note: ContextNote): Promise<void> {
        // Save note to your storage
    }

    async get(filePath: string, startLine: number, endLine: number): Promise<ContextNote | undefined> {
        // Fetch note from your storage
    }

    // ... implement all other methods from IContextNotesRepository
}
```

### Step 2: Register in Extension

Update `src/extension.ts`:

```typescript
import { YourRepository } from './storage/YourRepository';

const yourRepo = new YourRepository(/* your config */);
contextNotesManager = new ContextNotesManager(context, yourRepo);
```

## Example: PostgreSQL Backend

Here's how you'd implement a PostgreSQL backend:

### 1. Install Dependencies

```bash
pnpm add pg
pnpm add -D @types/pg
```

### 2. Create Schema

```sql
CREATE TABLE context_notes (
    id SERIAL PRIMARY KEY,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    note TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE(file_path, start_line, end_line)
);

CREATE INDEX idx_context_notes_file_path ON context_notes(file_path);
CREATE INDEX idx_context_notes_range ON context_notes(file_path, start_line, end_line);
```

### 3. Implement Repository

```typescript
import { Pool } from 'pg';
import { IContextNotesRepository } from './IContextNotesRepository';
import { ContextNote } from '../ui/contextNotes';

export class PostgresRepository implements IContextNotesRepository {
    private _pool: Pool;

    constructor(connectionString: string) {
        this._pool = new Pool({ connectionString });
    }

    async initialize(): Promise<void> {
        await this._pool.connect();
    }

    async save(note: ContextNote): Promise<void> {
        await this._pool.query(`
            INSERT INTO context_notes (file_path, start_line, end_line, note, tags, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (file_path, start_line, end_line)
            DO UPDATE SET note = $4, tags = $5, updated_at = $7
        `, [note.filePath, note.startLine, note.endLine, note.note, note.tags, note.createdAt, note.updatedAt]);
    }

    async get(filePath: string, startLine: number, endLine: number): Promise<ContextNote | undefined> {
        const result = await this._pool.query(
            'SELECT * FROM context_notes WHERE file_path = $1 AND start_line = $2 AND end_line = $3',
            [filePath, startLine, endLine]
        );
        return result.rows[0] || undefined;
    }

    // ... implement other methods
}
```

## Example: Team-Shared SQLite File

For teams who want to version-control their context notes:

```typescript
export class SqliteFileRepository implements IContextNotesRepository {
    private _dbPath: string;

    constructor(workspaceRoot: string) {
        // Store database in workspace root (.voight/notes.db)
        this._dbPath = path.join(workspaceRoot, '.voight', 'notes.db');
    }

    async initialize(): Promise<void> {
        // Create .voight directory if it doesn't exist
        // Initialize SQLite database
        // Run migrations
    }

    // ... implement all methods using SQLite queries
}
```

Then add `.voight/notes.db` to Git for team sharing!

## API Reference

See [IContextNotesRepository.ts](./IContextNotesRepository.ts) for the complete interface definition.

### Key Methods

- `initialize()` - Connect to storage backend
- `save(note)` - Save or update a note
- `get(filePath, startLine, endLine)` - Retrieve a specific note
- `getByFile(filePath)` - Get all notes for a file
- `getAll()` - Get all notes across all files
- `search(query)` - Full-text search across notes
- `export()` - Export all notes (for backup)
- `import(data)` - Import notes (for restore)

## Migration Guide

### Exporting from Current Storage

```typescript
const notes = await contextNotesManager._repository.export();
await fs.writeFile('backup.json', JSON.stringify(notes, null, 2));
```

### Importing to New Storage

```typescript
const data = JSON.parse(await fs.readFile('backup.json', 'utf-8'));
await newRepository.import(data);
```

## Best Practices

1. **Always implement `export()` and `import()`** - This enables data migration
2. **Use transactions** - When using databases, wrap multi-step operations in transactions
3. **Handle errors gracefully** - All repository methods can throw errors
4. **Add logging** - Use `Logger.debug()` for debugging storage operations
5. **Test with large datasets** - Ensure performance scales with thousands of notes

## Future Considerations

- **Cloud Sync**: Implement sync logic in repository layer
- **Conflict Resolution**: Handle concurrent edits from multiple users/machines
- **Caching**: Add in-memory cache layer for frequently accessed notes
- **Compression**: Compress large note text before storage
- **Encryption**: Add encryption for sensitive notes
