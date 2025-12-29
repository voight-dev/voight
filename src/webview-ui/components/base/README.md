# Base Components

Reusable UI building blocks for the Voight extension. These components follow VSCode's design language and are built with accessibility and user experience in mind.

## Components

### Card
A flexible container component with header, body, and footer sections.

```typescript
import { Card, CardHeader, CardBody, CardFooter } from './base';

// Simple card
const card = new Card({
    interactive: true,
    padding: 'medium'
});

card.setContent('Simple content');

// Card with header, body, and footer
const header = new CardHeader()
    .setTitle('Function: calculateComplexity')
    .setSubtitle('complexity.ts:42-89');

const body = new CardBody()
    .setContent('This function calculates cyclomatic complexity...');

const footer = new CardFooter()
    .setContent('Complexity: 15 | Lines: 47');

card
    .appendChild(header.getElement())
    .appendChild(body.getElement())
    .appendChild(footer.getElement());

document.body.appendChild(card.getElement());
```

### Badge
A small status indicator or label.

```typescript
import { Badge } from './base';

// Status badge
const badge = new Badge('HIGH', {
    variant: 'error'
});

// Variants: 'default' | 'info' | 'success' | 'warning' | 'error'

// Dynamic badge
const statusBadge = new Badge('Loading', { variant: 'info' });
// Later...
statusBadge.setText('Complete').setVariant('success');
```

### Button
A reusable button component with multiple variants.

```typescript
import { Button } from './base';

// Primary button
const saveBtn = new Button('Save Changes', {
    variant: 'primary',
    icon: 'codicon-save'
});

saveBtn.addEventListener('click', () => {
    console.log('Saving...');
});

// Secondary button
const cancelBtn = new Button('Cancel', {
    variant: 'secondary'
});

// Icon button
const refreshBtn = new Button('', {
    variant: 'icon',
    icon: 'codicon-refresh',
    title: 'Refresh'
});

// Loading state
saveBtn.setLoading(true);
// Later...
saveBtn.setLoading(false);
```

### IconButton
A compact icon-only button for toolbars and action areas.

```typescript
import { IconButton } from './base';

const closeBtn = new IconButton({
    icon: 'codicon-close',
    title: 'Close'
});

const editBtn = new IconButton({
    icon: 'codicon-edit',
    title: 'Edit segment'
});

editBtn.addEventListener('click', () => {
    console.log('Edit clicked');
});

// Variants
const deleteBtn = new IconButton({
    icon: 'codicon-trash',
    title: 'Delete'
});
deleteBtn.addClass('vk-icon-button--danger');
```

### Collapse
A collapsible container component with smooth animations.

```typescript
import { Collapse } from './base';

const section = new Collapse('Details', {
    collapsed: false,
    animate: true
});

section.setContent(`
    <p>This is the detailed content that can be collapsed.</p>
    <p>It supports HTML content.</p>
`);

// Or append elements
const list = document.createElement('ul');
list.innerHTML = '<li>Item 1</li><li>Item 2</li>';
section.appendChild(list);

// Programmatic control
section.collapse();
section.expand();
section.toggle();

// Check state
if (section.isCollapsed()) {
    console.log('Section is collapsed');
}
```

## Complete Example: Segment Card

Here's how to compose these components into a complete segment card:

```typescript
import {
    Card, CardHeader, CardBody,
    Badge, Button, IconButton, Collapse
} from './base';

function createSegmentCard(segment: any) {
    // Main card
    const card = new Card({
        interactive: true,
        padding: 'none',
        dataAttributes: {
            segmentId: segment.id
        }
    });

    // Header with title, badges, and actions
    const header = new CardHeader()
        .setTitle(`Function: ${segment.name}`)
        .setSubtitle(`${segment.fileName}:${segment.startLine}-${segment.endLine}`);

    // Add complexity badge
    const complexityBadge = new Badge(
        segment.complexity > 10 ? 'HIGH' : 'NORMAL',
        {
            variant: segment.complexity > 10 ? 'error' : 'success'
        }
    );
    header.addAction(complexityBadge.getElement());

    // Add action buttons
    const explainBtn = new IconButton({
        icon: 'codicon-sparkle',
        title: 'Explain with AI'
    });
    explainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        explainSegment(segment.id);
    });
    header.addAction(explainBtn.getElement());

    const editBtn = new IconButton({
        icon: 'codicon-edit',
        title: 'Edit segment'
    });
    header.addAction(editBtn.getElement());

    // Body with collapsible sections
    const body = new CardBody();

    // Metrics section
    const metricsCollapse = new Collapse('Metrics', { collapsed: false });
    metricsCollapse.setContent(`
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div>
                <strong>Complexity:</strong> ${segment.complexity}
            </div>
            <div>
                <strong>Lines:</strong> ${segment.endLine - segment.startLine}
            </div>
            <div>
                <strong>Parameters:</strong> ${segment.paramCount}
            </div>
            <div>
                <strong>Nesting:</strong> ${segment.maxNesting}
            </div>
        </div>
    `);
    body.appendChild(metricsCollapse.getElement());

    // AI Explanation section (if available)
    if (segment.explanation) {
        const explanationCollapse = new Collapse('AI Explanation', { collapsed: true });
        explanationCollapse.setContent(segment.explanation);
        body.appendChild(explanationCollapse.getElement());
    }

    // Footer with actions
    const footer = new CardFooter();

    const viewCodeBtn = new Button('View Code', {
        variant: 'secondary',
        icon: 'codicon-code'
    });
    viewCodeBtn.addEventListener('click', () => {
        showCodePreview(segment);
    });

    footer.appendChild(viewCodeBtn.getElement());

    // Assemble card
    card
        .appendChild(header.getElement())
        .appendChild(body.getElement())
        .appendChild(footer.getElement());

    return card;
}

// Usage
const segment = {
    id: 'seg-123',
    name: 'calculateComplexity',
    fileName: 'complexity.ts',
    startLine: 42,
    endLine: 89,
    complexity: 15,
    paramCount: 3,
    maxNesting: 4,
    explanation: 'This function calculates...'
};

const segmentCard = createSegmentCard(segment);
document.getElementById('segments-container')?.appendChild(
    segmentCard.getElement()
);
```

## Styling

All components use VSCode's native CSS variables and follow the design system. Import the base styles:

```html
<link rel="stylesheet" href="./styles/base/index.css">
```

Or in your bundler:

```typescript
import './styles/base/index.css';
```

## Design Principles

1. **VSCode-Native**: Uses VSCode color variables and design patterns
2. **Accessible**: Keyboard navigation, ARIA labels, focus indicators
3. **Composable**: Small, focused components that work together
4. **Fluent API**: Chainable methods for clean, readable code
5. **Type-Safe**: Full TypeScript support with proper types
6. **Minimal Dependencies**: Pure TypeScript and CSS, no framework required
