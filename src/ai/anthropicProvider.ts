import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for Anthropic - using Claude Sonnet 4 (latest stable)
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Preferred models for code explanation (in order of preference)
const PREFERRED_MODELS = [
    'claude-sonnet-4',
    'claude-3-5-sonnet',
    'claude-3-sonnet',
    'claude-3-haiku'
];

export class AnthropicProvider implements AIProvider {
    name = 'anthropic';
    private client: Anthropic | null = null;
    private config: AIProviderConfig;
    private selectedModel: string | null = null;

    constructor(config: AIProviderConfig) {
        this.config = config;
        if (config.apiKey) {
            this.client = new Anthropic({ apiKey: config.apiKey });
        }
    }

    isConfigured(): boolean {
        return !!this.config.apiKey;
    }

    getDefaultModel(): string {
        return DEFAULT_MODEL;
    }

    async listModels(): Promise<string[]> {
        if (!this.client || !this.config.apiKey) {
            return [];
        }

        try {
            // Anthropic API models endpoint
            const response = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json() as { data?: Array<{ id: string }> };
            return (data.data || []).map((m) => m.id);
        } catch {
            // Return empty array on failure, let selectModel handle fallback
            return [];
        }
    }

    async selectModel(): Promise<string> {
        // If already selected, return cached value
        if (this.selectedModel) {
            return this.selectedModel;
        }

        try {
            const availableModels = await this.listModels();

            if (availableModels.length > 0) {
                // Find the first preferred model that's available
                for (const preferred of PREFERRED_MODELS) {
                    const found = availableModels.find(m => m.includes(preferred));
                    if (found) {
                        this.selectedModel = found;
                        return this.selectedModel;
                    }
                }
                // If no preferred model found, use first available Claude model
                const claudeModel = availableModels.find(m => m.startsWith('claude'));
                if (claudeModel) {
                    this.selectedModel = claudeModel;
                    return this.selectedModel;
                }
            }
        } catch {
            // Fall through to default
        }

        this.selectedModel = DEFAULT_MODEL;
        return this.selectedModel;
    }

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('Anthropic API key not configured. Please add your API key in Settings → Voight → AI → API Key');
        }

        // Auto-select best available model
        const model = await this.selectModel();

        const prompt = `You are a code explanation assistant. Explain the following ${language} code in clear, concise terms. Focus on:
- What the code does (purpose)
- How it works (logic flow)
- Any notable patterns or techniques
- Potential issues or improvements

Please be concise and avoid unnecessary verbosity. Make sure you are being helpful without being too detailed.
The core idea here is to provide a quick overview based explanation of the code, that you might give to a fellow developer to help them understand it quickly.
The most important point is to keep things easy, clear, precise and helpful.

Code:
\`\`\`${language}
${code}
\`\`\`

Provide your explanation in markdown format.`;

        try {
            const message = await this.client.messages.create({
                model,
                max_tokens: this.config.maxTokens || 2048,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const textContent = message.content.find(c => c.type === 'text');
            return textContent && 'text' in textContent ? textContent.text : 'No explanation generated';
        } catch (error) {
            // Re-throw with more context
            if (error instanceof Error) {
                throw new Error(`Anthropic API error: ${error.message}`);
            }
            throw error;
        }
    }
}
