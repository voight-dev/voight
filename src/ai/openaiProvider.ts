import OpenAI from 'openai';
import { AIProvider, AIProviderConfig } from './aiProvider';

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

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        const completion = await this.client.chat.completions.create({
            model: this.config.model || 'gpt-4-turbo-preview',
            messages: [{
                role: 'system',
                content: 'You are a code explanation assistant. Explain code clearly and concisely.'
            }, {
                role: 'user',
                content: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
            }],
            max_tokens: this.config.maxTokens || 1024
        });

        return completion.choices[0]?.message?.content || 'No explanation generated';
    }
}
