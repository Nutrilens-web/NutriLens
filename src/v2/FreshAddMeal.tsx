import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  ArrowLeft,
  Camera,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
  Plus,
  Sparkles,
  Check,
} from 'lucide-react';
import { createThumbnail, prepareImage } from '../utils/image';
import { analyzeMealImage } from '../utils/ai';
import { v4 as uuidv4 } from 'uuid';
import { getLocalDateString, parseLocalDate } from '../utils/date';
import { getApiKeyError } from '../utils/ai-wrapper';
import { cn } from '../utils/cn';
import { SectionLabel } from './ui';

/* ============================================================
   FreshAddMeal — экран добавления еды в новом дизайне.
   Логика 1-в-1 с классическим AddMeal: prepareImage, analyzeMealImage
   (с forceSmart), сохранение в store, избранное. Отличается отрисовка.
   ============================================================ */

function FreshSkeleton({ isDeep }: { isDeep: boolean }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = [
    'Подключаем нейросети...',
    'Рассматриваем ингредиенты...',
    'Ищем скрытые жиры...',
    'Считаем каждую калорию...',
    'Почти готово...',
  ];
  React.useEffect(() => {
    const int = setInterval(() => setStatusIdx((i) => (i + 1) % statuses.length), 1200);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="w-full flex flex-col">
      <div className="bg-surface rounded-[26px] p-5 shadow-card border border-line/40 w-full relative overflow-hidden">
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1 rounded-full animate-[scan_2s_ease-in-out_infinite] z-10',
            isDeep ? 'bg-warn shadow-[0_0_14px_3px_var(--f-warn)]' : 'bg-accent shadow-[0_0_14px_3px_var(--f-ambient-a)]',
          )}
        />
        <div className="h-6 w-3/4 bg-line/60 rounded animate-pulse" />
        <div className="border-b border-dashed border-line mt-4 mb-4" />
        <div className="h-14 w-full bg-line/50 rounded-2xl mb-4 animate-pulse" />
        <div className="flex gap-4 mb-4">
          <div className="flex-1 h-12 bg-line/50 rounded-2xl animate-pulse" />
          <div className="flex-1 h-12 bg-line/50 rounded-2xl animate-pulse" />
        </div>
        <div className="h-12 w-full bg-line/50 rounded-2xl animate-pulse" />
        <div className="text-center w-full pt-4">
          <span
            className={cn(
              'text-xs font-medium tracking-wide transition-colors duration-300',
              isDeep ? 'text-warn' : 'text-accent',
            )}
          >
            {isDeep ? 'Блюдо сложное, подключаем глубокий анализ...' : statuses[statusIdx]}
          </span>
        </div>
      </div>
      <div className="h-14 w-full bg-surface rounded-2xl shadow-soft border border-line/40 mt-4 animate-pulse" />
    </div>
  );
}

