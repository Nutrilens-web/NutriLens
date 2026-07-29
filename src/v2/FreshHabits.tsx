import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useState } from 'react';
import { Target, Activity, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { ToolShell, PrimaryButton } from './ui';
import { haptic } from './haptics';

/* FreshHabits — разбор привычек питания в новом дизайне. */
export function FreshHabits({ onBack }: { onBack?: () => void }) {
  const { settings } = useStore();
  const [habit, setHabit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAnalysis = async () => {
    if (!habit.trim()) return;
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ai = getAIForSettings(settings);
      const prompt = `Ты опытный нутрициолог-консультант (НЕ врач). Пользователь: ${settings.userContext}.
У пользователя есть следующая привычка или проблема с питанием: "${habit}".

Проанализируй эту привычку:
1. Возможные скрытые причины такого поведения (физиологические сигналы — голод/недосып/дефицит макронутриентов; эмоциональные триггеры — стресс/скука/награда).
2. 3 конкретных практических шага, выполнимых в течение ближайшей недели, чтобы ослабить привычку или заменить её полезной альтернативой (формулируй как чёткие действия, а не общие советы).
3. Короткая мотивирующая фраза в конце.
Важно: не ставь медицинских диагнозов и не назначай лечение — при подозрении на расстройство питания мягко порекомендуй обратиться к специалисту.
Структурируй ответ и используй Markdown.`;
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
      setAnalysis(response.text || 'Не удалось получить анализ.');
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ToolShell
      onBack={onBack || (() => {})}
      icon={Activity}
      accent="var(--f-danger)"
      title="Разбор привычек"
      description='Опишите свою рутину или тягу к каким-то продуктам (например, "сильная тяга к сладкому вечером"), и ИИ поможет найти причину и пути решения.'
    >
      <textarea
        value={habit}
        onChange={(e) => setHabit(e.target.value)}
        placeholder="Я постоянно объедаюсь на ночь и не могу остановиться..."
        className="w-full h-28 px-3.5 py-3 rounded-2xl bg-surface-2 border border-line/60 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-danger/30 transition-all resize-none placeholder:text-ink-faint"
      />

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 text-[13px] p-3.5 rounded-2xl font-medium">{error}</div>
      )}

      <PrimaryButton onClick={() => { haptic('medium'); getAnalysis(); }} disabled={!habit.trim() || isLoading}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
        {isLoading ? 'Анализируем...' : 'Разобрать привычку'}
      </PrimaryButton>

      {analysis && (
        <div className="bg-surface-2 border border-line/50 rounded-2xl p-4 prose prose-sm max-w-none text-[13px] text-ink-soft [&_strong]:text-ink [&_li]:marker:text-danger">
          <Markdown>{analysis}</Markdown>
        </div>
      )}
    </ToolShell>
  );
}
