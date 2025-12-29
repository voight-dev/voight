/**
 * Badge - A small status indicator or label
 *
 * Design Philosophy:
 * - Minimal, compact design
 * - Clear visual hierarchy with color coding
 * - Supports different semantic variants (info, success, warning, error)
 * - VSCode-native styling
 */

export interface BadgeOptions {
    /** Badge variant: 'default' | 'info' | 'success' | 'warning' | 'error' */
    variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
    /** Optional CSS classes to add */
    className?: string;
    /** Optional data attributes */
    dataAttributes?: Record<string, string>;
}

export class Badge {
    private element: HTMLElement;
    private options: BadgeOptions;

    constructor(text: string, options: BadgeOptions = {}) {
        this.options = {
            variant: 'default',
            ...options
        };
        this.element = this.createBadge(text);
    }

    private createBadge(text: string): HTMLElement {
        const badge = document.createElement('span');
        badge.className = this.buildClassName();
        badge.textContent = text;

        if (this.options.dataAttributes) {
            Object.entries(this.options.dataAttributes).forEach(([key, value]) => {
                badge.dataset[key] = value;
            });
        }

        return badge;
    }

    private buildClassName(): string {
        const classes = ['vk-badge'];
        if (this.options.variant) {
            classes.push(`vk-badge--${this.options.variant}`);
        }
        if (this.options.className) {
            classes.push(this.options.className);
        }
        return classes.join(' ');
    }

    setText(text: string): this {
        this.element.textContent = text;
        return this;
    }

    setVariant(variant: BadgeOptions['variant']): this {
        // Remove old variant class
        if (this.options.variant) {
            this.element.classList.remove(`vk-badge--${this.options.variant}`);
        }
        // Add new variant class
        this.options.variant = variant;
        if (variant) {
            this.element.classList.add(`vk-badge--${variant}`);
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

    getElement(): HTMLElement {
        return this.element;
    }

    destroy(): void {
        this.element.remove();
    }
}
