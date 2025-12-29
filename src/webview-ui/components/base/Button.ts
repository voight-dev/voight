/**
 * Button - A reusable button component
 *
 * Design Philosophy:
 * - VSCode-native button styling
 * - Clear visual hierarchy with primary/secondary variants
 * - Supports icons and loading states
 * - Accessible and keyboard-friendly
 */

export interface ButtonOptions {
    /** Button variant: 'primary' | 'secondary' | 'icon' */
    variant?: 'primary' | 'secondary' | 'icon';
    /** Optional CSS classes to add */
    className?: string;
    /** Whether button is disabled */
    disabled?: boolean;
    /** Optional icon (codicon class name, e.g., 'codicon-check') */
    icon?: string;
    /** Optional tooltip text */
    title?: string;
    /** Optional data attributes */
    dataAttributes?: Record<string, string>;
}

export class Button {
    private element: HTMLButtonElement;
    private options: ButtonOptions;
    private textSpan: HTMLSpanElement | null = null;
    private iconSpan: HTMLElement | null = null;

    constructor(text: string, options: ButtonOptions = {}) {
        this.options = {
            variant: 'primary',
            disabled: false,
            ...options
        };
        this.element = this.createButton(text);
    }

    private createButton(text: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = this.buildClassName();
        button.disabled = this.options.disabled || false;

        if (this.options.title) {
            button.title = this.options.title;
        }

        if (this.options.dataAttributes) {
            Object.entries(this.options.dataAttributes).forEach(([key, value]) => {
                button.dataset[key] = value;
            });
        }

        // Add icon if provided
        if (this.options.icon) {
            this.iconSpan = document.createElement('span');
            this.iconSpan.className = `codicon ${this.options.icon}`;
            button.appendChild(this.iconSpan);
        }

        // Add text
        if (text) {
            this.textSpan = document.createElement('span');
            this.textSpan.textContent = text;
            button.appendChild(this.textSpan);
        }

        return button;
    }

    private buildClassName(): string {
        const classes = ['vk-button'];
        if (this.options.variant) {
            classes.push(`vk-button--${this.options.variant}`);
        }
        if (this.options.className) {
            classes.push(this.options.className);
        }
        return classes.join(' ');
    }

    setText(text: string): this {
        if (this.textSpan) {
            this.textSpan.textContent = text;
        } else {
            this.textSpan = document.createElement('span');
            this.textSpan.textContent = text;
            this.element.appendChild(this.textSpan);
        }
        return this;
    }

    setIcon(iconClass: string): this {
        if (this.iconSpan) {
            this.iconSpan.className = `codicon ${iconClass}`;
        } else {
            this.iconSpan = document.createElement('span');
            this.iconSpan.className = `codicon ${iconClass}`;
            this.element.insertBefore(this.iconSpan, this.element.firstChild);
        }
        return this;
    }

    setDisabled(disabled: boolean): this {
        this.element.disabled = disabled;
        this.options.disabled = disabled;
        return this;
    }

    setLoading(loading: boolean): this {
        if (loading) {
            this.element.classList.add('vk-button--loading');
            this.element.disabled = true;
        } else {
            this.element.classList.remove('vk-button--loading');
            this.element.disabled = this.options.disabled || false;
        }
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
