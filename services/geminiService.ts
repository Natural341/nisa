import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';

class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async analyzeProduct(name: string, sku: string): Promise<{ category: string, description: string, tags: string[] }> {
    if (!this.ai) {
      return {
        category: 'Uncategorized',
        description: 'AI unavailable (No API Key)',
        tags: []
      };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this inventory item name: "${name}" with SKU: "${sku}". Suggest a professional inventory category, a short 1-sentence description, and 3-5 keywords/tags.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        return JSON.parse(text);
      }
    } catch (error) {
      console.error("Gemini Analysis Failed:", error);
    }

    return {
      category: 'General',
      description: 'Auto-generated description failed.',
      tags: ['item']
    };
  }
}

export const geminiService = new GeminiService();