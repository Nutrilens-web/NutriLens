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

  const prompt = `Ты высокоточный эксперт-диетолог и анализатор еды. Твоя задача — определить КБЖУ (калории, белки, жиры, углеводы) СУММАРНО для ВСЕХ продуктов или блюд, представленных на фотографиях и/или описанных в тексте.

ОБЩАЯ ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ: ${userContext}
ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userInput || (base64Images.length > 0 ? "Прикреплено только фото (без текста)." : "Текст отсутствует.")}
НЕДАВНИЕ ПРИЕМЫ ПИЩИ (ТОЛЬКО ДЛЯ КОНТЕКСТА, НЕ ПЛЮСУЙ ИХ К НОВОЙ ЕДЕ): ${recentMealsContext}

Количество предоставленных фотографий: ${base64Images.length}

ИНСТРУКЦИЯ К ВЫПОЛНЕНИЮ (ОЧЕНЬ ВАЖНО СТРОГО СЛЕДОВАТЬ):

ШАГ 1 — РАЗБОР. Изучи текст (ЗАПРОС ПОЛЬЗОВАТЕЛЯ) и АБСОЛЮТНО ВСЕ прикреплённые фотографии. Если фото несколько (разные блюда, ракурсы или общий вид стола), сопоставь их между собой, чтобы не посчитать одно и то же блюдо дважды. Составь ПОЛНЫЙ список всех отдельных блюд/продуктов на этом приёме пищи.

ШАГ 2 — КАЛИБРОВКА РАЗМЕРА. Оцени вес каждой порции, опираясь на калибровку:
  • Данные пользователя о посуде и типичных порциях (диаметр тарелки, объём чашки, стандартная порция) — используй их как масштаб.
  • Если посуду видно на фото — ориентируйся на её реальные размеры (стандартная тарелка ~23–26 см, кружка ~250–300 мл, столовая ложка ~15 г/15 мл).
  • Сравнивай видимый объём еды с этой посудой, а не «на глаз».

ШАГ 3 — ПОЭЛЕМЕНТНЫЙ РАСЧЁТ (ОБЯЗАТЕЛЕН). Для КАЖДОГО блюда из списка заполни элемент массива 'items':
  • name — название блюда/продукта.
  • estimated_weight_g — оценочный вес порции в граммах (целое число).
  • calorie_density — типовая калорийность этого продукта в ккал на 100 г (число, например 250, 90, 520).
  • calories/protein/fat/carbs — КБЖУ именно этой порции (посчитай от плотности и веса; белки/жиры/углеводы — в граммах).
  • breakdown — короткая строка-расчёт: «{вес}г × {плотность} ккал/100г = {итог} ккал» плюс список ключевых ингредиентов и скрытых калорий (масло для жарки ~10 г/порция, соусы, сахар в напитках).
Это заставляет считать системно, а не угадывать сумму.

ШАГ 4 — ИТОГ. Суммируй calories/protein/fat/carbs по всем items — это финальные поля верхнего уровня. Скрытые калории (масло, соусы) добавляй в соответствующий item. КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ добавлять в сумму «Недавние приёмы пищи» — это только контекст.

ШАГ 5 — ПОЛЯ ОТВЕТА:
  • name — перечисление всей найденной еды (например: «Омлет с сыром, кофе, сэндвич с курицей»). Не пустое.
  • reasoning — подробная цепочка рассуждений (блюдо за блюдом: что вижу → вес → плотность → скрытые калории → итог). Это обоснование, а не итог.
  • aiThoughts — КРАТКАЯ сводка для пользователя: список блюд с финальными КБЖУ и весом. Без полного дублирования reasoning.
  • confidence_score (целое 1–10) — уверенность в ТОЧНОСТИ РАСЧЁТА КБЖУ, а не факт распознавания. НИЗКО (3–5) при: грубой оценке порции, смешанном/слоёном блюде, неясных скрытых жирах, размытом фото или ракурсе без оценки объёма. ВЫСОКО (8–10) только при чёткой порции, понятном составе и калибровке по посуде. Поле обязательно — не оставляй пустым. Честная низкая оценка важнее завышенной.

ОКРУГЛЕНИЕ: calories — целое; protein/fat/carbs — до целых, для порций до 20 г допустим 1 знак после запятой.
В любой непонятной ситуации делай лучшую примерную оценку (educated guess) — лучше приблизительные данные, чем нули.`;

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
              // Поэлементная разбивка блюда — заставляет модель считать КБЖУ
              // через вес × плотность калорий для каждого продукта отдельно,
              // а не угадывать итог. Также видна пользователю (обоснование).
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    estimated_weight_g: { type: Type.NUMBER },
                    calorie_density: { type: Type.NUMBER },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    breakdown: { type: Type.STRING },
                  },
                  required: ["name", "estimated_weight_g", "calorie_density", "calories", "protein", "fat", "carbs", "breakdown"],
                },
              },
            },
            required: ["name", "calories", "protein", "fat", "carbs", "aiThoughts", "reasoning", "confidence_score", "items"],
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
    // confidence_score может прийти null/пустым/нечислом — трактуем это как
    // низкую уверенность (0), чтобы такие случаи тоже ушли на эскалацию,
    // а не молча остались с ненадёжным результатом лёгкой модели.
    const conf = Number(parsedJson.confidence_score) || 0;
    if (conf < ADVANCED_ESCALATION_THRESHOLD) {
      if (onProgress) {
        onProgress("Блюдо сложное, подключаю глубокий анализ...");
      }
      parsedJson = await callModel(MODELS.advanced);
    }
  } else {
    // free и simple — один вызов соответствующей модели.
    parsedJson = await callModel(getModelForMode(mode));
  }

  // Защита от самого частого источника ошибок: модель часто суммирует КБЖУ по
  // items неточно (ошибается на 10-30%). Если поэлементная разбилка есть и её
  // сумма существенно расходится с итоговыми полями верхнего уровня — верим
  // сумме items (она считается из веса × плотность и потому надёжнее), а
  // финальные поля берём из неё. Это повышает итоговую точность.
  const rawItems: any[] = Array.isArray(parsedJson.items) ? parsedJson.items : [];
  let totals = {
    calories: Number(parsedJson.calories) || 0,
    protein: Number(parsedJson.protein) || 0,
    fat: Number(parsedJson.fat) || 0,
    carbs: Number(parsedJson.carbs) || 0,
  };
  if (rawItems.length > 0) {
    const sum = rawItems.reduce(
      (acc, it) => ({
        calories: acc.calories + (Number(it.calories) || 0),
        protein: acc.protein + (Number(it.protein) || 0),
        fat: acc.fat + (Number(it.fat) || 0),
        carbs: acc.carbs + (Number(it.carbs) || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
    const significantDrift = Math.abs(sum.calories - totals.calories) > Math.max(30, totals.calories * 0.1);
    if (significantDrift) {
      totals = {
        calories: Math.round(sum.calories),
        protein: Math.round(sum.protein),
        fat: Math.round(sum.fat),
        carbs: Math.round(sum.carbs),
      };
    }
  }

  return {
    aiThoughts: parsedJson.aiThoughts || parsedJson.reasoning || "",
    result: {
      name: parsedJson.name || "Распознанная еда",
      calories: totals.calories,
      protein: totals.protein,
      fat: totals.fat,
      carbs: totals.carbs,
      confidence_score: parsedJson.confidence_score,
      reasoning: parsedJson.reasoning,
      items: rawItems,
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

  // Макроцели — если пользователь их задал, ИИ подбирает блюда не только под
  // калории, но и под баланс белков/жиров/углеводов на день.
  const macroLine = (settings.proteinGoal || settings.fatGoal || settings.carbsGoal)
    ? ` Цели на день по макросам: Б ${settings.proteinGoal || '—'} г / Ж ${settings.fatGoal || '—'} г / У ${settings.carbsGoal || '—'} г. Учитывай, сколько из этих макросов уже съедено сегодня (см. «СЕГОДНЯ УЖЕ СЪЕДЕНО») и предлагай блюда, которые помогают дотянуть белок/жиры/углеводы до цели, не перебирая.`
    : '';

  const prompt = `Ты профессиональный диетолог. Подбери конкретные идеи для еды под оставшиеся ${remainingCalories} ккал пользователя.
[КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ]: ${userContext}
[ОТКРЫТЫЙ ЗАПРОС / ПОЖЕЛАНИЯ СЕЙЧАС]: ${userInput || "Обычный прием пищи"}
[СЕГОДНЯ УЖЕ СЪЕДЕНО]: ${recentMealsContext || "пока ничего"}
[ТЕКУЩЕЕ ВРЕМЯ]: ${timeOfDay} (${currentHour}:00)${macroLine}

Правила подбора:
1. Если пользователь напрямую просит конкретную идею или продукт («хочу сладкое», «что-то из творога», «идеи для тренировки»), строго следуй этому запросу, но в рамках остатка калорий.
2. Если сейчас Утро или День, НЕ предлагай блюда, которые заберут ВСЕ оставшиеся калории — оставь место для следующих приёмов пищи.
3. Если сейчас Вечер, можно предлагать блюда на весь оставшийся остаток.
4. Каждое предложенное блюдо НЕ должно превышать оставшийся остаток калорий.
5. Не повторяй то, что пользователь уже ел сегодня (см. «СЕГОДНЯ УЖЕ СЪЕДЕНО»).

Верни РОВНО 3 идеи в виде JSON-объекта со строгой структурой (см. schema). Поле 'recipePrompt' для каждого блюда — это КРАТКОЕ описание состава и способа приготовления (2-3 предложения), которое позже будет развёрнуто в полный рецепт. 'calories' — итоговая калорийность порции (целое число, не больше остатка).`;

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


