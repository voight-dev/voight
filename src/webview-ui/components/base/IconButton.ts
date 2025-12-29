/**
 * IconButton - A compact icon-only button component
 *
 * Design Philosophy:
 * - Compact, minimal design for toolbars and action areas
 * - VSCode codicon support
 * - Clear hover states
 * - Tooltip support for accessibility
 */

export interface IconButtonOptions {
    /** Codicon class name (e.g., 'codicon-close', 'codicon-check') */
    icon: string;
    /** Tooltip text (accessibility) */
    title?: string;
    /** Optional CSS classes to add */
    className?: string;
    /** Whether button is disabled */
    disabled?: boolean;
    /** Optional data attributes */
    dataAttributes?: Record<string, string>;
}

export class IconButton {
    private element: HTMLButtonElement;
    private iconElement: HTMLElement;
    private options: IconButtonOptions;

    constructor(options: IconButtonOptions) {
        this.options = {
            disabled: false,
            ...options
        };
        this.element = this.createButton();
    }

    private createButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = this.buildClassName();
        button.disabled = this.options.disabled || false;

        if (this.options.title) {
            button.title = this.options.title;
            button.setAttribute('aria-label', this.options.title);
        }

        if (this.options.dataAttributes) {
            Object.entries(this.options.dataAttributes).forEach(([key, value]) => {
                button.dataset[key] = value;
            });
        }

        // Icon
        this.iconElement = document.createElement('span');
        this.iconElement.className = `codicon ${this.options.icon}`;
        button.appendChild(this.iconElement);

        return button;
    }

    private buildClassName(): string {
        const classes = ['vk-icon-button'];
        if (this.options.className) {
            classes.push(this.options.className);
        }
        return classes.join(' ');
    }

    setIcon(iconClass: string): this {
        this.iconElement.className = `codicon ${iconClass}`;
        this.options.icon = iconClass;
        return this;
    }

    setTitle(title: string): this {
        this.element.title = title;
        this.element.setAttribute('aria-label', title);
        this.options.title = title;
        return this;
    }

    setDisabled(disabled: boolean): this {
        this.element.disabled = disabled;
        this.options.disabled = disabled;
        return this;
    }

    addClass(className: string): this {
        this.element.classList.add(className);
        return this;
    }

    removeClass(className: string): this {
        this.element.classList.remove(className);
        return this;
    }

    addEventListener(event: string, handler: EventListener): this {
        this.element.addEventListener(event, handler);
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }

    destroy(): void {
        this.element.remove();
    }
}
