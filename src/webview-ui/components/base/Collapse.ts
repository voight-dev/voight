/**
 * Collapse - A collapsible container component
 *
 * Design Philosophy:
 * - Smooth expand/collapse animations
 * - Clear visual indicators (chevron icon)
 * - Accessible keyboard navigation
 * - GitLens-style collapsible sections
 */

export interface CollapseOptions {
    /** Initial collapsed state */
    collapsed?: boolean;
    /** Optional CSS classes to add */
    className?: string;
    /** Optional data attributes */
    dataAttributes?: Record<string, string>;
    /** Whether to animate the collapse/expand */
    animate?: boolean;
}

export class Collapse {
    private element: HTMLElement;
    private headerElement: HTMLElement;
    private titleElement: HTMLElement;
    private chevronElement: HTMLElement;
    private contentWrapper: HTMLElement;
    private contentElement: HTMLElement;
    private options: CollapseOptions;
    private collapsed: boolean;

    constructor(title: string, options: CollapseOptions = {}) {
        this.options = {
            collapsed: false,
            animate: true,
            ...options
        };
        this.collapsed = this.options.collapsed || false;
        this.element = this.createCollapse(title);
    }

    private createCollapse(title: string): HTMLElement {
        const container = document.createElement('div');
        container.className = this.buildClassName();

        if (this.options.dataAttributes) {
            Object.entries(this.options.dataAttributes).forEach(([key, value]) => {
                container.dataset[key] = value;
            });
        }

        // Header (clickable)
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'vk-collapse-header';
        this.headerElement.setAttribute('role', 'button');
        this.headerElement.setAttribute('tabindex', '0');
        this.headerElement.setAttribute('aria-expanded', String(!this.collapsed));

        // Chevron icon
        this.chevronElement = document.createElement('span');
        this.chevronElement.className = `vk-collapse-chevron codicon ${
            this.collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'
        }`;
        this.headerElement.appendChild(this.chevronElement);

        // Title
        this.titleElement = document.createElement('span');
        this.titleElement.className = 'vk-collapse-title';
        this.titleElement.textContent = title;
        this.headerElement.appendChild(this.titleElement);

        container.appendChild(this.headerElement);

        // Content wrapper (for animation)
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'vk-collapse-content-wrapper';
        if (this.collapsed) {
            this.contentWrapper.style.display = 'none';
        }

        // Content
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'vk-collapse-content';
        this.contentWrapper.appendChild(this.contentElement);

        container.appendChild(this.contentWrapper);

        // Event listeners
        this.headerElement.addEventListener('click', () => this.toggle());
        this.headerElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        return container;
    }

    private buildClassName(): string {
        const classes = ['vk-collapse'];
        if (this.collapsed) {
            classes.push('vk-collapse--collapsed');
        }
        if (this.options.className) {
            classes.push(this.options.className);
        }
        return classes.join(' ');
    }

    toggle(): this {
        if (this.collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
        return this;
    }

    expand(): this {
        if (!this.collapsed) {
            return this;
        }

        this.collapsed = false;
        this.element.classList.remove('vk-collapse--collapsed');
        this.headerElement.setAttribute('aria-expanded', 'true');
        this.chevronElement.className = 'vk-collapse-chevron codicon codicon-chevron-down';

        if (this.options.animate) {
            // Smooth expand animation
            this.contentWrapper.style.display = 'block';
            const height = this.contentElement.scrollHeight;
            this.contentWrapper.style.height = '0px';
            this.contentWrapper.style.overflow = 'hidden';

            requestAnimationFrame(() => {
                this.contentWrapper.style.transition = 'height 0.2s ease';
                this.contentWrapper.style.height = `${height}px`;

                setTimeout(() => {
                    this.contentWrapper.style.height = '';
                    this.contentWrapper.style.overflow = '';
                    this.contentWrapper.style.transition = '';
                }, 200);
            });
        } else {
            this.contentWrapper.style.display = 'block';
        }

        return this;
    }

    collapse(): this {
        if (this.collapsed) {
            return this;
        }

        this.collapsed = true;
        this.element.classList.add('vk-collapse--collapsed');
        this.headerElement.setAttribute('aria-expanded', 'false');
        this.chevronElement.className = 'vk-collapse-chevron codicon codicon-chevron-right';

        if (this.options.animate) {
            // Smooth collapse animation
            const height = this.contentElement.scrollHeight;
            this.contentWrapper.style.height = `${height}px`;
            this.contentWrapper.style.overflow = 'hidden';

            requestAnimationFrame(() => {
                this.contentWrapper.style.transition = 'height 0.2s ease';
                this.contentWrapper.style.height = '0px';

                setTimeout(() => {
                    this.contentWrapper.style.display = 'none';
                    this.contentWrapper.style.height = '';
                    this.contentWrapper.style.overflow = '';
                    this.contentWrapper.style.transition = '';
                }, 200);
            });
        } else {
            this.contentWrapper.style.display = 'none';
        }

        return this;
    }

    setTitle(title: string): this {
        this.titleElement.textContent = title;
        return this;
    }

    setContent(content: string | HTMLElement): this {
        if (typeof content === 'string') {
            this.contentElement.innerHTML = content;
        } else {
            this.contentElement.innerHTML = '';
            this.contentElement.appendChild(content);
        }
        return this;
    }

    appendChild(child: HTMLElement): this {
        this.contentElement.appendChild(child);
        return this;
    }

    isCollapsed(): boolean {
        return this.collapsed;
    }

    addClass(className: string): this {
        this.element.classList.add(className);
        return this;
    }

    removeClass(className: string): this {
        this.element.classList.remove(className);
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }

    getContentElement(): HTMLElement {
        return this.contentElement;
    }

    destroy(): void {
        this.element.remove();
    }
}
