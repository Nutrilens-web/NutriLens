import { getAI } from './ai-wrapper';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Settings } from '../types';

export async function analyzeMealImage(
  settings: Settings,
  base64Images: string[],
  userContext: string,
  userInput: string,
  recentMealsContext: string = "",
  onProgress?: (msg: string) => void
) {
  const mode = settings.apiMode || 'free';
  if (mode === 'free' && !settings.apiKey) {
    throw new Error(
      "API ключ не указан. Пожалуйста, добавьте его в настройках."
    );
  }

  const prompt = `Ты высокоточный эксперт-диетолог и анализатор еды. Твоя задача - определить КБЖУ (калории, белки, жиры, углеводы) СУММАРНО для ВСЕХ продуктов или блюд, представленных на фотографиях и/или описанных в тексте.

ОБЩАЯ ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ: ${userContext}
ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userInput || (base64Images.length > 0 ? "Прикреплено только фото (без текста)." : "Текст отсутствует.")}
НЕДАВНИЕ ПРИЕМЫ ПИЩИ: ${recentMealsContext}

Количество предоставленных фотографий: ${base64Images.length}

ИНСТРУКЦИЯ К ВЫПОЛНЕНИЮ (ОЧЕНЬ ВАЖНО СТРОГО СЛЕДОВАТЬ):
1. Внимательно изучи текст и АБСОЛЮТНО ВСЕ прикрепленные фотографии. Если пользователь прислал несколько фото, ты ОБЯЗАН проанализировать еду на КАЖДОМ из них.
2. Если в тексте упоминается только одно блюдо, а на фото их несколько, ты ВСЕ РАВНО должен учесть всю еду со всех фото (текст просто дополняет информацию про одно блюдо, а не отменяет другие фото).
3. Суммируй КБЖУ для ВСЕЙ найденной еды (и из текста, и со ВСЕХ фото). Пересчитай данные на тот размер порции, который указан или очевиден, либо оцени вес на глаз.
4. Перед тем как выдавать итоговые калории и БЖУ, ты должна обязательно заполнить поле 'reasoning'. В нем пошагово опиши: какие ингредиенты ты видишь, оцени их примерный вес и учти скрытые калории (масло, соусы). Также оцени свою уверенность в распознавании блюда по шкале от 1 до 10 в поле 'confidence_score'. 
5. Обязательно скопируй содержимое 'reasoning' в поле 'aiThoughts', так как оно требуется фронтенду, добавив в конец перечисление ВСЕЙ найденной еды, расчеты КБЖУ и веса отдельно для каждого блюда.
6. В поле "name" запиши перечисление всей выявленной еды (например: "Омлет с сыром, кофе, сэндвич с курицей"). Ни в коем случае не оставляй пустым.
7. Поля calories, protein, fat, carbs должны содержать ИТОГОВЫЕ СУММАРНЫЕ числа для всего приема пищи, округленные до целых.
8. В любой непонятной ситуации делай лучшую примерную оценку (educated guess) - лучше приблизительные данные, чем нули.`;

  const imageParts = base64Images.map((img) => ({
    inlineData: {
      data: img.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: "image/jpeg",
    },
  }));

  const parts = [{ text: prompt }, ...imageParts];

  const callModel = async (modelName: string) => {
    const isNano = mode !== 'free';
    const ai = getAI({ 
      apiKey: settings.apiKey || 'dummy', 
      useNanoGPTOnly: isNano, 
      nanoModel: isNano ? modelName : undefined
    });

    try {
      const response = await ai.models.generateContent({
        model: mode === 'free' ? "gemini-2.5-flash" : modelName,
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
              reasoning: { type: Type.STRING },
              confidence_score: { type: Type.NUMBER },
            },
            required: ["name", "calories", "protein", "fat", "carbs", "aiThoughts", "reasoning", "confidence_score"],
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
      
      const text = response.text || "";
      if (!text) throw new Error("ИИ вернул пустой ответ.");
      return JSON.parse(text);
    } catch (e: any) {
      if (e.message?.toLowerCase().includes("safety") || e.message?.toLowerCase().includes("block")) {
        throw new Error("Запрос был заблокирован фильтрами безопасности Google Gemini.");
      }
      throw e;
    }
  };

  let parsedJson: any;

  if (mode === 'advanced') {
    parsedJson = await callModel("google/gemini-3.1-flash-lite");
    if (!parsedJson.confidence_score || parsedJson.confidence_score < 7) {
      if (onProgress) {
        onProgress("Блюдо сложное, подключаю глубокий анализ...");
      }
      parsedJson = await callModel("google/gemini-3-flash-preview-thinking");
    }
  } else if (mode === 'simple') {
    parsedJson = await callModel("google/gemini-3.1-flash-lite");
  } else {
    parsedJson = await callModel("gemini-2.5-flash");
  }

  return {
    aiThoughts: parsedJson.aiThoughts || parsedJson.reasoning || "",
    result: {
      name: parsedJson.name || "Распознанная еда",
      calories: Number(parsedJson.calories) || 0,
      protein: Number(parsedJson.protein) || 0,
      fat: Number(parsedJson.fat) || 0,
      carbs: Number(parsedJson.carbs) || 0,
      confidence_score: parsedJson.confidence_score,
      reasoning: parsedJson.reasoning
    },
  };
}

export async function getRecommendations(
  settings: Settings,
  userContext: string,
  userInput: string,
  remainingCalories: number,
  recentMealsContext: string = "",
) {
  if (!settings.apiKey && (!settings.apiMode || settings.apiMode === "free")) {
    throw new Error(
      "API ключ не указан. Пожалуйста, добавьте его в настройках.",
    );
  }

  const ai = getAI({ 
    apiKey: settings.apiKey, useNanoGPTOnly: settings.apiMode && settings.apiMode !== "free", nanoModel: settings.apiMode === "advanced" ? "google/gemini-3-flash-preview-thinking" : "google/gemini-3.1-flash-lite"});

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

export async function getDetailedRecipe(settings: Settings, recipePrompt: string) {
  if (!settings.apiKey && (!settings.apiMode || settings.apiMode === "free")) throw new Error("API ключ не указан.");
  const ai = getAI({ 
    apiKey: settings.apiKey, useNanoGPTOnly: settings.apiMode && settings.apiMode !== "free", nanoModel: settings.apiMode === "advanced" ? "google/gemini-3-flash-preview-thinking" : "google/gemini-3.1-flash-lite"});

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

export async function generateGroceryList(settings: Settings, userContext: string, dailyGoal: number, preferences: string) {
  const ai = getAI({ 
    apiKey: settings.apiKey, useNanoGPTOnly: settings.apiMode && settings.apiMode !== "free", nanoModel: settings.apiMode === "advanced" ? "google/gemini-3-flash-preview-thinking" : "google/gemini-3.1-flash-lite"});
  const prompt = `Составь план питания на неделю (на 1 человека) и соответствующий список покупок.
Цель: ${dailyGoal} ккал/день.
Контекст: ${userContext}
Пожелания пользователя: ${preferences || "Нет"}

План должен описывать, какие блюда готовить на неделю и на сколько дней они рассчитаны, чтобы вписаться в КБЖУ.
При составлении списка продуктов УКАЗЫВАЙ ТОЧНОЕ КОЛИЧЕСТВО, ВЕС ИЛИ ОБЪЕМ для каждого продукта (например, "Куриное филе - 1.5 кг", "Яйца - 20 шт", "Молоко - 2 л"). Не используй Markdown форматирование (двойные звездочки и т.д.), отвечай простым текстом.

Верни результат СТРОГО в формате JSON:
{
  "plan": "Описание плана питания на неделю (какие блюда, на сколько дней и калорий). Без markdown-разметки.",
  "categories": [
    {
      "category": "Название категории (Овощи, Мясо и т.д.)",
      "items": ["Продукт 1 - X шт/кг", "Продукт 2 - Y шт/кг"]
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plan: { type: Type.STRING },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                items: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["category", "items"]
            }
          }
        },
        required: ["plan", "categories"]
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { plan: "", categories: [] };
  }
}


