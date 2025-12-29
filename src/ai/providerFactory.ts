import * as vscode from 'vscode';
import { AIProvider, AIProviderConfig } from './aiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';

export class AIProviderFactory {
    /**
     * Create an AI provider based on configuration
     */
    static createProvider(): AIProvider {
        const config = vscode.workspace.getConfiguration('voight.ai');
        const provider = config.get<string>('provider', 'gemini');

        const providerConfig: AIProviderConfig = {
            apiKey: config.get<string>('apiKey'),
            model: config.get<string>('model'),
            maxTokens: config.get<number>('maxTokens', 2048)
        };

        switch (provider) {
            case 'openai':
                return new OpenAIProvider(providerConfig);
            case 'anthropic':
                return new AnthropicProvider(providerConfig);
            case 'gemini':
            default:
                return new GeminiProvider(providerConfig);
        }
    }
}
