import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateGroceryList } from '../utils/ai';
import { getApiKeyError } from '../utils/ai-wrapper';
import { Loader2, ShoppingCart, Trash2, CheckSquare, Square } from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolShell, SectionLabel } from './ui';
import { haptic } from './haptics';

/* FreshGrocery — список покупок в новом дизайне. */
export function FreshGrocery({ onBack }: { onBack?: () => void }) {
  const { settings, groceryData, saveGroceryData, groceryCheckedItems, toggleGroceryCheckedItem } = useStore();
  const [preferences, setPreferences] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const data = await generateGroceryList(settings, settings.userContext, settings.dailyGoal, preferences);
      if (data && data.categories) {
        saveGroceryData(data);
        haptic('success');
      } else {
        throw new Error('Пустой ответ');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации списка покупок');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ToolShell
      onBack={onBack || (() => {})}
      icon={ShoppingCart}
      accent="var(--f-accent)"
      title="Список покупок"
      description="ИИ составит план питания на неделю и список покупок под вашу цель калорий."
    >
      <div className="bg-surface rounded-[24px] p-4 shadow-soft border border-line/40 space-y-4">
        <div>
          <SectionLabel className="mb-1.5">Пожелания или примечания</SectionLabel>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Например: Побольше рыбы, хочу смузи..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors h-16 resize-none placeholder:text-ink-faint"
          />
        </div>

        {error && <div className="text-danger text-[11px] bg-danger/10 border border-danger/20 p-2.5 rounded-xl font-medium">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={() => { haptic('medium'); handleGenerate(); }}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-br from-accent to-accent-strong text-white font-bold py-3 rounded-2xl shadow-glow hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-[13px] disabled:opacity-60"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Генерируем...</>
            ) : (
              <><ShoppingCart className="w-4 h-4" /> Список на неделю</>
            )}
          </button>
          {groceryData && (
            <button
              onClick={() => saveGroceryData(null)}
              className="px-3.5 bg-danger/10 text-danger rounded-2xl hover:bg-danger/15 transition-all flex items-center justify-center"
              aria-label="Очистить список"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {groceryData && (
        <div className="space-y-4">
          {groceryData.plan && (
            <div className="bg-accent-soft border border-accent-ring rounded-[24px] p-4">
              <h3 className="font-display font-bold mb-2 text-sm text-ink">План питания</h3>
              <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-ink-soft [&_strong]:text-ink">
                <Markdown>{groceryData.plan}</Markdown>
              </div>
            </div>
          )}

          {groceryData.categories && groceryData.categories.length > 0 && (
            <div className="space-y-3">
              <SectionLabel className="px-0.5">Список продуктов</SectionLabel>
              {groceryData.categories.map((category: any, idx: number) => (
                <div key={idx} className="bg-surface rounded-[20px] p-4 shadow-soft border border-line/40">
                  <h4 className="font-bold text-accent mb-2 text-[13px]">{category.category}</h4>
                  <ul className="space-y-1">
                    {category.items.map((item: string, i: number) => {
                      const isChecked = groceryCheckedItems.includes(item);
                      return (
                        <li
                          key={i}
                          className={`flex items-start gap-2.5 cursor-pointer transition-colors p-1.5 -mx-1.5 rounded-xl hover:bg-surface-2 ${isChecked ? 'opacity-50' : ''}`}
                          onClick={() => { haptic('light'); toggleGroceryCheckedItem(item); }}
                        >
                          <div className={`mt-0.5 shrink-0 ${isChecked ? 'text-accent' : 'text-ink-faint/50'}`}>
                            {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <span className={`text-[13px] text-ink flex-1 leading-snug ${isChecked ? 'line-through text-ink-faint' : ''}`}>
                            <Markdown components={{ p: 'span' }}>{item}</Markdown>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
