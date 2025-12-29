/**
 * Demo JavaScript
 * Renders all components using plain DOM manipulation
 * This mimics what the TypeScript components would generate
 */

// ===========================
// Theme Toggle
// ===========================
const themeToggleBtn = document.getElementById('theme-toggle-btn');
let currentTheme = 'vscode-dark';

themeToggleBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'vscode-dark' ? 'vscode-light' : 'vscode-dark';
    document.body.setAttribute('data-vscode-theme-kind', currentTheme);
});

// ===========================
// Cards Demo
// ===========================
const cardsContainer = document.getElementById('cards-demo');

// Simple card
const simpleCard = createCard({
    padding: 'medium',
    content: '<p style="margin: 0;">Simple card with basic content</p>'
});
cardsContainer.appendChild(simpleCard);

// Interactive card
const interactiveCard = createCard({
    padding: 'medium',
    interactive: true,
    content: '<p style="margin: 0;">Interactive card (hover & click me)</p>'
});
interactiveCard.addEventListener('click', () => {
    alert('Interactive card clicked!');
});
cardsContainer.appendChild(interactiveCard);

// Card with header, body, footer
const complexCard = createCard({
    padding: 'none',
    children: [
        createCardHeader({
            title: 'calculateComplexity',
            subtitle: 'complexity.ts:42-89',
            actions: [
                createBadge('HIGH', 'error'),
                createIconButton('sparkle', 'Explain with AI')
            ]
        }),
        createCardBody({
            content: `
                <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.6;">
                    This function calculates the cyclomatic complexity of a code segment
                    by analyzing control flow statements.
                </p>
            `
        }),
        createCardFooter({
            content: '<small style="color: var(--vscode-descriptionForeground);">Complexity: 15 • Lines: 47</small>'
        })
    ]
});
cardsContainer.appendChild(complexCard);

// ===========================
// Badges Demo
// ===========================
const badgesContainer = document.getElementById('badges-demo');

const badgeVariants = [
    { text: 'DEFAULT', variant: 'default' },
    { text: 'INFO', variant: 'info' },
    { text: 'SUCCESS', variant: 'success' },
    { text: 'WARNING', variant: 'warning' },
    { text: 'ERROR', variant: 'error' },
    { text: 'Complexity: 15', variant: 'error' },
    { text: 'Lines: 47', variant: 'info' },
    { text: 'Params: 3', variant: 'default' }
];

badgeVariants.forEach(({ text, variant }) => {
    badgesContainer.appendChild(createBadge(text, variant));
});

// ===========================
// Buttons Demo
// ===========================
const buttonsContainer = document.getElementById('buttons-demo');

const primaryBtn = createButton('Save Changes', {
    variant: 'primary',
    icon: 'save',
    onclick: () => alert('Primary button clicked!')
});
buttonsContainer.appendChild(primaryBtn);

const secondaryBtn = createButton('Cancel', {
    variant: 'secondary',
    onclick: () => alert('Secondary button clicked!')
});
buttonsContainer.appendChild(secondaryBtn);

const iconVariantBtn = createButton('Refresh', {
    variant: 'icon',
    icon: 'refresh',
    onclick: () => alert('Icon button clicked!')
});
buttonsContainer.appendChild(iconVariantBtn);

const loadingBtn = createButton('Loading...', {
    variant: 'primary',
    icon: 'sync'
});
loadingBtn.classList.add('vk-button--loading');
buttonsContainer.appendChild(loadingBtn);

// ===========================
// Icon Buttons Demo
// ===========================
const iconButtonsContainer = document.getElementById('icon-buttons-demo');

const iconButtons = [
    { icon: 'edit', title: 'Edit segment' },
    { icon: 'trash', title: 'Delete', danger: true },
    { icon: 'close', title: 'Close' },
    { icon: 'check', title: 'Confirm', success: true },
    { icon: 'sparkle', title: 'Explain with AI' },
    { icon: 'arrow-up', title: 'Move up' },
    { icon: 'arrow-down', title: 'Move down' },
    { icon: 'settings-gear', title: 'Settings' }
];

iconButtons.forEach(({ icon, title, danger, success }) => {
    const btn = createIconButton(icon, title);
    if (danger) btn.classList.add('vk-icon-button--danger');
    if (success) btn.classList.add('vk-icon-button--success');
    btn.addEventListener('click', () => alert(`${title} clicked!`));
    iconButtonsContainer.appendChild(btn);
});