export function FreshAddMeal({ onComplete }: { onComplete: () => void }) {
  const { settings, addMeal, favorites, meals } = useStore();
  const [images, setImages] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDeepAnalyze, setIsDeepAnalyze] = useState(false);
  const [forceSmart, setForceSmart] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    aiThoughts: string;
    items?: {
      name: string;
      estimated_weight_g: number;
      portion_basis: string;
      calorie_density: number;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      breakdown: string;
    }[];
  } | null>(null);
  const [showThoughts, setShowThoughts] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const todayStr = getLocalDateString();
  const isToday = selectedDate === todayStr;

  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalDateString(d));
  };
  const handleNextDay = () => {
    if (isToday) return;
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalDateString(d));
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    try {
      const prepared = await Promise.all(files.map((f) => prepareImage(f, 1536, 1536)));
      const compressedImages = prepared.map((p) => p.full);
      const newThumbs = prepared.map((p) => p.thumb);
      setImages((prev) => {
        const combined = [...prev, ...compressedImages];
        return combined.length > 10 ? combined.slice(0, 10) : combined;
      });
      setThumbnails((prev) => {
        const combined = [...prev, ...newThumbs];
        return combined.length > 10 ? combined.slice(0, 10) : combined;
      });
      if (images.length + compressedImages.length > 10) {
        setError('Загружено первые 10 фото (это максимум для одного блюда)');
      } else {
        setError(null);
      }
      setResult(null);
    } catch {
      setError('Ошибка при обработке фото');
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setThumbnails((prev) => prev.filter((_, i) => i !== index));
  };

  const [progressMsg, setProgressMsg] = useState('');

  const handleAnalyze = async () => {
    if (images.length === 0 && !userInput.trim()) {
      setError('Добавьте фото или опишите еду текстом');
      return;
    }
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setIsAnalyzing(true);
    setLoadingProgress(0);
    setProgressMsg('');
    setError(null);
    setIsDeepAnalyze(false);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        let step = 0;
        if (prev < 20) step = 8;
        else if (prev < 75) step = Math.max(0.2, (75 - prev) * 0.05);
        else step = 0.2;
        return Math.min(prev + step, 95);
      });
    }, 200);

    const recentMealsText = meals
      .slice(0, 10)
      .map(
        (m) =>
          `- [${m.date} ${m.time}]: ${m.name} (${m.calories} ккал, Б:${m.protein} Ж:${m.fat} У:${m.carbs})`,
      )
      .join('\n');

    try {
      const { result: aiResult, aiThoughts } = await analyzeMealImage(
        settings,
        images,
        settings.userContext,
        userInput,
        recentMealsText,
        (msg) => {
          setProgressMsg(msg);
          if (msg.includes('глубокий анализ') || msg.includes('умн')) {
            setIsDeepAnalyze(true);
            setLoadingProgress(50);
          }
        },
        forceSmart,
      );
      setLoadingProgress(100);
      setTimeout(() => setResult({ ...aiResult, aiThoughts }), 300);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при анализе');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsAnalyzing(false), 300);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      let thumbs = thumbnails;
      if (images.length > 0 && thumbs.length === 0) {
        thumbs = await Promise.all(images.map((img) => createThumbnail(img)));
      }
      const now = new Date();
      addMeal({
        id: uuidv4(),
        date: selectedDate,
        time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        name: result.name,
        calories: result.calories,
        protein: result.protein,
        fat: result.fat,
        carbs: result.carbs,
        ai_thoughts: result.aiThoughts,
        reasoning: (result as any).reasoning || result.aiThoughts,
        confidence_score: (result as any).confidence_score,
        items: result.items,
        images: thumbs,
        image: thumbs[0] || undefined,
        dailyGoalSnapshot: settings.dailyGoal,
      });
      onComplete();
    } catch {
      setError('Ошибка при сохранении фото');
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Шапка с назад */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onComplete}
          className="p-2 -ml-2 rounded-full bg-surface shadow-soft border border-line/40 hover:text-accent transition-colors active:scale-90"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4.5 h-4.5 text-ink" />
        </button>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Добавить еду</h2>
      </div>

      {/* Переключатель даты */}
      <div className="flex items-center justify-between bg-surface rounded-full p-1.5 shadow-soft border border-line/50">
        <button onClick={handlePrevDay} className="p-2 rounded-full hover:bg-surface-2 transition-colors active:scale-90">
          <ChevronLeft className="w-4 h-4 text-ink-soft" />
        </button>
        <span className="font-display font-bold text-sm text-ink flex items-center gap-1.5">
          {isToday ? (
            'Сегодня'
          ) : (
            <>
              {parseLocalDate(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              <span className="text-[10px] text-warn font-semibold bg-warn/12 px-1.5 py-0.5 rounded-full">прошлое</span>
            </>
          )}
        </span>
        <button
          onClick={handleNextDay}
          disabled={isToday}
          className={cn('p-2 rounded-full transition-all active:scale-90', isToday ? 'opacity-30 cursor-default' : 'hover:bg-surface-2')}
        >
          <ChevronRight className="w-4 h-4 text-ink-soft" />
        </button>
      </div>

      {!result ? (
        <div className="space-y-5">
          {isAnalyzing ? (
            <FreshSkeleton isDeep={isDeepAnalyze} />
          ) : (
            <>
              {images.length === 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-surface rounded-[26px] shadow-soft border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft/50 transition-all p-6 flex flex-col items-center justify-center gap-2.5 aspect-square group active:scale-[0.97]"
                  >
                    <Camera className="w-8 h-8 text-accent transition-transform group-hover:scale-110" />
                    <span className="text-xs font-semibold text-ink">Камера</span>
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="bg-surface rounded-[26px] shadow-soft border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft/50 transition-all p-6 flex flex-col items-center justify-center gap-2.5 aspect-square group active:scale-[0.97]"
                  >
                    <ImageIcon className="w-8 h-8 text-accent transition-transform group-hover:scale-110" />
                    <span className="text-xs font-semibold text-ink">Галерея</span>
                  </button>
                </div>
              ) : (
                <div className="bg-surface rounded-[26px] shadow-soft border border-line/40 p-3">
                  <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x hide-scrollbar">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative flex-shrink-0 w-28 h-28 snap-start">
                        <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover rounded-[16px]" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 bg-ink/60 text-canvas p-1 rounded-full backdrop-blur-md hover:bg-danger transition-colors"
                          aria-label="Удалить фото"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex-shrink-0 w-28 h-28 rounded-[16px] border-2 border-dashed border-line flex flex-col items-center justify-center gap-1.5 hover:border-accent hover:bg-accent-soft/50 transition-all snap-start"
                    >
                      <Plus className="w-6 h-6 text-ink-faint" />
                      <span className="text-[10px] font-medium text-ink-faint">Добавить</span>
                    </button>
                  </div>
                </div>
              )}

              <input type="file" accept="image/*" capture="environment" multiple className="hidden" ref={cameraInputRef} onChange={handleImageCapture} />
              <input type="file" accept="image/*" multiple className="hidden" ref={galleryInputRef} onChange={handleImageCapture} />

              {/* Текстовое уточнение */}
              <div className="bg-surface rounded-[26px] shadow-soft border border-line/40 p-5">
                <SectionLabel className="mb-2">
                  {images.length > 0 ? 'Уточнение (необязательно)' : 'Опишите еду текстом'}
                </SectionLabel>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  rows={images.length > 0 ? 2 : 3}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all resize-none placeholder:text-ink-faint"
                  placeholder={
                    images.length > 0
                      ? 'Что на тарелке? Уточните вес или состав...'
                      : 'Например: Овсянка 200г с бананом и кофе с молоком'
                  }
                />
              </div>
            </>
          )}

          {/* Умный анализ */}
          {(settings.apiMode === 'simple' || settings.apiMode === 'advanced') && (
            <label className="flex items-center gap-3 px-1 cursor-pointer select-none group">
              <button
                type="button"
                role="switch"
                aria-checked={forceSmart}
                onClick={() => setForceSmart((v) => !v)}
                className={cn(
                  'relative w-11 h-6.5 rounded-full transition-all',
                  forceSmart ? 'bg-gradient-to-r from-accent to-accent-strong shadow-glow' : 'bg-line',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.75 left-0.75 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    forceSmart && 'translate-x-[18px]',
                  )}
                />
              </button>
              <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className={cn('w-4 h-4', forceSmart ? 'text-accent' : 'text-ink-faint')} />
                Умный анализ
                <span className="block text-[10px] text-ink-faint font-normal leading-tight">
                  Глубокая модель — точнее, но медленнее
                </span>
              </span>
            </label>
          )}

          {error && (
            <div className="bg-danger/10 text-danger border border-danger/20 p-3.5 rounded-2xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Кнопка анализа с прогрессом */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (images.length === 0 && !userInput.trim())}
            className="relative w-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold py-3.5 rounded-2xl shadow-glow hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 overflow-hidden disabled:opacity-60 disabled:active:scale-100"
          >
            {isAnalyzing && (
              <div
                className={cn('absolute left-0 top-0 bottom-0 transition-all duration-300 ease-out', isDeepAnalyze ? 'bg-warn' : 'bg-accent-strong')}
                style={{ width: `${loadingProgress}%` }}
              />
            )}
            <div className="relative flex items-center gap-2 z-10 w-full justify-center px-4">
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="truncate">{progressMsg || `Оценка... ${Math.round(loadingProgress)}%`}</span>
                </>
              ) : images.length > 0 ? (
                'Распознать фото'
              ) : (
                'Подсчитать по тексту'
              )}
            </div>
          </button>

          {/* Избранное */}
          {!isAnalyzing && images.length === 0 && favorites.length > 0 && (
            <div className="pt-4">
              <SectionLabel className="mb-3 px-1">Избранное</SectionLabel>
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      const now = new Date();
                      addMeal({
                        id: uuidv4(),
                        date: selectedDate,
                        time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        name: fav.name,
                        calories: fav.calories,
                        protein: fav.protein,
                        fat: fav.fat,
                        carbs: fav.carbs,
                        ai_thoughts: 'Добавлено из избранного',
                        dailyGoalSnapshot: settings.dailyGoal,
                      });
                      onComplete();
                    }}
                    className="w-full bg-surface rounded-[20px] p-4 shadow-soft border border-line/40 flex items-center justify-between text-left hover:shadow-card hover:border-accent-ring active:scale-[0.98] transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-ink">{fav.name}</h4>
                      <p className="text-[10px] text-ink-faint mt-0.5">
                        Б: {fav.protein}г · Ж: {fav.fat}г · У: {fav.carbs}г
                      </p>
                    </div>
                    <div className="font-display font-bold text-sm text-accent">{fav.calories} ккал</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Результат */
        <div className="space-y-5">
          <div className="bg-surface rounded-[26px] p-5 shadow-card border border-line/40 space-y-4">
            <input
              type="text"
              value={result.name}
              onChange={(e) => setResult({ ...result, name: e.target.value })}
              className="w-full font-display text-lg font-extrabold tracking-tight text-ink bg-transparent border-b border-dashed border-line pb-1.5 focus:outline-none focus:border-accent transition-colors"
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="col-span-2">
                <SectionLabel className="mb-1.5">Калории</SectionLabel>
                <div className="relative">
                  <input
                    type="number"
                    value={result.calories}
                    onChange={(e) => setResult({ ...result, calories: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-accent-soft text-accent font-display font-extrabold text-base focus:outline-none tnum"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-accent/60 text-xs font-semibold">ккал</span>
                </div>
              </div>
              <ResultMacro label="Белки" value={result.protein} color="var(--f-protein)" tint="color-mix(in srgb, var(--f-protein) 12%, transparent)"
                onChange={(v) => setResult({ ...result, protein: v })} />
              <ResultMacro label="Жиры" value={result.fat} color="var(--f-fat)" tint="color-mix(in srgb, var(--f-fat) 14%, transparent)"
                onChange={(v) => setResult({ ...result, fat: v })} />
              <div className="col-span-2">
                <ResultMacro label="Углеводы" value={result.carbs} color="var(--f-carbs)" tint="color-mix(in srgb, var(--f-carbs) 12%, transparent)"
                  onChange={(v) => setResult({ ...result, carbs: v })} />
              </div>
            </div>
          </div>

          {/* Разбивка ИИ */}
          {result.items && result.items.length > 0 && (
            <div className="bg-surface rounded-[26px] shadow-soft border border-line/40 overflow-hidden">
              <button onClick={() => setShowItems(!showItems)} className="w-full px-5 py-4 flex items-center justify-between text-left">
                <span className="text-sm font-bold text-ink">Как разложил ИИ ({result.items.length})</span>
                {showItems ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
              </button>
              {showItems && (
                <div className="px-5 pb-5 pt-1.5 border-t border-line/60 space-y-3">
                  {result.items.map((item, idx) => (
                    <div key={idx} className="bg-surface-2 border border-line/40 rounded-2xl p-3.5 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-ink">{item.name}</span>
                        <span className="font-display font-bold text-accent">{item.calories} ккал</span>
                      </div>
                      <div className="text-ink-soft space-y-0.5">
                        <div>~ {item.estimated_weight_g} г · плотность {item.calorie_density} ккал/100г</div>
                        {item.portion_basis && <div className="text-ink-soft">📏 {item.portion_basis}</div>}
                        <div>Б {item.protein}г · Ж {item.fat}г · У {item.carbs}г</div>
                        {item.breakdown && <div className="text-[10px] text-ink-faint mt-1 italic">{item.breakdown}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Рассуждения ИИ */}
          <div className="bg-surface rounded-[26px] shadow-soft border border-line/40 overflow-hidden">
            <button onClick={() => setShowThoughts(!showThoughts)} className="w-full px-5 py-4 flex items-center justify-between text-left">
              <span className="text-sm font-bold text-ink">Как посчитал ИИ</span>
              {showThoughts ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
            </button>
            {showThoughts && (
              <div className="px-5 pb-5 pt-1.5 text-xs text-ink-soft whitespace-pre-wrap leading-relaxed border-t border-line/60">
                {result.aiThoughts}
              </div>
            )}
          </div>

          {/* Действия */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setResult(null)}
              className="flex-1 bg-surface text-ink-soft text-sm font-bold py-3.5 rounded-2xl shadow-soft border border-line/50 hover:bg-surface-2 active:scale-[0.98] transition-all"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold py-3.5 rounded-2xl shadow-glow hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Добавить
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Поле макроса в карточке результата. */
function ResultMacro({
  label,
  value,
  color,
  tint,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  tint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <SectionLabel className="mb-1.5">{label}</SectionLabel>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3.5 py-2.5 rounded-2xl font-display font-bold text-sm focus:outline-none tnum"
          style={{ background: tint, color }}
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color, opacity: 0.55 }}>
          г
        </span>
      </div>
    </div>
  );
}
