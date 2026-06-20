// Единый источник правды для ID моделей.
// Меняйте модели только здесь — нигде больше в коде ID не должен быть прописан.
//
// Транспорта два:
//  - free:        официальный Google GenAI SDK (свой ключ Gemini) → «голые» имена без префикса
//  - simple/advanced: NanoGPT / OpenRouter-стиль слагов с префиксом "google/"
//
// Это важно: free-режим использует SDK Google, который НЕ принимает префикс "google/",
// а simple/advanced идут через NanoGPT, которому префикс нужен. Поэтому free и simple
// хранятся раздельно, даже если это одна и та же базовая модель.

export const MODELS = {
  // Официальный Google AI Studio SDK (free-режим). Голое имя, без "google/".
  free: "gemini-3.1-flash-lite",

  // NanoGPT / OpenRouter-слаги (режимы simple и advanced).
  simple: "google/gemini-3.1-flash-lite", // лёгкая модель для простого режима
  advancedLite: "google/gemini-3.1-flash-lite", // первый дешёвый проход в каскаде advanced
  advanced: "google/gemini-3.5-flash-thinking", // мощная модель для эскалации
} as const;

// Порог уверенности (1-10): если лёгкая модель в advanced-каскаде оценивает
// уверенность в точности КБЖУ ниже этого значения — запрос уходит на мощную модель.
export const ADVANCED_ESCALATION_THRESHOLD = 7;

// Резолвит модель для обычного (не-каскадного) вызова по режиму.
export function getModelForMode(
  mode: "free" | "simple" | "advanced" | undefined,
): string {
  switch (mode) {
    case "advanced":
      return MODELS.advanced;
    case "simple":
      return MODELS.simple;
    default:
      return MODELS.free;
  }
}
