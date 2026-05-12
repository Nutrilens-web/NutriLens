import { getAI } from '../utils/ai-wrapper';
import React, { useState } from 'react';
import { Sparkles, Droplets, Plus, Minus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';

export function WaterTrackerScreen() {
  const { settings } = useStore();
  const [amount, setAmount] = useState(0); // For demo purposes, we do local state
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getWaterAdvice = async () => {
    if (!settings.apiKey) {
      setError("Укажите API ключ Gemini в настройках");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ai = getAI({ apiKey: settings.apiKey });
      const prompt = `Пользователь: ${settings.userContext}.
Проанализируй эти данные и:
1. Вычисли рекомендуемую индивидуальную норму воды в день (в литрах и стаканах).
2. Дай 3 коротких практических совета, как не забывать её пить.
Отвечай структурировано.`;

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
      setAdvice(response.text || "Не удалось получить рекомендации.");
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации.");
    } finally {
      setIsLoading(false);
    }
  };

  const glassesCount = Math.floor(amount / 250);

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] bg-white rounded-[24px] shadow-[0_0_20px_rgba(0,0,0,0.02)] overflow-hidden p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-sky-100 p-1.5 rounded-full">
           <Droplets className="w-5 h-5 text-sky-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">Водный баланс</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
        Поддерживайте уровень гидратации. ИИ может рассчитать вашу личную норму воды и дать советы на основе данных профиля.
      </p>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        
        <div className="bg-sky-50 rounded-[20px] p-5 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-sky-600 mb-1">{amount} мл</div>
          <div className="text-xs font-medium text-sky-500 mb-5">Выпито за сегодня (~{glassesCount} стак.)</div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAmount(Math.max(0, amount - 250))}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-sky-600 shadow-sm border border-sky-100 hover:bg-sky-50 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setAmount(amount + 250)}
              className="w-14 h-14 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-md shadow-sky-200 hover:bg-sky-600 active:scale-95 transition-all"
            >
              <Droplets className="w-5 h-5 fill-white" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-[13px] p-3 rounded-[12px]">
            {error}
          </div>
        )}

        {!advice && !isLoading && (
          <button
            onClick={getWaterAdvice}
            className="w-full flex items-center justify-center gap-2 bg-white text-sky-600 border border-sky-200 font-medium py-2.5 px-4 rounded-xl hover:bg-sky-50 transition-all shadow-sm text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Рассчитать мою норму (ИИ)
          </button>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-6 h-6 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[13px] text-gray-500 font-medium">Считаем вашу норму...</p>
          </div>
        )}

        {advice && (
          <div className="bg-slate-50 rounded-[16px] p-4 prose prose-sm prose-sky max-w-none border border-slate-100 text-[13px]">
             <Markdown>{advice}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
