import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useState } from 'react';
import { Sparkles, Droplets, Plus, Minus, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { getLocalDateString } from '../utils/date';
import { ToolShell } from './ui';
import { haptic } from './haptics';

/* ============================================================
   FreshWater — трекер воды в новом дизайне. QoL-фикс: количество
   воды теперь хранится в store по датам (раньше сбрасывалось при
   уходе с экрана — был только локальный state).
   ============================================================ */

export function FreshWater({ onBack }: { onBack?: () => void }) {
  const { settings, weights, water, setWater } = useStore();
  const today = getLocalDateString();
  const amount = water[today] || 0;
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = (delta: number) => {
    setWater(today, Math.max(0, amount + delta));
    haptic('light');
  };

  const getWaterAdvice = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ai = getAIForSettings(settings);
      const currentWeight = weights.length > 0 ? weights[0].weight : null;
      const weightLine = currentWeight
        ? ` Текущий вес пользователя: ${currentWeight} кг.`
        : ' Вес пользователя неизвестен — тогда возьми типовую норму и обязательно объясни, что точная норма зависит от веса (30-35 мл на кг).';
      const prompt = `Ты профессиональный диетолог. Дай рекомендации по водному балансу.
Пользователь: ${settings.userContext}.${weightLine}

Выполни:
1. Рассчитай индивидуальную суточную норму воды по весу (~30-35 мл на кг массы тела, больше при тренировках/жаре) — приведи формулу и итог в литрах И в стаканах по 250 мл.
2. Дай 3 коротких практических совета, как не забывать пить воду в течение дня.
3. Упомяни, что часть воды поступает с едой (супы, фрукты), поэтому «чистой» воды можно чуть меньше.
Отвечай структурированно, используй Markdown. Не давай медицинских диагнозов.`;
      const response = await ai.models.generateContent({
        model: getModelForMode(settings.apiMode),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });
      setAdvice(response.text || 'Не удалось получить рекомендации.');
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации.');
    } finally {
      setIsLoading(false);
    }
  };

  const glassesCount = Math.floor(amount / 250);

  return (
    <ToolShell
      onBack={onBack || (() => {})}
      icon={Droplets}
      accent="var(--f-protein)"
      title="Водный баланс"
      description="Поддерживайте уровень гидратации. ИИ может рассчитать вашу личную норму воды и дать советы на основе данных профиля."
    >
      <div className="bg-surface rounded-[26px] p-6 shadow-card border border-line/40 flex flex-col items-center">
        <div className="font-display text-4xl font-extrabold tnum text-protein mb-1">{amount} мл</div>
        <div className="text-xs font-medium text-ink-faint mb-6">
          Выпито за сегодня (~{glassesCount} стак.)
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => change(-250)}
            className="w-11 h-11 bg-surface-2 border border-line/60 rounded-full flex items-center justify-center text-protein hover:bg-accent-soft transition-colors active:scale-90"
            aria-label="Убрать стакан"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => change(250)}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-glow bg-gradient-to-br from-protein to-protein hover:brightness-110 active:scale-90 transition-all"
            aria-label="Добавить стакан"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 text-[13px] p-3.5 rounded-2xl font-medium">
          {error}
        </div>
      )}

      {!advice && !isLoading && (
        <button
          onClick={getWaterAdvice}
          className="w-full flex items-center justify-center gap-2 bg-surface text-protein border border-line/60 font-bold py-3 px-4 rounded-2xl hover:bg-accent-soft transition-all shadow-soft text-sm active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          Рассчитать мою норму (ИИ)
        </button>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-protein animate-spin" />
          <p className="text-[13px] text-ink-soft font-medium">Считаем вашу норму...</p>
        </div>
      )}

      {advice && (
        <div className="bg-surface-2 border border-line/50 rounded-2xl p-4 prose prose-sm max-w-none text-[13px] text-ink-soft [&_strong]:text-ink [&_li]:marker:text-protein">
          <Markdown>{advice}</Markdown>
        </div>
      )}
    </ToolShell>
  );
}
