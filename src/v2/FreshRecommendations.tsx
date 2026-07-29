import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { getRecommendations, getDetailedRecipe } from '../utils/ai';
import { getApiKeyError } from '../utils/ai-wrapper';
import { Loader2, Lightbulb, Search, BookOpen, X } from 'lucide-react';
import { getLocalDateString } from '../utils/date';
import { ToolShell, SectionLabel } from './ui';
import { motion, AnimatePresence } from 'motion/react';
import { haptic } from './haptics';
import { cn } from '../utils/cn';

/* FreshRecommendations — идеи для еды в новом дизайне. */
export function FreshRecommendations({ onBack }: { onBack?: () => void }) {
  const { settings, meals } = useStore();
  const [userInput, setUserInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [recommendations, setRecommendations] = useState<
    Array<{ id: string; title: string; shortDescription: string; calories: number; recipePrompt: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedRecipeItem, setSelectedRecipeItem] = useState<any>(null);
  const [detailedRecipe, setDetailedRecipe] = useState<string | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [recipeProgress, setRecipeProgress] = useState(0);

  const currentMeals = meals.filter((m) => m.date === getLocalDateString());
  const totalCalories = currentMeals.reduce((s, m) => s + m.calories, 0);
  const remainingCalories = Math.max(0, settings.dailyGoal - totalCalories);

  const handleSearch = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setError(null);
    setIsSearching(true);
    setLoadingProgress(0);
    setRecommendations([]);
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setLoadingProgress(Math.round(currentProgress));
    }, 200);
    const recentMealsText = currentMeals.map((m) => `- ${m.name} (${m.calories} ккал)`).join('\n');
    try {
      const results = await getRecommendations(settings, settings.userContext, userInput, remainingCalories, recentMealsText);
      setRecommendations(results);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при поиске идей');
    } finally {
      clearInterval(progressInterval);
      setIsSearching(false);
    }
  };

  const loadRecipe = async (item: any) => {
    setSelectedRecipeItem(item);
    setDetailedRecipe(null);
    setIsLoadingRecipe(true);
    setRecipeProgress(0);
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setRecipeProgress(Math.round(currentProgress));
    }, 200);
    try {
      setDetailedRecipe(await getDetailedRecipe(settings, item.recipePrompt));
    } catch {
      setDetailedRecipe('Ошибка при загрузке рецепта.');
    } finally {
      clearInterval(progressInterval);
      setIsLoadingRecipe(false);
    }
  };

  return (
    <ToolShell
      onBack={onBack || (() => {})}
      icon={Lightbulb}
      accent="var(--f-fat)"
      title="Идеи для еды"
      description="Подбор блюд и рецептов под оставшиеся калории."
    >
      <div className="bg-surface rounded-[24px] p-4 shadow-soft border border-line/40 space-y-4">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Осталось на сегодня</SectionLabel>
          <p className="font-display text-2xl font-extrabold tnum text-accent">
            {remainingCalories} <span className="text-[11px] text-ink-faint font-semibold">ккал</span>
          </p>
        </div>

        <div>
          <SectionLabel className="mb-2">Идеи по категории или описанию</SectionLabel>
          <div className="flex gap-1.5 overflow-x-auto pb-3 hide-scrollbar">
            {['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт'].map((cat) => (
              <button
                key={cat}
                onClick={() => { haptic('light'); setUserInput(cat); }}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95',
                  userInput === cat ? 'bg-accent text-white shadow-glow' : 'bg-surface-2 border border-line/60 text-ink-soft hover:text-accent',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Мясо с картошкой, или что-то легкое..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors placeholder:text-ink-faint"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {error && <div className="bg-danger/10 text-danger border border-danger/20 p-2.5 rounded-xl text-[11px] font-medium">{error}</div>}

        <button
          onClick={() => { haptic('medium'); handleSearch(); }}
          disabled={isSearching}
          className="relative overflow-hidden w-full bg-accent-soft text-accent font-bold text-[13px] py-3 rounded-2xl hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isSearching && (
            <div className="absolute left-0 top-0 bottom-0 bg-accent/15 transition-all duration-200" style={{ width: `${loadingProgress}%` }} />
          )}
          <div className="relative z-10 flex items-center gap-2">
            {isSearching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Поиск... {loadingProgress}%</>
            ) : (
              <><Search className="w-3.5 h-3.5" /> Найти идеи</>
            )}
          </div>
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel className="px-0.5">Рекомендации</SectionLabel>
          {recommendations.map((item) => (
            <div key={item.id} className="bg-surface rounded-[20px] p-4 shadow-soft border border-line/40 flex flex-col gap-1.5">
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-ink text-[13px] leading-tight">{item.title}</h4>
                <span className="font-display font-bold text-accent text-[13px] whitespace-nowrap">{item.calories} ккал</span>
              </div>
              <p className="text-[11px] text-ink-soft leading-relaxed">{item.shortDescription}</p>
              <button
                onClick={() => { haptic('light'); loadRecipe(item); }}
                className="mt-1 text-[11px] font-bold text-accent flex items-center gap-1 hover:brightness-90 transition-all w-fit"
              >
                <BookOpen className="w-3 h-3" /> Смотреть рецепт
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-sheet рецепта */}
      <AnimatePresence>
        {selectedRecipeItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] z-[60] flex items-end justify-center"
            onClick={() => setSelectedRecipeItem(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-t-[28px] w-full max-w-md h-[85vh] flex flex-col shadow-lift border-t border-line/50"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-line/60">
                <h3 className="font-display font-bold text-ink truncate pr-4">{selectedRecipeItem.title}</h3>
                <button
                  onClick={() => setSelectedRecipeItem(null)}
                  className="p-1.5 text-ink-faint hover:text-ink bg-surface-2 rounded-full transition-colors flex-shrink-0"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {isLoadingRecipe ? (
                  <div className="flex flex-col items-center justify-center h-40 text-ink-faint gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    <span className="text-[13px] font-medium">Создаем рецепт... {recipeProgress}%</span>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-[13px] text-ink-soft whitespace-pre-wrap leading-relaxed [&_strong]:text-ink">
                    {detailedRecipe}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
