# Voight UI Components Demo

Live preview of all base components with hot-reloadable styles.

## Quick Start

### Option 1: VS Code Live Server (Recommended)

1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code
2. Right-click on `index.html` → "Open with Live Server"
3. Your browser will open at `http://localhost:5500/src/webview-ui/demo/`

**Benefits:**
- Auto-refresh on file changes
- No build step needed
- Instant feedback when editing CSS

### Option 2: Python HTTP Server

```bash
# From the project root
cd src/webview-ui/demo
python3 -m http.server 8000
```

Then open: http://localhost:8000

### Option 3: Any Static Server

Use any static file server of your choice. The demo is just HTML/CSS/JS.

## How to Use

### Making Style Changes

1. **Edit Component Styles**: Modify files in `src/webview-ui/styles/base/`
   - [card.css](../styles/base/card.css)
   - [badge.css](../styles/base/badge.css)
   - [button.css](../styles/base/button.css)
   - [collapse.css](../styles/base/collapse.css)
   - [icon-button.css](../styles/base/icon-button.css)

2. **Edit Theme Variables**: Modify [vscode-theme.css](./vscode-theme.css)
   - Adjust colors, spacing, borders
   - Customize dark/light theme palettes

3. **Edit Demo Layout**: Modify [demo.css](./demo.css)
   - Change grid layouts, spacing
   - Adjust responsive breakpoints

4. **Refresh Browser**: Changes appear instantly (with Live Server, it's automatic!)

### Testing Components

- **Theme Toggle**: Click "Toggle Theme" button to see light/dark modes
- **Interactive Elements**: Click buttons, badges, and cards to test interactions
- **Collapse Sections**: Click headers to expand/collapse sections
- **Responsive Design**: Resize browser to test different viewports

## File Structure

```
demo/
├── index.html           # Main demo page
├── demo.css             # Demo layout styles
├── demo.js              # Component rendering logic
├── vscode-theme.css     # VSCode theme variables
└── README.md            # This file

../styles/base/          # Component styles (edit these!)
├── card.css
├── badge.css
├── button.css
├── collapse.css
├── icon-button.css
└── index.css
```

## Modular Design Philosophy

This demo follows a **plug-and-play** architecture:

### 1. Separation of Concerns
- **HTML** ([index.html](./index.html)): Structure only
- **CSS** (styles/): Visual styling only
- **JS** ([demo.js](./demo.js)): Behavior & composition only

### 2. Hot-Reloadable Styles
- Change any CSS file
- Refresh browser → See changes instantly
- No TypeScript compilation needed for styling

### 3. Component Independence
Each component has its own CSS file:
- Can be edited independently
- Can be loaded selectively
- No cross-dependencies

### 4. Theme System
VSCode variables in [vscode-theme.css](./vscode-theme.css):
```css
--vscode-editor-background
--vscode-button-background
--vscode-badge-background
```

Change these once → All components update automatically

### 5. Composable
Components are designed to nest:
```javascript
Card
├── CardHeader
│   ├── Badge
│   └── IconButton
├── CardBody
│   └── Collapse
└── CardFooter
    └── Button
```

## Workflow for Design Iteration

### Step 1: Open Demo
```bash
# Start Live Server
# Right-click index.html → Open with Live Server
```

### Step 2: Edit Styles
Open `src/webview-ui/styles/base/card.css`:
```css
.vk-card {
    border-radius: 8px;  /* Change from 4px */
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);  /* Add shadow */
}
```

### Step 3: See Changes
Browser auto-refreshes → Changes visible immediately

### Step 4: Iterate
Keep editing styles until satisfied → No build step needed

### Step 5: Integrate
Once happy with styles, the TypeScript components automatically use the same CSS classes!

## Tips

1. **Use Browser DevTools**: Inspect elements and test CSS changes live
2. **Toggle Theme Often**: Make sure styles work in both dark/light modes
3. **Test Interactions**: Hover, click, focus states matter
4. **Check Responsive**: Test on different screen sizes
5. **Compare to GitLens**: Reference GitLens extension for inspiration

## Next Steps

Once you're happy with the component styles:

1. The TypeScript components ([../components/base/](../components/base/)) already use these CSS classes
2. No changes needed to `.ts` files when you update styles
3. Components will automatically look correct in the actual extension

This is **true separation**: Style changes never require code changes!
