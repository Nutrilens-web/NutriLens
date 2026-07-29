import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useState, useRef } from 'react';
import { Camera, ImagePlus, Sparkles, ChefHat, Utensils, X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { compressImage } from '../utils/image';
import { getLocalDateString } from '../utils/date';
import { ToolShell } from './ui';
import { haptic } from './haptics';

/* ============================================================
   FreshPhotoTool — общий экран «фото → ИИ-анализ» (холодильник,
   меню ресторана). Различаются только промпт/иконка/акцент —
   вынесены в конфиг, чтобы не дублировать ~150 строк на инструмент.
   ============================================================ */

interface PhotoToolConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  title: string;
  description: string;
  cta: string;
  loading: string;
  emptyResult: string;
  buildPrompt: (ctx: { userContext: string; dailyGoal: number; remaining: number; useRemaining: boolean }) => string;
}

function FreshPhotoTool({ onBack, config }: { onBack?: () => void; config: PhotoToolConfig }) {
  const { settings, meals } = useStore();
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useRemainingCalories, setUseRemainingCalories] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const todayCalories = meals.filter((m) => m.date === getLocalDateString()).reduce((a, m) => a + m.calories, 0);
  const remainingCalories = Math.max(0, settings.dailyGoal - todayCalories);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f, 1536, 1536)));
      setImages((prev) => [...prev, ...compressed]);
      setResult(null);
    } catch {
      setError('Ошибка при обработке фото');
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (images.length === 1) setResult(null);
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
      const prompt = config.buildPrompt({
        userContext: settings.userContext,
        dailyGoal: settings.dailyGoal,
        remaining: remainingCalories,
        useRemaining: useRemainingCalories,
      });
      const imageParts = images.map((img) => ({
        inlineData: { data: img.replace(/^data:image\/\w+;base64,/, ''), mimeType: 'image/jpeg' },
      }));
      const response = await ai.models.generateContent({
        model: getModelForMode(settings.apiMode),
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });
      setResult(response.text || config.emptyResult);
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ToolShell onBack={onBack || (() => {})} icon={config.icon} accent={config.accent} title={config.title} description={config.description}>
      {useRemainingCalories && (
        <p className="text-xs text-ink-soft -mt-2">
          Остаток на сегодня: <span className="font-bold text-accent">{remainingCalories} ккал</span>.
        </p>
      )}

      <label className="flex items-center gap-2.5 bg-surface-2 border border-line/50 p-3 rounded-2xl cursor-pointer hover:bg-accent-soft/50 transition-colors">
        <input
          type="checkbox"
          checked={useRemainingCalories}
          onChange={(e) => setUseRemainingCalories(e.target.checked)}
          className="rounded-md border-line text-accent focus:ring-accent/40 w-4 h-4 accent-[var(--f-accent)]"
        />
        <span className="text-[13px] font-medium text-ink">Учитывать остаток калорий</span>
      </label>

      <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageSelect} />

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {images.map((img, idx) => (
            <div key={idx} className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden bg-surface-2">
              <img src={img} alt="Фото" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 bg-ink/60 text-canvas p-1 rounded-full hover:bg-danger transition-colors"
                aria-label="Удалить фото"
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
          className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-surface-2 border border-line/60 text-ink-soft rounded-xl hover:bg-accent-soft hover:text-accent text-[13px] font-semibold transition-colors"
        >
          <ImagePlus className="w-4 h-4" /> Галерея
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-surface-2 border border-line/60 text-ink-soft rounded-xl hover:bg-accent-soft hover:text-accent text-[13px] font-semibold transition-colors"
        >
          <Camera className="w-4 h-4" /> Камера
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 text-[13px] p-3.5 rounded-2xl font-medium">{error}</div>
      )}

      {images.length > 0 && !result && !isLoading && (
        <button
          onClick={() => {
            haptic('medium');
            handleAnalyze();
          }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-accent to-accent-strong text-white font-bold py-3 px-4 rounded-2xl shadow-glow hover:brightness-105 active:scale-[0.98] transition-all text-[13px]"
        >
          <Sparkles className="w-4 h-4" /> {config.cta}
        </button>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <p className="text-[13px] text-ink-soft font-medium">{config.loading}</p>
        </div>
      )}

      {result && (
        <div className="bg-surface-2 border border-line/50 rounded-2xl p-4 prose prose-sm max-w-none text-[13px] text-ink-soft [&_strong]:text-ink [&_li]:marker:text-accent">
          <Markdown>{result}</Markdown>
        </div>
      )}
    </ToolShell>
  );
}

export function FreshFridge({ onBack }: { onBack?: () => void }) {
  return (
    <FreshPhotoTool
      onBack={onBack}
      config={{
        icon: ChefHat,
        accent: 'var(--f-protein)',
        title: 'Разбор холодильника',
        description: 'Загрузите фото открытого холодильника или продуктов на столе, и ИИ предложит рецепты.',
        cta: 'Придумать рецепты',
        loading: 'Изучаем продукты...',
        emptyResult: 'Не удалось придумать рецепты.',
        buildPrompt: ({ userContext, dailyGoal, remaining, useRemaining }) =>
          `Посмотри на фото продуктов (содержимое холодильника или стола).
Пользователь: ${userContext}.${useRemaining ? ` Цель на день: ${dailyGoal} ккал. Свободно на сегодня: ${remaining} ккал.` : ''}
Предложи 3 здоровых рецепта, используя ПРЕИМУЩЕСТВЕННО то, что видишь на фото${useRemaining ? ', стараясь вписаться в оставшиеся калории (если их много — можно сытнее, если мало — более лёгкие)' : ''}. Для каждого рецепта:
1. Название и КБЖУ (калории, белки, жиры, углеводы).
2. Какие ингредиенты из увиденного используются.
3. Чего не хватает (что нужно докупить по минимуму — НЕ БОЛЕЕ 2 товаров).
4. Краткий рецепт.
Опиши с Markdown-форматированием. Не предлагай блюда, если на фото нет соответствующих ингредиентов.`,
      }}
    />
  );
}

export function FreshMenu({ onBack }: { onBack?: () => void }) {
  return (
    <FreshPhotoTool
      onBack={onBack}
      config={{
        icon: Utensils,
        accent: 'var(--f-carbs)',
        title: 'Выбор в ресторане',
        description: 'Сфотографируйте меню, и ИИ поможет сделать выбор.',
        cta: 'Проанализировать меню',
        loading: 'Читаем меню...',
        emptyResult: 'Не удалось проанализировать меню.',
        buildPrompt: ({ userContext, dailyGoal, remaining, useRemaining }) =>
          `Посмотри на фото меню из ресторана/кафе.
Пользователь: ${userContext}. Дневной лимит калорий: ${dailyGoal} ккал.${useRemaining ? ` Свободно на сегодня: ${remaining} ккал (подбери блюда, которые не превысят этот остаток).` : ' Подбери блюда в рамках дневного лимита.'}
Твоя задача — помочь пользователю выбрать блюда:
1. "Топ-3 лучших варианта" из меню с примерной оценкой КБЖУ для каждой позиции.
2. "Что взять, если хочется..." — для сладкого, сытного, лёгкого (по одному варианту).
3. "Красные флаги" — какие блюда в меню лучше избегать и почему (скрытые калории, жареное, соусы, огромные порции).
Отвечай структурированно, используй Markdown. Не давай медицинских рекомендаций.`,
      }}
    />
  );
}
