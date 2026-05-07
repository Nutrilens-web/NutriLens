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

  const prompt = `Ты профессиональный диетолог. Проанализируй ${base64Images.length > 0 ? "фото и/или описание" : "описание"} еды и выдай КБЖУ.
[КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ]: ${userContext}
[ОПИСАНИЕ ИЛИ УТОЧНЕНИЯ]: ${userInput}
[НЕДАВНИЕ ПРИЕМЫ ПИЩИ]: ${recentMealsContext} (Используй это, если пользователь пишет "то же самое", "как утром", "добавь еще порцию", и т.д.)

Выполни анализ СТРОГО по шагам:
1. Идентифицируй все продукты ${base64Images.length > 0 ? "на фото и/или из текста" : "из текста"} с учетом масштаба (из контекста).
2. Оцени примерный вес порций.
3. Учти скрытые калории (масло, соусы, метод готовки).
4. Подсчитай итоговые значения.

ОТВЕТЬ СТРОГО В ТАКОМ ФОРМАТЕ JSON ОДНИМ ОБЪЕКТОМ:
{
  "name": "Название блюда",
  "calories": 450,
  "protein": 20,
  "fat": 15,
  "carbs": 50,
  "aiThoughts": "Кратко опиши твой процесс оценки в 2-3 предложениях."
}`;

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
[ПОЖЕЛАНИЯ]: ${userInput || "Что-то вкусное на оставшиеся калории"}
[СЕГОДНЯ УЖЕ СЪЕДЕНО]: ${recentMealsContext}
[ТЕКУЩЕЕ ВРЕМЯ]: ${timeOfDay} (${currentHour}:00)

Учитывай текущее время:
- Если сейчас Утро или День, НЕ предлагай блюда, которые заберут все оставшиеся калории, оставь место для следующих приемов пищи.
- Если сейчас Вечер, можно предлагать блюда на все оставшиеся калории.
- Не предлагай то, что превысит остаток.

Предложи 3-4 идеи. Это могут быть как рецепты, так и готовые продукты (популярные бренды).
Они должны вписываться в логичную калорийность для текущего времени суток.

В ОТВЕТЕ ВЕРНИ ТОЛЬКО И СТРОГО ЭТОТ JSON:
{
  "recommendations": [
    {
      "id": "1",
      "title": "Название",
      "shortDescription": "Краткое описание (1-2 предложения)",
      "calories": 300,
      "recipePrompt": "Текст-запрос к ИИ, если пользователь захочет получить полный пошаговый рецепт для этого блюда"
    }
  ]
}`;

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
