import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for Anthropic - using Claude 3.5 Sonnet (latest stable)
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export class AnthropicProvider implements AIProvider {
    name = 'anthropic';
    private client: Anthropic | null = null;
    private config: AIProviderConfig;

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

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('Anthropic API key not configured');
        }

        const model = this.config.model || DEFAULT_MODEL;

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
    }
}
