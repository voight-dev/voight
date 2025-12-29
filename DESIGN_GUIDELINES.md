# Voight Design Guidelines

## Visual Language

### Icons & Symbols

**NO EMOJIS** - Emojis are prohibited throughout the codebase for a professional appearance.

Instead, use:
- VSCode's built-in ThemeIcon system (`vscode.ThemeIcon`)
- SVG icons (stored in `/resources/`)
- Text labels with proper styling
- CSS pseudo-elements with text content

### Examples

❌ **Bad:**
```typescript
'new': '🆕 New',
'flagged': '⚠️ Flagged'
```

✅ **Good:**
```typescript
'new': 'New',
'flagged': 'Flagged'
```

❌ **Bad:**
```css
.banner::before {
    content: "🧪";
}
```

✅ **Good:**
```css
.banner::before {
    content: "[DEV]";
    font-weight: 700;
}
```

❌ **Bad:**
```typescript
console.log('📊 Loading data');
```

✅ **Good:**
```typescript
console.log('[Voight] Loading data');
```

### VSCode ThemeIcon Usage

When building tree views or UI elements, use VSCode's ThemeIcon system:

```typescript
// Activity bar icons
this.iconPath = new vscode.ThemeIcon('symbol-snippet');

// Common icons:
// - 'file' - file icon
// - 'folder' - folder icon
// - 'symbol-snippet' - code snippet
// - 'warning' - warning indicator
// - 'check' - checkmark
// - 'circle-filled' - status indicator
```

### Color & Theming

Always use VSCode CSS variables to ensure theme compatibility:

```css
/* Good - adapts to user's theme */
color: var(--vscode-foreground);
background-color: var(--vscode-editor-background);

/* Bad - hardcoded colors */
color: #000000;
background-color: white;
```

### Typography

- Use `var(--vscode-font-family)` for UI text
- Use `var(--vscode-editor-font-family)` for code/monospace text
- Avoid decorative fonts or excessive styling
- Keep hierarchy clear with font-weight and size, not color alone

## Console Logging

Prefix all console logs with `[Voight]` for easy filtering:

```typescript
console.log('[Voight] Operation completed');
console.error('[Voight] Failed to load:', error);
console.warn('[Voight] Deprecated feature used');
```

## General Principles

1. **Professional over Playful** - This is a developer tool, not a consumer app
2. **Native over Custom** - Use VSCode's design system whenever possible
3. **Accessible by Default** - Ensure all UI works with high contrast themes
4. **Consistent Spacing** - Use multiples of 4px for all spacing
5. **Clear Hierarchy** - Make information architecture obvious at a glance
