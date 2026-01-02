import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for Gemini - using Gemini 2.0 Flash (fast and capable)
const DEFAULT_MODEL = 'gemini-2.0-flash';

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    private client: GoogleGenerativeAI | null = null;
    private config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
        if (config.apiKey) {
            this.client = new GoogleGenerativeAI(config.apiKey);
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
            throw new Error('Gemini API key not configured');
        }

        // Use user-specified model or default
        const modelName = this.config.model || DEFAULT_MODEL;
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
