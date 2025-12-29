/**
 * Card - A reusable container component
 *
 * Design Philosophy:
 * - Clean, minimal design that feels native to VSCode
 * - Consistent spacing and borders
 * - Respects VSCode theme colors
 * - Supports hover states and interactive variants
 */

export interface CardOptions {
    /** Optional CSS classes to add */
    className?: string;
    /** Whether the card is interactive (clickable/hoverable) */
    interactive?: boolean;
    /** Padding size: 'none' | 'small' | 'medium' | 'large' */
    padding?: 'none' | 'small' | 'medium' | 'large';
    /** Optional data attributes for event handling */
    dataAttributes?: Record<string, string>;
}

export class Card {
    private element: HTMLElement;
    private options: CardOptions;

    constructor(options: CardOptions = {}) {
        this.options = {
            interactive: false,
            padding: 'medium',
            ...options
        };

        this.element = this.createCard();
    }

    private createCard(): HTMLElement {
        const card = document.createElement('div');
        card.className = this.buildClassName();

        // Add data attributes for event handling
        if (this.options.dataAttributes) {
            Object.entries(this.options.dataAttributes).forEach(([key, value]) => {
                card.dataset[key] = value;
            });
        }

        return card;
    }

    private buildClassName(): string {
        const classes = ['vk-card'];

        // Add padding class
        if (this.options.padding) {
            classes.push(`vk-card--padding-${this.options.padding}`);
        }

        // Add interactive class
        if (this.options.interactive) {
            classes.push('vk-card--interactive');
        }

        // Add custom classes
        if (this.options.className) {
            classes.push(this.options.className);
        }

        return classes.join(' ');
    }

    /**
     * Set the card content (can be string or HTMLElement)
     */
    setContent(content: string | HTMLElement): this {
        if (typeof content === 'string') {
            this.element.innerHTML = content;
        } else {
            this.element.innerHTML = '';
            this.element.appendChild(content);
        }
        return this;
    }

    /**
     * Append a child element to the card
     */
    appendChild(child: HTMLElement): this {
        this.element.appendChild(child);
        return this;
    }

    /**
     * Add a CSS class to the card
     */
    addClass(className: string): this {
        this.element.classList.add(className);
        return this;
    }

    /**
     * Remove a CSS class from the card
     */
    removeClass(className: string): this {
        this.element.classList.remove(className);
        return this;
    }

    /**
     * Add an event listener to the card
     */
    addEventListener(event: string, handler: EventListener): this {
        this.element.addEventListener(event, handler);
        return this;
    }

    /**
     * Get the DOM element
     */
    getElement(): HTMLElement {
        return this.element;
    }

    /**
     * Destroy the card and remove event listeners
     */
    destroy(): void {
        this.element.remove();
    }
}

/**
 * Card Header - A header section for cards
 */
export class CardHeader {
    private element: HTMLElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'vk-card-header';
    }

    setTitle(title: string): this {
        const titleEl = document.createElement('div');
        titleEl.className = 'vk-card-title';
        titleEl.textContent = title;
        this.element.appendChild(titleEl);
        return this;
    }

    setSubtitle(subtitle: string): this {
        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'vk-card-subtitle';
        subtitleEl.textContent = subtitle;
        this.element.appendChild(subtitleEl);
        return this;
    }

    addAction(element: HTMLElement): this {
        let actionsContainer = this.element.querySelector('.vk-card-actions');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'vk-card-actions';
            this.element.appendChild(actionsContainer);
        }
        actionsContainer.appendChild(element);
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }
}

/**
 * Card Body - The main content area of a card
 */
export class CardBody {
    private element: HTMLElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'vk-card-body';
    }

    setContent(content: string | HTMLElement): this {
        if (typeof content === 'string') {
            this.element.innerHTML = content;
        } else {
            this.element.innerHTML = '';
            this.element.appendChild(content);
        }
        return this;
    }

    appendChild(child: HTMLElement): this {
        this.element.appendChild(child);
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }
}

/**
 * Card Footer - A footer section for cards
 */
export class CardFooter {
    private element: HTMLElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'vk-card-footer';
    }

    setContent(content: string | HTMLElement): this {
        if (typeof content === 'string') {
            this.element.innerHTML = content;
        } else {
            this.element.innerHTML = '';
            this.element.appendChild(content);
        }
        return this;
    }

    appendChild(child: HTMLElement): this {
        this.element.appendChild(child);
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }
}
