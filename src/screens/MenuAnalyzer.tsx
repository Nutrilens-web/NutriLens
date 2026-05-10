import React, { useState, useRef } from 'react';
import { Camera, ImagePlus, Sparkles, Utensils } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';

export function MenuAnalyzerScreen() {
  const { settings } = useStore();
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    if (!settings.apiKey) {
      setError("Укажите API ключ Gemini в настройках");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: settings.apiKey });
      const prompt = `Посмотри на фото меню из ресторана/кафе.
Пользователь: ${settings.userContext}. Лимит калорий: ${settings.dailyGoal} в день.
Твоя задача — помочь пользователю выбрать:
1. "Топ-3 самых здоровых блюда" из меню с примерной оценкой их КБЖУ.
2. "Что взять, если хочется..." (предложи самый безопасный вариант для сладкого или сытного).
3. "Красные флаги" (каких блюд из меню лучше избегать и почему).
Отвечай структурированно, используй Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: 'user', parts: [
            { text: prompt },
            { inlineData: { data: image.replace(/^data:image\/\w+;base64,/, ""), mimeType: "image/jpeg" } }
          ]}
        ],
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });
      setResult(response.text || "Не удалось проанализировать меню.");
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] bg-white rounded-[24px] shadow-[0_0_20px_rgba(0,0,0,0.02)] overflow-hidden p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-purple-100 p-1.5 rounded-full">
           <Utensils className="w-5 h-5 text-purple-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">Выбор в ресторане</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
        Сфотографируйте меню ресторана, и ИИ выберет лучшие блюда, подходящие под вашу цель, и поможет обойти "скрытые калории".
      </p>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[4/3] rounded-[20px] bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <ImagePlus className="w-6 h-6 text-gray-400" />
            <span className="text-[13px] font-medium text-gray-500">Добавить фото меню</span>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
          </div>
        ) : (
          <div className="relative group rounded-[20px] overflow-hidden">
            <img src={image} alt="Menu" className="w-full h-40 object-cover" />
            <button 
              onClick={() => { setImage(null); setResult(null); }}
              className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium hover:bg-black/70 transition-colors"
            >
              Изменить
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-500 text-[13px] p-3 rounded-[12px]">
            {error}
          </div>
        )}

        {image && !result && !isLoading && (
          <button
            onClick={handleAnalyze}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-purple-700 active:scale-[0.98] transition-all text-[13px]"
          >
            <Sparkles className="w-4 h-4" />
            Проанализировать
          </button>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-6 h-6 border-[3px] border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[13px] text-gray-500 font-medium">Читаем меню...</p>
          </div>
        )}

        {result && (
          <div className="bg-purple-50 rounded-[16px] p-4 prose prose-sm prose-purple max-w-none text-[13px]">
            <Markdown>{result}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
