import { getAI } from '../utils/ai-wrapper';
import React, { useState } from 'react';
import { Sparkles, Activity, Target } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';

export function HabitAnalyzerScreen() {
  const { settings } = useStore();
  const [habit, setHabit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAnalysis = async () => {
    if (!habit.trim()) return;
    if (!settings.apiKey) {
      setError("Укажите API ключ Gemini в настройках");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ai = getAI({ apiKey: settings.apiKey });
      const prompt = `Пользователь: ${settings.userContext}.
У пользователя есть следующая привычка или проблема с питанием: "${habit}".

Проанализируй эту привычку. Предоставь:
1. Возможные скрытые причины такого поведения (физиология, эмоции).
2. 3 практических и работающих шага, как это исправить или заменить на полезную альтернативу.
3. Короткую мотивацию.
Структурируй ответ и используй Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });
      setAnalysis(response.text || "Не удалось получить анализ.");
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] bg-white rounded-[24px] shadow-[0_0_20px_rgba(0,0,0,0.02)] overflow-hidden p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-rose-100 p-1.5 rounded-full">
           <Activity className="w-5 h-5 text-rose-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">Разбор привычек</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
        Опишите свою рутину или тягу к каким-то продуктам (например, "сильная тяга к сладкому вечером"), и ИИ поможет найти причину и пути решения.
      </p>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
        
        <div>
          <textarea
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
            placeholder="Я постоянно объедаюсь на ночь и не могу остановиться..."
            className="w-full h-24 px-3 py-2.5 rounded-[16px] bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:border-rose-500 transition-colors resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-[13px] p-3 rounded-[12px]">
            {error}
          </div>
        )}

        <button
          onClick={getAnalysis}
          disabled={!habit.trim() || isLoading}
          className="w-full flex items-center justify-center gap-2 bg-rose-500 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-[2px] border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Target className="w-4 h-4" />
              Разобрать привычку
            </>
          )}
        </button>

        {analysis && (
          <div className="bg-rose-50 rounded-[16px] p-4 prose prose-sm prose-rose max-w-none border border-rose-100 mt-3 text-[13px]">
             <Markdown>{analysis}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
