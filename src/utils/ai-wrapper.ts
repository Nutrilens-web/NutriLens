import { GoogleGenAI } from "@google/genai";
import { callNanoGPTFallback } from "./fallback";
import { MODELS } from "./models";
import type { Settings } from "../types";

// Проверяет, что для выбранного режима указан нужный ключ.
// Возвращает сообщение об ошибке, если ключа нет, иначе null.
// free      — нужен свой ключ Gemini (settings.apiKey)
// simple/advanced — нужен ключ NanoGPT (settings.nanoApiKey)
export function getApiKeyError(settings: Settings): string | null {
  const mode = settings.apiMode || "free";
  if (mode === "free") {
    if (!settings.apiKey) {
      return "Укажите API ключ Gemini в настройках";
    }
  } else {
    if (!settings.nanoApiKey) {
      return "Укажите ключ NanoGPT в настройках (для режима «" +
        (mode === "advanced" ? "Продвинутый" : "Простой") +
        "»)";
    }
  }
  return null;
}

export function getAI(options: {
  apiKey: string;
  nanoApiKey?: string;
  useNanoGPTOnly?: boolean;
  nanoModel?: string;
  nanoApiEndpoint?: string;   // кастомный URL прокси для NanoGPT (обход блокировок)
  geminiApiEndpoint?: string;  // кастомный baseUrl для @google/genai SDK (httpOptions.baseUrl)
}) {
    // SDK @google/genai (см. node_modules/@google/genai/dist/genai.d.ts,
    // интерфейс HttpOptions) поддерживает httpOptions.baseUrl — это позволяет
    // перенаправить все запросы к Gemini на собственный прокси-эндпоинт,
    // что нужно для обхода блокировки generativelanguage.googleapis.com в РФ.
    const ai = new GoogleGenAI({
      apiKey: options.apiKey || "dummy",
      ...(options.geminiApiEndpoint ? {
        httpOptions: { baseUrl: options.geminiApiEndpoint },
      } : {}),
    });
    const nanoParams = {
        ...({} as any),
        nanoModel: options.nanoModel,
        nanoApiKey: options.nanoApiKey,
        nanoApiEndpoint: options.nanoApiEndpoint,
    };

    return {
        models: {
            generateContent: async (params: any) => {
                if (options.useNanoGPTOnly) {
                    return await callNanoGPTFallback({ ...params, ...nanoParams });
                }

                try {
                    return await ai.models.generateContent(params);
                } catch (error: any) {
                    const errorMsg = String(error?.message || error).toLowerCase();
                    if (
                      errorMsg.includes("503") ||
                      error?.status === 503 ||
                      errorMsg.includes("unavailable") ||
                      errorMsg.includes("high demand") ||
                      errorMsg.includes("fetch failed")
                    ) {
                        console.warn("Official API failed, falling back to NanoGPT...", errorMsg);
                        return await callNanoGPTFallback({ ...params, ...nanoParams });
                    }
                    throw error;
                }
            }
        }
    };
}

// Удобный конструктор из settings: убирает дублирование длинного вызова
// getAI({...}) во всех экранах. Берёт режим и модель из settings.apiMode,
// ключ NanoGPT — из settings.nanoApiKey (пользователь указывает в Настройках).
export function getAIForSettings(settings: Settings) {
  const useNanoGPTOnly = !!settings.apiMode && settings.apiMode !== "free";
  // nanoModel — модель по умолчанию для всего simple/advanced-трафика.
  // В advanced-режиме конкретный вызов (lite vs мощная) задаётся через params.model
  // и callNanoGPTFallback учитывает именно его, а не этот дефолт.
  const nanoModel = MODELS.advanced;

  return getAI({
    apiKey: settings.apiKey,
    nanoApiKey: settings.nanoApiKey,
    useNanoGPTOnly,
    nanoModel,
    nanoApiEndpoint: settings.nanoApiEndpoint,
    geminiApiEndpoint: settings.geminiApiEndpoint,
  });
}