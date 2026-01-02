import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderConfig } from './aiProvider';

// Default model for Gemini - using Gemini 2.0 Flash (fast and capable)
const DEFAULT_MODEL = 'gemini-2.0-flash';

// Preferred models for code explanation (in order of preference)
const PREFERRED_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
];

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    private client: GoogleGenerativeAI | null = null;
    private config: AIProviderConfig;
    private selectedModel: string | null = null;

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

    async listModels(): Promise<string[]> {
        if (!this.client || !this.config.apiKey) {
            return [];
        }

        try {
            // Gemini API uses fetch to list models
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
            // Filter to only generative models (not embedding models)
            return (data.models || [])
                .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m) => m.name.replace('models/', ''));
        } catch (error) {
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
                    if (availableModels.some(m => m.includes(preferred))) {
                        this.selectedModel = availableModels.find(m => m.includes(preferred))!;
                        return this.selectedModel;
                    }
                }
                // If no preferred model found, use first available
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
            throw new Error('Gemini API key not configured. Please add your API key in Settings → Voight → AI → API Key');
        }

        // Auto-select best available model
        let modelName: string;
        try {
            modelName = await this.selectModel();
        } catch (error) {
            // If model selection fails, use default
            modelName = DEFAULT_MODEL;
        }

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

        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: this.config.maxTokens || 2048,
                }
            });

            const response = result.response;
            return response.text() || 'No explanation generated';
        } catch (error) {
            // Re-throw with more context
            if (error instanceof Error) {
                throw new Error(`Gemini API error: ${error.message}`);
            }
            throw error;
        }
    }
}
