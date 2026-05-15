import { GoogleGenAI } from "@google/genai";
import { callNanoGPTFallback } from "./fallback";

export function getAI(options: { apiKey: string, useNanoGPTOnly?: boolean, nanoModel?: string }) {
    const ai = new GoogleGenAI({ apiKey: options.apiKey || "dummy" });
    
    return {
        models: {
            generateContent: async (params: any) => {
                const nanoParams = { ...params, nanoModel: options.nanoModel };
                if (options.useNanoGPTOnly) {
                    return await callNanoGPTFallback(nanoParams);
                }
                
                try {
                    return await ai.models.generateContent(params);
                } catch (error: any) {
                    const errorMsg = String(error?.message || error).toLowerCase();
                    if (errorMsg.includes("503") || error?.status === 503 || errorMsg.includes("unavailable") || errorMsg.includes("high demand") || errorMsg.includes("fetch failed")) {
                        console.warn("Official API failed, falling back to NanoGPT...", errorMsg);
                        return await callNanoGPTFallback(nanoParams);
                    }
                    throw error;
                }
            }
        }
    };
}