// ===========================
// Collapse Demo
// ===========================
const collapseContainer = document.getElementById('collapse-demo');

const collapse1 = createCollapse('Metrics', {
    collapsed: false,
    content: `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px;">
            <div><strong>Complexity:</strong> 15</div>
            <div><strong>Lines:</strong> 47</div>
            <div><strong>Parameters:</strong> 3</div>
            <div><strong>Nesting:</strong> 4</div>
            <div><strong>Branches:</strong> 8</div>
            <div><strong>Returns:</strong> 2</div>
        </div>
    `
});
collapseContainer.appendChild(collapse1);

const collapse2 = createCollapse('Code Preview', {
    collapsed: true,
    content: `
        <pre style="background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; overflow-x: auto; margin: 0; font-size: 12px;"><code>function calculateComplexity(node: ts.Node): number {
    let complexity = 1;

    ts.forEachChild(node, (child) => {
        if (isDecisionPoint(child)) {
            complexity++;
        }
        complexity += calculateComplexity(child);
    });

    return complexity;
}</code></pre>
    `
});
collapseContainer.appendChild(collapse2);

// ===========================
// Complete Segment Demo
// ===========================
const segmentContainer = document.getElementById('segment-demo');

const segmentCard = createCard({
    padding: 'none',
    interactive: true,
    children: [
        createCardHeader({
            title: 'calculateComplexity',
            subtitle: 'src/analysis/complexity.ts:42-89',
            actions: [
                createBadge('HIGH', 'error'),
                createIconButton('sparkle', 'Explain with AI', () => alert('Explain clicked!')),
                createIconButton('edit', 'Edit segment', () => alert('Edit clicked!')),
                createIconButton('trash', 'Delete', () => alert('Delete clicked!'), 'vk-icon-button--danger')
            ]
        }),
        createCardBody({
            children: [
                createCollapse('Metrics', {
                    collapsed: false,
                    content: `
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px;">
                            <div>
                                <div style="color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase;">Complexity</div>
                                <div style="font-size: 20px; font-weight: 600; color: var(--vscode-charts-red);">15</div>
                            </div>
                            <div>
                                <div style="color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase;">Lines</div>
                                <div style="font-size: 20px; font-weight: 600;">47</div>
                            </div>
                            <div>
                                <div style="color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase;">Parameters</div>
                                <div style="font-size: 20px; font-weight: 600;">3</div>
                            </div>
                        </div>
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border); font-size: 12px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Max nesting depth:</span>
                                <strong>4</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Decision points:</span>
                                <strong>8</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Return statements:</span>
                                <strong>2</strong>
                            </div>
                        </div>
                    `
                }),
                createCollapse('AI Explanation', {
                    collapsed: true,
                    content: `
                        <div style="font-size: 13px; line-height: 1.6;">
                            <p style="margin: 0 0 12px 0;">
                                This function calculates the <strong>cyclomatic complexity</strong> of a code segment
                                by analyzing control flow statements in the TypeScript AST.
                            </p>
                            <p style="margin: 0 0 12px 0;">
                                <strong>How it works:</strong>
                            </p>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li>Starts with a base complexity of 1</li>
                                <li>Traverses the AST using TypeScript's <code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 2px;">forEachChild</code></li>
                                <li>Increments complexity for each decision point (if, while, for, etc.)</li>
                                <li>Recursively calculates complexity for child nodes</li>
                            </ul>
                            <p style="margin: 12px 0 0 0;">
                                <strong>Complexity: 15</strong> indicates this function has high complexity
                                and may benefit from refactoring into smaller functions.
                            </p>
                        </div>
                    `
                })
            ]
        }),
        createCardFooter({
            children: [
                createButton('View in Editor', {
                    variant: 'secondary',
                    icon: 'code',
                    onclick: () => alert('Opening in editor...')
                }),
                createButton('View Git History', {
                    variant: 'secondary',
                    icon: 'history',
                    onclick: () => alert('Opening git history...')
                })
            ]
        })
    ]
});
segmentContainer.appendChild(segmentCard);

// ===========================
// Helper Functions
// ===========================

