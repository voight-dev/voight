import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderConfig } from './aiProvider';

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    private client: GoogleGenerativeAI | null = null;
    private config: AIProviderConfig;
    private cachedModelName: string | null = null;

    constructor(config: AIProviderConfig) {
        this.config = config;
        if (config.apiKey) {
            this.client = new GoogleGenerativeAI(config.apiKey);
        }
    }

    isConfigured(): boolean {
        return !!this.config.apiKey;
    }

    /**
     * Get an available model name by querying the API
     */
    private async getAvailableModel(): Promise<string> {
        if (!this.client) {
            throw new Error('Gemini client not initialized');
        }

        // If user specified a model, use it
        if (this.config.model) {
            return this.config.model;
        }

        // If we cached a model name, reuse it
        if (this.cachedModelName) {
            return this.cachedModelName;
        }

        try {
            // Fetch available models from the API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }

            const data = await response.json() as { models?: any[] };
            const models = data.models || [];

            // Filter models that support generateContent
            const textModels = models.filter((model: any) =>
                model.supportedGenerationMethods?.includes('generateContent') &&
                !model.name.includes('image') &&
                !model.name.includes('embedding') &&
                !model.name.includes('tts') &&
                !model.name.includes('aqa')
            );

            if (textModels.length === 0) {
                throw new Error('No suitable models found');
            }

            // Prioritize models by preference
            const preferredOrder = [
                'gemini-2.5-flash',      // Latest stable flash
                'gemini-flash-latest',   // Latest flash alias
                'gemini-2.0-flash',      // 2.0 flash
                'gemini-2.5-pro',        // Latest stable pro
                'gemini-pro-latest',     // Latest pro alias
            ];

            // Try to find a preferred model
            for (const preferred of preferredOrder) {
                const found = textModels.find((m: any) => m.name.includes(preferred));
                if (found) {
                    this.cachedModelName = found.name;
                    return found.name;
                }
            }

            // If no preferred model found, use the first available text model
            this.cachedModelName = textModels[0].name;
            return textModels[0].name;

        } catch (error) {
            // Fallback to a safe default if API call fails
            console.warn('Failed to fetch Gemini models, using fallback:', error);
            this.cachedModelName = 'gemini-pro';
            return 'gemini-pro';
        }
    }

    async explain(code: string, language: string): Promise<string> {
        if (!this.client) {
            throw new Error('Gemini API key not configured');
        }

        const modelName = await this.getAvailableModel();
        const model = this.client.getGenerativeModel({
            model: modelName
        });

        const prompt = `You are a code explanation assistant. Explain the following ${language} code in clear, concise terms. Focus on:
- What the code does (purpose)
- How it works (logic flow)
- Any notable patterns or techniques
- Potential issues or improvements

Please be concise and avoid unnecessary verbosity. Make sure you are being helpful without being too detailed.
The core idea here is to provide a quick overview based explanation of the code, that you might give to a fellow developer to help them understand it quickly.
The most important point is to keep things easy, clear, precise and helpful. 

Here is the code to explain:

Code:
\`\`\`${language}
${code}
\`\`\`

Provide your explanation in markdown format.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: this.config.maxTokens || 2048,
            }
        });

        const response = result.response;
        return response.text() || 'No explanation generated';
    }
}
