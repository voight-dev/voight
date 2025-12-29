import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIProviderConfig } from './aiProvider';

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

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('Anthropic API key not configured');
        }

        const prompt = `You are a code explanation assistant. Explain the following ${language} code in clear, concise terms. Focus on:
- What the code does (purpose)
- How it works (logic flow)
- Any notable patterns or techniques
- Potential issues or improvements

Code:
\`\`\`${language}
${code}
\`\`\`

Provide your explanation in markdown format.`;

        const message = await this.client.messages.create({
            model: this.config.model || 'claude-3-5-sonnet-20241022',
            max_tokens: this.config.maxTokens || 1024,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        const textContent = message.content.find(c => c.type === 'text');
        return textContent && 'text' in textContent ? textContent.text : 'No explanation generated';
    }
}
