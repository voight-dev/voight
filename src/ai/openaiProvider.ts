import OpenAI from 'openai';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for OpenAI - using GPT-4o (latest stable, good balance of speed/quality)
const DEFAULT_MODEL = 'gpt-4o';

// Preferred models for code explanation (in order of preference)
const PREFERRED_MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
];

export class OpenAIProvider implements AIProvider {
    name = 'openai';
    private client: OpenAI | null = null;
    private config: AIProviderConfig;
    private selectedModel: string | null = null;

    constructor(config: AIProviderConfig) {
        this.config = config;
        if (config.apiKey) {
            this.client = new OpenAI({ apiKey: config.apiKey });
        }
    }

    isConfigured(): boolean {
        return !!this.config.apiKey;
    }

    getDefaultModel(): string {
        return DEFAULT_MODEL;
    }

    async listModels(): Promise<string[]> {
        if (!this.client) {
            return [];
        }

        try {
            const response = await this.client.models.list();
            // Filter to only chat/completion models (gpt-*)
            return response.data
                .filter(m => m.id.startsWith('gpt-'))
                .map(m => m.id);
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
                    // Exact match or starts with preferred (for dated versions like gpt-4o-2024-...)
                    const found = availableModels.find(m => m === preferred || m.startsWith(preferred + '-'));
                    if (found) {
                        this.selectedModel = found;
                        return this.selectedModel;
                    }
                }
                // If no preferred model found, use first available GPT model
                this.selectedModel = availableModels[0];
                return this.selectedModel;
            }
        } catch {
            // Fall through to default
        }

        this.selectedModel = DEFAULT_MODEL;
        return this.selectedModel;
    }

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured. Please add your API key in Settings → Voight → AI → API Key');
        }

        // Auto-select best available model
        const model = await this.selectModel();

        try {
            const completion = await this.client.chat.completions.create({
                model,
                messages: [{
                    role: 'system',
                    content: `You are a code explanation assistant. Explain code clearly and concisely. Focus on:
- What the code does (purpose)
- How it works (logic flow)
- Any notable patterns or techniques
- Potential issues or improvements

Be concise and avoid unnecessary verbosity. Provide a quick overview that helps a fellow developer understand the code quickly.
Keep things easy, clear, precise and helpful.`
                }, {
                    role: 'user',
                    content: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide your explanation in markdown format.`
                }],
                max_tokens: this.config.maxTokens || 2048
            });

            return completion.choices[0]?.message?.content || 'No explanation generated';
        } catch (error) {
            // Re-throw with more context
            if (error instanceof Error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            throw error;
        }
    }
}
