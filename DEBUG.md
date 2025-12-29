# Voight Debug Mode

The extension is now in **minimal debug mode**. All UI, tracking, and analysis features have been removed.

## What It Does

1. **Detects paste vs type** - Uses the same heuristics as before
2. **Records every change event** - Including insertions, deletions, and typing
3. **Saves to JSON file** - When you close the debug session (stop the extension)

## How to Use

1. Press `F5` to launch the extension in debug mode
2. Open a file and:
   - Type some code
   - Paste some code
   - Delete some code
   - Mix typing and pasting
3. Close the debug window (stop debugging)
4. Check your workspace folder for `.voight-debug/paste-events-TIMESTAMP.json`

## What You'll See in the JSON

```json
{
  "sessionStart": "2025-12-05T16:35:00.000Z",
  "sessionEnd": "2025-12-05T16:40:00.000Z",
  "totalEvents": 150,
  "pasteEvents": 12,
  "typeEvents": 138,
  "events": [
    {
      "timestamp": "2025-12-05T16:35:10.123Z",
      "file": "/path/to/file.ts",
      "detected": true,  // ← Was this detected as a paste?
      "detectionReason": "66 characters at once",

      // What changed
      "textLength": 66,
      "textPreview": "function hello() {\n  console.log(\"Hello\");\n}",

      // Where it happened
      "rangeStart": { "line": 10, "char": 0 },
      "rangeEnd": { "line": 10, "char": 0 },
      "rangeIsEmpty": true,  // ← Tells us if this was insertion vs replacement

      // Timing
      "timeSinceLastChange": 5432,  // milliseconds since last change
      "documentVersion": 42
    }
  ]
}
```

## Questions to Answer

### 1. What is the `change` parameter exactly?

Look at each event in the JSON:
- `textLength` - how many characters changed
- `textPreview` - what the actual text was
- `rangeStart` / `rangeEnd` - where it happened
- `rangeIsEmpty` - true for insertions, false for replacements/deletions

### 2. Are changes unique in real-time?

For Add, Delete, Add, Delete sequences:
- Each operation will be a separate event
- Check `documentVersion` - it increments for each change
- Check `timestamp` - shows exact timing
- Check `rangeIsEmpty` and `textLength`:
  - `rangeIsEmpty=true, textLength>0` = INSERTION (Add)
  - `rangeIsEmpty=false, textLength=0` = DELETION (Delete)
  - `rangeIsEmpty=false, textLength>0` = REPLACEMENT

## Command Available

- `Voight: Show Stats` - Shows quick stats in a notification

## Next Steps

Once you understand the JSON output, we can:
1. Improve paste detection heuristics
2. Add proper line number tracking
3. Re-add minimal UI if needed
