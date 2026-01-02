import OpenAI from 'openai';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for OpenAI - using GPT-4o (latest stable, good balance of speed/quality)
const DEFAULT_MODEL = 'gpt-4o';

export class OpenAIProvider implements AIProvider {
    name = 'openai';
    private client: OpenAI | null = null;
    private config: AIProviderConfig;

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

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        const model = this.config.model || DEFAULT_MODEL;

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
    }
}
