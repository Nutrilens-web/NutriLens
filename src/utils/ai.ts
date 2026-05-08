import { GoogleGenAI } from "@google/genai";

export async function analyzeMealImage(
  apiKey: string,
  base64Images: string[],
  userContext: string,
  userInput: string,
  recentMealsContext: string = "",
) {
  if (!apiKey) {
    throw new Error(
      "API ключ не указан. Пожалуйста, добавьте его в настройках.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Ты профессиональный диетолог. Твоя задача - проанализировать ${base64Images.length > 0 ? "фото и/или описание" : "описание"} еды/напитка/продукта и выдать калории, белки, жиры и углеводы (КБЖУ), даже если описание примерное.

[ОБЩАЯ ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ]: ${userContext}
[ЗАПРОС ПОЛЬЗОВАТЕЛЯ]: ${userInput || (base64Images.length > 0 ? "Пользователь прикрепил только фото." : "Пользователь не написал текст.")}
[НЕДАВНИЕ ПРИЕМЫ ПИЩИ СЕГОДНЯ]: ${recentMealsContext} (Используй это, если пользователь пишет "то же самое", "добавь еще порцию", "как утром" и т.д.)

ИНСТРУКЦИЯ ПО ОЦЕНКЕ (ОБЯЗАТЕЛЬНА К ВЫПОЛНЕНИЮ):
1. Если пользователь просто ввел текст (например, "яблоко", "борщ 300г", "котлета с пюре", "пиво"), распознай это как еду и оцени КБЖУ. НИКОГДА не отвечай "Неизвестное блюдо" или нулями, если это хоть отдаленно похоже на еду. Сделай максимально точную оценку (educated guess).
2. Используй метод "шаг за шагом". В поле aiThoughts СНАЧАЛА распиши все компоненты в формате: "Ингредиент | Оценочный вес (г) | Ккал на 100г | Итого КБЖУ", затем сделай вывод.
3. Оценивай вес ингредиентов консервативно, если он не указан (стандартная порция супа 250-300г, гарнира 150г, мяса 100-150г).
4. Строго математически просуммируй полученные значения.
5. Округляй финальные значения КБЖУ до целых чисел.

ОБЯЗАТЕЛЬНО верни JSON.`;

  const imageParts = base64Images.map((img) => ({
    inlineData: {
      data: img.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: "image/jpeg", // assuming jpeg for now
    },
  }));

  const parts = [{ text: prompt }, ...imageParts];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbs: { type: "number" },
          aiThoughts: { type: "string" },
        },
        required: ["name", "calories", "protein", "fat", "carbs", "aiThoughts"],
      },
      temperature: 0.1,
      topP: 0.1,
      topK: 1,
    },
  });

  const text = response.text || "{}";
  let parsedJson: any = {};

  try {
    parsedJson = JSON.parse(text);
  } catch (e) {
    throw new Error("Не удалось распознать ответ от ИИ.");
  }

  return {
    aiThoughts: parsedJson.aiThoughts || "",
    result: {
      name: parsedJson.name || "Неизвестное блюдо",
      calories: Number(parsedJson.calories) || 0,
      protein: Number(parsedJson.protein) || 0,
      fat: Number(parsedJson.fat) || 0,
      carbs: Number(parsedJson.carbs) || 0,
    },
  };
}

export async function getRecommendations(
  apiKey: string,
  userContext: string,
  userInput: string,
  remainingCalories: number,
  recentMealsContext: string = "",
) {
  if (!apiKey) {
    throw new Error(
      "API ключ не указан. Пожалуйста, добавьте его в настройках.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const currentHour = new Date().getHours();
  let timeOfDay = 'День';
  if (currentHour < 11) timeOfDay = 'Утро';
  else if (currentHour >= 17) timeOfDay = 'Вечер';

  const prompt = `Ты профессиональный диетолог. Подобери идеи для еды под оставшиеся ${remainingCalories} ккал пользователя.
[КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ]: ${userContext}
[ОТКРЫТЫЙ ЗАПРОС / ПОЖЕЛАНИЯ СЕЙЧАС]: ${userInput || "Обычный прием пищи"}
[СЕГОДНЯ УЖЕ СЪЕДЕНО]: ${recentMealsContext}
[ТЕКУЩЕЕ ВРЕМЯ]: ${timeOfDay} (${currentHour}:00)

Учитывай все пожелания пользователя:
1. Если пользователь напрямую просит конкретную "задачу" или идею ("я хочу сладкое", "что-то из творога", "напиши идеи для тренировки"), строго следуй этой идее в рамках КБЖУ.
2. Если сейчас Утро или День, НЕ предлагай блюда, которые заберут все оставшиеся калории, оставь место для следующих приемов пищи.
3. Если сейчас Вечер, можно предлагать блюда на все оставшиеся калории.
4. Не предлагай то, что превысит остаток.

Предложи 3-4 идеи и верни СТРОГО в формате JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                shortDescription: { type: "string" },
                calories: { type: "number" },
                recipePrompt: { type: "string" }
              },
              required: ["id", "title", "shortDescription", "calories", "recipePrompt"]
            }
          }
        },
        required: ["recommendations"]
      },
      temperature: 0.1,
      topP: 0.1,
      topK: 1,
    },
  });

  const text = response.text || "{}";
  let parsedJson: any = null;

  try {
    parsedJson = JSON.parse(text);
  } catch (e) {
    throw new Error("Не удалось распознать данные от ИИ.");
  }

  if (!parsedJson || !parsedJson.recommendations) {
    throw new Error("Неверный формат ответа.");
  }

  return parsedJson.recommendations as Array<{
    id: string;
    title: string;
    shortDescription: string;
    calories: number;
    recipePrompt: string;
  }>;
}

export async function getDetailedRecipe(apiKey: string, recipePrompt: string) {
  if (!apiKey) throw new Error("API ключ не указан.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Напиши подробный пошаговый рецепт для следующего блюда:
${recipePrompt}
Включи ингредиенты (с граммовками) и пошаговую инструкцию. Отвечай просто текстом (без сложного форматирования, используй обычные списки с тире). Не используй JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  return response.text || "К сожалению, рецепт недоступен.";
}
