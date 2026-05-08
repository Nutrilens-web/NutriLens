import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

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

  const prompt = `Ты высокоточный эксперт-диетолог и анализатор еды. Твоя задача - определить КБЖУ (калории, белки, жиры, углеводы) для продукта или блюда, используя описание и/или фото.

ОБЩАЯ ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ: ${userContext}
ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userInput || (base64Images.length > 0 ? "Прикреплено только фото (без текста)." : "Текст отсутствует.")}
НЕДАВНИЕ ПРИЕМЫ ПИЩИ: ${recentMealsContext}

ИНСТРУКЦИЯ К ВЫПОЛНЕНИЮ (ОЧЕНЬ ВАЖНО СТРОГО СЛЕДОВАТЬ):
1. Внимательно изучи текст и фото. Если на фото есть этикетка с Белками, Жирами, Углеводами и Калориями, прочитай эти данные внимательно.
2. Пересчитай данные на тот размер порции, который указал пользователь (например, "Я съел одно печенье", "100г", "порция"). Если порция не указана, сделай экспертную оценку веса на глаз или возьми стандартную порцию.
3. В поле "aiThoughts" подробно распиши свои рассуждения шаг за шагом: что ты видишь, сколько грамм порция, какие КБЖУ на 100г, какая математика применена (покажи умножение) и итоговые цифры.
4. В поле "name" запиши точное и понятное название того, что съел пользователь, опираясь на фото и текст (например, "Печенье Belvita (1 шт)"). Ни в коем случае не оставляй пустым или "Неизвестно".
5. Поля calories, protein, fat, carbs должны содержать итоговые числа, округленные до целых.
6. В любой непонятной ситуации делай лучшую примерную оценку (educated guess) - лучше приблизительные данные, чем нули.`;

  const imageParts = base64Images.map((img) => ({
    inlineData: {
      data: img.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: "image/jpeg", // assuming jpeg for now
    },
  }));

  const parts = [{ text: prompt }, ...imageParts];

  let response;
  try {
    response = await ai.models.generateContent({
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
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            fat: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            aiThoughts: { type: Type.STRING },
          },
          required: ["name", "calories", "protein", "fat", "carbs", "aiThoughts"],
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      },
    });
  } catch (e: any) {
    if (e.message?.toLowerCase().includes("safety") || e.message?.toLowerCase().includes("block")) {
      throw new Error("Запрос был заблокирован фильтрами безопасности Google Gemini. Попробуйте обрезать фото или описать еду только текстом.");
    }
    throw new Error("Ошибка генерации ИИ: " + (e.message || "Неизвестная ошибка"));
  }

  const text = response.text || "";
  
  if (!text) {
    throw new Error("ИИ вернул пустой ответ. Возможно, сработал фильтр безопасности из-за содержимого фото.");
  }

  let parsedJson: any = {};

  try {
    parsedJson = JSON.parse(text);
  } catch (e) {
    throw new Error("Не удалось распознать ответ от ИИ: " + text);
  }

  return {
    aiThoughts: parsedJson.aiThoughts || "",
    result: {
      name: parsedJson.name || "Распознанная еда",
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
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                shortDescription: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                recipePrompt: { type: Type.STRING }
              },
              required: ["id", "title", "shortDescription", "calories", "recipePrompt"]
            }
          }
        },
        required: ["recommendations"]
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
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
    config: {
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    }
  });

  return response.text || "К сожалению, рецепт недоступен.";
}

export async function generateGroceryList(apiKey: string, userContext: string, dailyGoal: number, preferences: string) {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Составь список покупок на неделю на одного человека.
Цель: ${dailyGoal} ккал/день.
Контекст: ${userContext}
Пожелания пользователя: ${preferences || "Нет"}

Ты должен вернуть JSON массив категорий, в каждой из которых список продуктов.
Кратко и понятно. Не включай слишком экзотические продукты, если они не запрошены. Важно: только здоровые и соответствующие цели продукты.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["category", "items"]
        }
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}

export async function generateRecipesByCategory(apiKey: string, userContext: string, dailyGoal: number, category: string) {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Ты диетолог. Придумай 3 интересных и здоровых рецепта в категории: ${category}.
Они должны соответствовать контексту: ${userContext} (цель дня: ${dailyGoal} ккал).

Верни JSON:
[
  {
    "title": "Название",
    "description": "Краткое описание на 100 символов",
    "calories": Примерные калории (число),
    "prompt": "Данные для генерации полного рецепта - подробное название"
  }
]
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            prompt: { type: Type.STRING }
          },
          required: ["title", "description", "calories", "prompt"]
        }
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}
