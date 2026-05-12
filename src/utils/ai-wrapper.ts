import { GoogleGenAI } from "@google/genai";
import { callNanoGPTFallback } from "./fallback";

export function getAI(options: { apiKey: string }) {
    const ai = new GoogleGenAI(options);
    
    return {
        models: {
            generateContent: async (params: any) => {
                try {
                    return await ai.models.generateContent(params);
                } catch (error: any) {
                    const errorMsg = String(error?.message || error).toLowerCase();
                    if (errorMsg.includes("503") || error?.status === 503 || errorMsg.includes("unavailable") || errorMsg.includes("high demand") || errorMsg.includes("fetch failed")) {
                        console.warn("Official API failed, falling back to NanoGPT...", errorMsg);
                        return await callNanoGPTFallback(params);
                    }
                    throw error;
                }
            }
        }
    };
}
