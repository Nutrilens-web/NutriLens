import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useState, useRef } from 'react';
import { Camera, ImagePlus, Sparkles, ChefHat, X, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { compressImage } from '../utils/image';
import { getLocalDateString } from '../utils/date';

export function FridgeScannerScreen({ onBack }: { onBack?: () => void }) {
  const { settings, meals } = useStore();
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [useRemainingCalories, setUseRemainingCalories] = useState(true);

  const todayCalories = meals
    .filter(m => m.date === getLocalDateString())
    .reduce((acc, m) => acc + m.calories, 0);
  const remainingCalories = Math.max(0, settings.dailyGoal - todayCalories);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    try {
      const compressedImages = await Promise.all(
        files.map(file => compressImage(file, 1536, 1536))
      );
      setImages(prev => [...prev, ...compressedImages]);
      setResult(null);
    } catch (err) {
      setError("Ошибка при обработке фото");
    }
    
    // Clear input so we can upload the same file again if needed
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (images.length === 1) {
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ai = getAIForSettings(settings);
      const prompt = `Посмотри на фото продуктов (содержимое холодильника или стола). 
Пользователь: ${settings.userContext}.${useRemainingCalories ? ` Цель на день: ${settings.dailyGoal} ккал. Свободно на сегодня: ${remainingCalories} ккал.` : ''}
Предложи 3 здоровых рецепта из того, что ты видишь${useRemainingCalories ? ', стараясь вписаться в оставшиеся калории (если их много - можно сытнее, если мало - более легкие)' : ''}. Для каждого рецепта:
1. Название и примерная калорийность
2. Какие ингредиенты с фото используются
3. Чего не хватает (что нужно докупить по минимуму, если нужно)
4. Краткий рецепт
Опиши красиво и с использованием форматирования Markdown.`;

      const imageParts = images.map(img => ({
        inlineData: { data: img.replace(/^data:image\/\w+;base64,/, ""), mimeType: "image/jpeg" }
      }));

      const response = await ai.models.generateContent({
        model: getModelForMode(settings.apiMode),
        contents: [
          { role: 'user', parts: [
            { text: prompt },
            ...imageParts
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
      setResult(response.text || "Не удалось придумать рецепты.");
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] bg-white rounded-[24px] shadow-[0_0_20px_rgba(0,0,0,0.02)] overflow-hidden p-4">
      <div className="flex items-center gap-2 mb-2">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" aria-label="Назад">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="bg-blue-100 p-1.5 rounded-full">
           <ChefHat className="w-5 h-5 text-blue-600" />
        </div>
        <div>
           <h2 className="text-lg font-bold text-gray-900">Разбор холодильника</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
        Загрузите фото открытого холодильника или продуктов на столе, и ИИ предложит рецепты.
        {useRemainingCalories && (
          <> Остаток на сегодня: <span className="text-emerald-600 font-bold">{remainingCalories} ккал</span>.</>
        )}
      </p>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
        <label className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-[12px] cursor-pointer hover:bg-gray-100 transition-colors">
          <input 
            type="checkbox" 
            checked={useRemainingCalories} 
            onChange={(e) => setUseRemainingCalories(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
          />
          <span className="text-[13px] font-medium text-gray-700">Учитывать остаток калорий</span>
        </label>

        <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageSelect} />
        
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 flex-shrink-0 group rounded-[16px] overflow-hidden bg-gray-50">
                <img src={img} alt="Fridge" className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full text-xs font-medium hover:bg-black/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 text-[13px] font-medium border border-gray-200 transition-colors"
          >
            <ImagePlus className="w-4 h-4 text-gray-500" />
            Галерея
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 text-[13px] font-medium border border-gray-200 transition-colors"
          >
            <Camera className="w-4 h-4 text-gray-500" />
            Камера
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 text-[13px] p-3 rounded-[12px]">
            {error}
          </div>
        )}

        {images.length > 0 && !result && !isLoading && (
          <button
            onClick={handleAnalyze}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-[13px]"
          >
            <Sparkles className="w-4 h-4" />
            Придумать рецепты
          </button>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-6 h-6 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[13px] text-gray-500 font-medium">Изучаем продукты...</p>
          </div>
        )}

        {result && (
          <div className="bg-blue-50 rounded-[16px] p-4 prose prose-sm prose-blue max-w-none text-[13px]">
            <Markdown>{result}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

