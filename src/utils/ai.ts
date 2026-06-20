import { getAIForSettings, getApiKeyError } from './ai-wrapper';
import { Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Settings } from '../types';
import { MODELS, getModelForMode, ADVANCED_ESCALATION_THRESHOLD } from './models';

export async function analyzeMealImage(
  settings: Settings,
  base64Images: string[],
  userContext: string,
  userInput: string,
  recentMealsContext: string = "",
  onProgress?: (msg: string) => void
) {
  const mode = settings.apiMode || 'free';
  const keyError = getApiKeyError(settings);
  if (keyError) {
    throw new Error(keyError);
  }

  const prompt = `Ты высокоточный эксперт-диетолог и анализатор еды. Твоя задача - определить КБЖУ (калории, белки, жиры, углеводы) СУММАРНО для ВСЕХ продуктов или блюд, представленных на фотографиях и/или описанных в тексте.

ОБЩАЯ ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ: ${userContext}
ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userInput || (base64Images.length > 0 ? "Прикреплено только фото (без текста)." : "Текст отсутствует.")}
НЕДАВНИЕ ПРИЕМЫ ПИЩИ (ТОЛЬКО ДЛЯ КОНТЕКСТА, НЕ ПЛЮСУЙ ИХ К НОВОЙ ЕДЕ): ${recentMealsContext}

Количество предоставленных фотографий: ${base64Images.length}

ИНСТРУКЦИЯ К ВЫПОЛНЕНИЮ (ОЧЕНЬ ВАЖНО СТРОГО СЛЕДОВАТЬ):
1. Внимательно изучи текст (ЗАПРОС ПОЛЬЗОВАТЕЛЯ) и АБСОЛЮТНО ВСЕ прикрепленные фотографии. Если пользователь прислал несколько фото, ты ОБЯЗАН проанализировать еду на КАЖДОМ из них.
2. Если в тексте упоминается только одно блюдо, а на фото их несколько, ты ВСЕ РАВНО должен учесть всю еду со всех фото (текст просто дополняет информацию про одно блюдо, а не отменяет другие фото).
3. Суммируй КБЖУ для ВСЕЙ НОВОЙ найденной еды (и из текста, и со ВСЕХ фото). КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ добавлять в сумму "Недавние приемы пищи" — они предоставлены только как история, чтобы ты понимал контекст (например, если пользователь пишет "съел еще порцию того же").
4. Перед тем как выдавать итоговые калории и БЖУ, ты должен обязательно заполнить поле 'reasoning'. В нем пошагово опиши: какие ингредиенты ты видишь, оцени их примерный вес и учти скрытые калории (масло, соусы).
5. Поле 'confidence_score' (от 1 до 10) — это твоя УВЕРЕННОСТЬ В ТОЧНОСТИ РАСЧЁТА КБЖУ, а не просто факт распознавания блюда. Считай низко (3-5), если: порция оценена грубо, блюдо смешанное/неоднородное, скрытые жиры неясны, фото размыто или ракурс не позволяет оценить объём. Считай высоко (8-10) только при чёткой порции и однозначных ингредиентах. Честная низкая оценка важнее завышенной.
6. В поле 'aiThoughts' дай КРАТКУЮ сводку для пользователя: перечисли всю найденную еду и финальные цифры КБЖУ + веса по каждому блюду. Не дублируй туда весь 'reasoning'.
7. В поле "name" запиши перечисление всей выявленной еды (например: "Омлет с сыром, кофе, сэндвич с курицей"). Ни в коем случае не оставляй пустым.
8. Поля calories, protein, fat, carbs должны содержать ИТОГОВЫЕ СУММАРНЫЕ числа ТОЛЬКО для НОВОГО приема пищи из фото/запроса, округленные до целых.
9. В любой непонятной ситуации делай лучшую примерную оценку (educated guess) - лучше приблизительные данные, чем нули.`;

  const imageParts = base64Images.map((img) => ({
    inlineData: {
      data: img.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: "image/jpeg",
    },
  }));

  const parts = [{ text: prompt }, ...imageParts];

  const callModel = async (modelName: string) => {
    const ai = getAIForSettings(settings);

    try {
      const response = await ai.models.generateContent({
        // free-режим использует официальный Google SDK → берём «голое» имя из MODELS.free.
        // simple/advanced идут через NanoGPT и尊重ят переданному modelName.
        model: mode === "free" ? MODELS.free : modelName,
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
    // Каскадная маршрутизация по сложности:
    // 1) Дешёвая лёгкая модель (flash-lite) делает первый проход и сама оценивает
    //    уверенность в точности КБЖУ (confidence_score).
    // 2) Если уверенность ниже порога — задача уходит на мощную thinking-модель.
    //    Это экономит дорогие вызовы на простых блюдах и держит точность на сложных.
    parsedJson = await callModel(MODELS.advancedLite);
    const conf = Number(parsedJson.confidence_score);
    if (!conf || conf < ADVANCED_ESCALATION_THRESHOLD) {
      if (onProgress) {
        onProgress("Блюдо сложное, подключаю глубокий анализ...");
      }
      parsedJson = await callModel(MODELS.advanced);
    }
  } else {
    // free и simple — один вызов соответствующей модели.
    parsedJson = await callModel(getModelForMode(mode));
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
  const keyError = getApiKeyError(settings);
  if (keyError) throw new Error(keyError);

  const ai = getAIForSettings(settings);
  const mode = settings.apiMode || 'free';
  const modelName = getModelForMode(mode);

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
    model: modelName,
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
  const keyError = getApiKeyError(settings);
  if (keyError) throw new Error(keyError);
  const ai = getAIForSettings(settings);
  const mode = settings.apiMode || 'free';
  const modelName = getModelForMode(mode);

  const prompt = `Напиши подробный пошаговый рецепт для следующего блюда:
${recipePrompt}
Включи ингредиенты (с граммовками) и пошаговую инструкцию. Отвечай просто текстом (без сложного форматирования, используй обычные списки с тире). Не используй JSON.`;

  const response = await ai.models.generateContent({
    model: modelName,
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
  const ai = getAIForSettings(settings);
  const mode = settings.apiMode || 'free';
  const modelName = getModelForMode(mode);
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
    model: modelName,
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


