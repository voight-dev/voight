/**
 * AI Provider interface for code explanation
 */
export interface AIProvider {
    name: string;

    /**
     * Explain a code segment
     * @param code The code to explain
     * @param language Programming language (typescript, javascript, go, python)
     * @returns Explanation as markdown string
     */
    explain(code: string, language: string): Promise<string>;

    /**
     * Check if provider is configured (has API key)
     */
    isConfigured(): boolean;

    /**
     * Get the default model name for this provider
     */
    getDefaultModel(): string;

    /**
     * List available models from the provider
     * @returns List of model IDs available for use
     */
    listModels(): Promise<string[]>;

    /**
     * Select the best available model for code explanation
     * Falls back to default model if listing fails
     * @returns The model ID to use
     */
    selectModel(): Promise<string>;
}

/**
 * Provider configuration
 */
export interface AIProviderConfig {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
}