function createCard({ padding = 'medium', interactive = false, className = '', children = [], content = '' }) {
    const card = document.createElement('div');
    card.className = `vk-card vk-card--padding-${padding}`;
    if (interactive) card.classList.add('vk-card--interactive');
    if (className) card.classList.add(className);

    if (content) {
        card.innerHTML = content;
    }

    children.forEach(child => card.appendChild(child));

    return card;
}

function createCardHeader({ title, subtitle, actions = [] }) {
    const header = document.createElement('div');
    header.className = 'vk-card-header';

    const titleContainer = document.createElement('div');
    titleContainer.style.flex = '1';

    const titleEl = document.createElement('div');
    titleEl.className = 'vk-card-title';
    titleEl.textContent = title;
    titleContainer.appendChild(titleEl);

    if (subtitle) {
        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'vk-card-subtitle';
        subtitleEl.textContent = subtitle;
        titleContainer.appendChild(subtitleEl);
    }

    header.appendChild(titleContainer);

    if (actions.length > 0) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'vk-card-actions';
        actions.forEach(action => actionsContainer.appendChild(action));
        header.appendChild(actionsContainer);
    }

    return header;
}

function createCardBody({ content = '', children = [] }) {
    const body = document.createElement('div');
    body.className = 'vk-card-body';

    if (content) {
        body.innerHTML = content;
    }

    children.forEach(child => body.appendChild(child));

    return body;
}

function createCardFooter({ content = '', children = [] }) {
    const footer = document.createElement('div');
    footer.className = 'vk-card-footer';

    if (content) {
        footer.innerHTML = content;
    } else if (children.length > 0) {
        footer.style.display = 'flex';
        footer.style.gap = '8px';
        children.forEach(child => footer.appendChild(child));
    }

    return footer;
}

function createBadge(text, variant = 'default') {
    const badge = document.createElement('span');
    badge.className = `vk-badge vk-badge--${variant}`;
    badge.textContent = text;
    return badge;
}

function createButton(text, { variant = 'primary', icon = null, onclick = null } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `vk-button vk-button--${variant}`;

    if (icon) {
        const iconEl = document.createElement('span');
        iconEl.className = `codicon codicon-${icon}`;
        button.appendChild(iconEl);
    }

    if (text) {
        const textEl = document.createElement('span');
        textEl.textContent = text;
        button.appendChild(textEl);
    }

    if (onclick) {
        button.addEventListener('click', onclick);
    }

    return button;
}

function createIconButton(icon, title, onclick = null, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vk-icon-button';
    if (className) button.classList.add(className);
    button.title = title;

    const iconEl = document.createElement('span');
    iconEl.className = `codicon codicon-${icon}`;
    button.appendChild(iconEl);

    if (onclick) {
        button.addEventListener('click', onclick);
    }

    return button;
}

function createCollapse(title, { collapsed = false, content = '', children = [] } = {}) {
    const container = document.createElement('div');
    container.className = 'vk-collapse';
    if (collapsed) container.classList.add('vk-collapse--collapsed');

    const header = document.createElement('div');
    header.className = 'vk-collapse-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');

    const chevron = document.createElement('span');
    chevron.className = `vk-collapse-chevron codicon codicon-chevron-${collapsed ? 'right' : 'down'}`;
    header.appendChild(chevron);

    const titleEl = document.createElement('span');
    titleEl.className = 'vk-collapse-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'vk-collapse-content-wrapper';
    if (collapsed) contentWrapper.style.display = 'none';

    const contentEl = document.createElement('div');
    contentEl.className = 'vk-collapse-content';

    if (content) {
        contentEl.innerHTML = content;
    }

    children.forEach(child => contentEl.appendChild(child));

    contentWrapper.appendChild(contentEl);

    // Toggle functionality
    header.addEventListener('click', () => {
        const isCollapsed = contentWrapper.style.display === 'none';
        contentWrapper.style.display = isCollapsed ? 'block' : 'none';
        chevron.className = `vk-collapse-chevron codicon codicon-chevron-${isCollapsed ? 'down' : 'right'}`;
        container.classList.toggle('vk-collapse--collapsed', !isCollapsed);
    });

    container.appendChild(header);
    container.appendChild(contentWrapper);

    return container;
}

console.log('✨ Voight UI Components Demo Loaded');
console.log('💡 Tip: Edit CSS files and refresh to see styling changes instantly');
