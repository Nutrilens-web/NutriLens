import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, ReferenceLine,
} from 'recharts';
import { cn } from '../utils/cn';
import { Bot, Loader2, TrendingDown, TrendingUp, Minus, BarChart3 } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { getLocalDateString } from '../utils/date';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedNumber, Segmented, SectionLabel } from './ui';

/* ============================================================
   FreshStats — экран «Отчёт» в новом дизайне. Логика агрегации
   данных и AI-анализ идентичны классике; графики перекрашены на
   дизайн-токены (CSS-переменные), поэтому корректны в тёмной теме.
   ============================================================ */

// Склонение «день/дня/дней» для нарратива.
function pluralDays(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

const STATUS_WORD: Record<string, string> = {
  normal: 'В норме',
  warning: 'Чуть выше цели',
  over: 'Перебор',
};

// Тултип графика: показывает день, значение и — для калорий — словесный статус
// цвета бара. Читабельнее голого числа: видно, что именно произошло в этот день.
const ChartTooltip = ({ active, payload, kind }: any) => {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0].payload;
  const isWeight = kind === 'weight';
  const value = isWeight ? entry.weight : entry.calories;
  if (value == null) return null;
  return (
    <div className="bg-surface/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lift border border-line/60 min-w-[92px]">
      <p className="text-[10px] text-ink-faint font-medium mb-0.5 capitalize">{entry.name}</p>
      <p className="font-display text-sm font-extrabold tnum text-ink leading-none">
        {value}
        <span className="text-[10px] text-ink-faint font-semibold ml-1">{isWeight ? 'кг' : 'ккал'}</span>
      </p>
      {!isWeight && entry.status && (
        <p className="text-[10px] font-semibold mt-1 flex items-center gap-1" style={{ color: barFill(entry) }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: barFill(entry) }} />
          {STATUS_WORD[entry.status]}
        </p>
      )}
    </div>
  );
};

// Цвет бара по статусу дня — на токенах (тёмная тема подхватывает автоматически).
const barFill = (entry: any) =>
  entry.status === 'over'
    ? 'var(--f-danger)'
    : entry.status === 'warning'
      ? 'var(--f-warn)'
      : entry.isToday
        ? 'var(--f-accent-strong)'
        : 'var(--f-accent)';

// Компактный стат-чип для строки итогов под нарративом: подпись + крупное число.
function StatChip({
  label,
  value,
  unit,
  color = 'var(--f-ink)',
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="flex-1 bg-surface-2 border border-line/40 rounded-2xl px-3 py-2.5">
      <div className="text-[10px] text-ink-faint font-medium mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" style={{ color }} />}
        {label}
      </div>
      <div className="font-display text-lg font-extrabold tnum leading-none" style={{ color }}>
        {value}
        {unit && <span className="text-[10px] text-ink-faint font-semibold ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function MotionCard({ children, index = 0, className = '' }: { children: React.ReactNode; index?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FreshStats() {
  const { meals, settings, weights } = useStore();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [metric, setMetric] = useState<'calories' | 'weight'>('calories');
  const [healthScore, setHealthScore] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const chartData = useMemo(() => {
    const days: any[] = [];
    const daysCount = period === 'week' ? 7 : period === 'month' ? 30 : 365;

    if (period === 'year') {
      const buckets: Record<string, any> = {};
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets[monthKey]) {
          buckets[monthKey] = {
            dateStr, label: d.toLocaleDateString('ru-RU', { month: 'short' }),
            calories: 0, protein: 0, fat: 0, carbs: 0, weightSum: 0, weightCount: 0,
            lastWeight: null, mealsList: [], dayCount: 0, goalSum: 0, goalCount: 0,
          };
        }
        const bucket = buckets[monthKey];
        const dayMeals = meals.filter((m) => m.date === dateStr);
        bucket.calories += dayMeals.reduce((s, m) => s + m.calories, 0);
        bucket.protein += dayMeals.reduce((s, m) => s + m.protein, 0);
        bucket.fat += dayMeals.reduce((s, m) => s + m.fat, 0);
        bucket.carbs += dayMeals.reduce((s, m) => s + m.carbs, 0);
        bucket.dayCount += 1;
        if (dayMeals.length) bucket.mealsList.push(...dayMeals.map((m) => m.name));
        const daySnapshot = dayMeals.find((m) => m.dailyGoalSnapshot != null)?.dailyGoalSnapshot;
        if (daySnapshot != null) {
          bucket.goalSum += daySnapshot;
          bucket.goalCount += 1;
        }
        const weightLog = weights.find((w) => w.date === dateStr);
        if (weightLog) {
          bucket.weightSum += weightLog.weight;
          bucket.weightCount += 1;
          bucket.lastWeight = weightLog.weight;
        }
      }
      const avgGoal = settings.dailyGoal;
      Object.values(buckets).forEach((bucket) => {
        const avgCals = bucket.dayCount > 0 ? bucket.calories / bucket.dayCount : 0;
        const monthGoal = bucket.goalCount > 0 ? bucket.goalSum / bucket.goalCount : avgGoal;
        const status = avgCals <= monthGoal ? 'normal' : avgCals <= monthGoal + 200 ? 'warning' : 'over';
        days.push({
          name: bucket.label,
          calories: Math.round(avgCals),
          protein: Math.round(bucket.dayCount > 0 ? bucket.protein / bucket.dayCount : 0),
          fat: Math.round(bucket.dayCount > 0 ? bucket.fat / bucket.dayCount : 0),
          carbs: Math.round(bucket.dayCount > 0 ? bucket.carbs / bucket.dayCount : 0),
          weight: bucket.weightCount > 0 ? Math.round((bucket.weightSum / bucket.weightCount) * 10) / 10 : null,
          date: bucket.dateStr, isToday: false, status,
          mealsList: bucket.mealsList.slice(0, 30).join(', '),
        });
      });
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const dayMeals = meals.filter((m) => m.date === dateStr);
        const cals = dayMeals.reduce((s, m) => s + m.calories, 0);
        const protein = dayMeals.reduce((s, m) => s + m.protein, 0);
        const fat = dayMeals.reduce((s, m) => s + m.fat, 0);
        const carbs = dayMeals.reduce((s, m) => s + m.carbs, 0);
        const weightLog = weights.find((w) => w.date === dateStr);
        const label = period === 'week'
          ? d.toLocaleDateString('ru-RU', { weekday: 'short' })
          : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const dayGoal = dayMeals.find((m) => m.dailyGoalSnapshot != null)?.dailyGoalSnapshot ?? settings.dailyGoal;
        const status = cals <= dayGoal ? 'normal' : cals <= dayGoal + 200 ? 'warning' : 'over';
        days.push({
          name: label, calories: Math.round(cals), protein: Math.round(protein),
          fat: Math.round(fat), carbs: Math.round(carbs),
          weight: weightLog ? weightLog.weight : null, date: dateStr, isToday: i === 0,
          status, mealsList: dayMeals.map((m) => m.name).join(', '),
        });
      }
    }

    if (metric === 'weight') {
      let lastWeight = days.find((d) => d.weight !== null)?.weight;
      for (const day of days) {
        if (day.weight === null && lastWeight !== undefined) day.weight = lastWeight;
        else if (day.weight !== null) lastWeight = day.weight;
      }
    }
    return days;
  }, [meals, weights, settings.dailyGoal, period, metric]);

  // Сводка-инсайт: числа + тренд, из которых ниже собирается читаемый нарратив.
  // Считаем детерминированно (без ИИ, мгновенно) — превращает график в историю.
  const insight = useMemo(() => {
    const active = chartData.filter((d) => d.calories > 0);
    const avg = active.length ? Math.round(active.reduce((s, d) => s + d.calories, 0) / active.length) : 0;
    const within = active.filter((d) => d.status === 'normal').length;
    const over = active.filter((d) => d.status !== 'normal').length;
    const adherence = active.length ? Math.round((within / active.length) * 100) : 0;
    // Тренд: среднее последних 3 активных дней против трёх предыдущих.
    const r = active.slice(-3);
    const e = active.slice(-6, -3);
    const avgOf = (a: typeof active) => a.reduce((s, d) => s + d.calories, 0) / a.length;
    const trendDelta = r.length >= 2 && e.length >= 2 ? Math.round(avgOf(r) - avgOf(e)) : null;
    return { avg, within, over, adherence, activeCount: active.length, trendDelta };
  }, [chartData]);

  const avgCalories = insight.avg;
  // Вес берём строго в рамках выбранного периода (первая/последняя точка графика),
  // чтобы «за период» не смешивалось с последней записью вообще за всё время.
  const weightPoints = chartData.filter((d) => d.weight !== null);
  const periodFirstWeight = weightPoints[0]?.weight ?? null;
  const periodLastWeight = weightPoints[weightPoints.length - 1]?.weight ?? null;
  const currentWeight = periodLastWeight ?? (weights.length > 0 ? weights[0].weight : 0);
  const weightChange =
    periodFirstWeight != null && periodLastWeight != null ? periodLastWeight - periodFirstWeight : 0;

  const handleHealthAnalysis = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setHealthScore(keyError);
      return;
    }
    setHealthLoading(true);
    setHealthScore(null);
    const recentData = chartData
      .filter((d) => d.calories > 0)
      .slice(period === 'year' ? -6 : -7)
      .map((d) => `${d.date}: ${d.calories} ккал (Б:${d.protein} Ж:${d.fat} У:${d.carbs}). Ел: ${d.mealsList}`)
      .join('\n');
    try {
      const ai = getAIForSettings(settings);
      const modelName = getModelForMode(settings.apiMode || 'free');
      const prompt = `Проанализируй рацион за последние дни:\n${recentData}\n\nЦель пользователя: ${settings.dailyGoal} ккал/день.\n\nДай оценку от 1 до 10 (где 10 - идеально) и 2-3 коротких конструктивных совета по улучшению нутриентов/выбора блюд. Отвечай коротко и только по делу.`;
      const response = await ai.models.generateContent({
        model: modelName,
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
      setHealthScore(response.text || 'Не смог сформировать оценку.');
    } catch (e: any) {
      console.error(e);
      setHealthScore(`Ошибка анализа: ${e?.message || 'Проверьте API ключ.'}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const periodLabel = period === 'week' ? '7 дней' : period === 'month' ? '30 дней' : 'год';
  const weightTrend =
    weightChange === 0
      ? { icon: Minus, color: 'var(--f-ink-faint)', sign: '' }
      : weightChange > 0
        ? { icon: TrendingUp, color: 'var(--f-danger)', sign: '+' }
        : { icon: TrendingDown, color: 'var(--f-accent)', sign: '' };
  const TrendIcon = weightTrend.icon;

  // Тренд калорий для чипа в нарративе (растёт = янтарный, падает = акцент).
  const calTrend =
    insight.trendDelta == null
      ? null
      : insight.trendDelta > 60
        ? { icon: TrendingUp, color: 'var(--f-warn)', bg: 'color-mix(in srgb, var(--f-warn) 14%, transparent)', label: `+${insight.trendDelta}` }
        : insight.trendDelta < -60
          ? { icon: TrendingDown, color: 'var(--f-accent)', bg: 'color-mix(in srgb, var(--f-accent) 14%, transparent)', label: `${insight.trendDelta}` }
          : { icon: Minus, color: 'var(--f-ink-faint)', bg: 'color-mix(in srgb, var(--f-ink) 7%, transparent)', label: 'стабильно' };
  const CalTrendIcon = calTrend?.icon;

  // Читаемый нарратив: превращает сухие числа графика в историю периода.
  const narrative = useMemo(() => {
    if (insight.activeCount === 0) return null;
    const diff = insight.avg - settings.dailyGoal;
    const diffWord =
      Math.abs(diff) <= 40
        ? 'ровно в рамках цели'
        : diff > 0
          ? `выше цели на ${diff} ккал`
          : `ниже цели на ${Math.abs(diff)} ккал`;
    const overNote =
      insight.over > 0
        ? ` ${insight.over} ${pluralDays(insight.over)} — с превышением.`
        : ' Ни одного дня с превышением — так держать.';
    let trend = '';
    if (insight.trendDelta != null) {
      trend =
        insight.trendDelta > 60
          ? ` В последние дни калорийность подросла (+${insight.trendDelta} ккал).`
          : insight.trendDelta < -60
            ? ` В последние дни калорийность снизилась (${insight.trendDelta} ккал).`
            : ' В последние дни калорийность держится ровно.';
    }
    return `За ${insight.activeCount} ${pluralDays(insight.activeCount)} вы попадали в цель в ${insight.adherence}% случаев.${overNote} Среднее — ${insight.avg} ккал, это ${diffWord}.${trend}`;
  }, [insight, settings.dailyGoal]);

  return (
    <div className="space-y-5 pb-6">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="font-display text-[26px] font-extrabold tracking-tight text-ink px-0.5 flex items-center gap-2"
      >
        <BarChart3 className="w-6 h-6 text-accent" />
        Отчёт
      </motion.h2>

      {/* Переключатели периода и метрики */}
      <MotionCard index={1} className="flex flex-col gap-2.5">
        <Segmented
          groupId="period"
          value={period}
          onChange={(v) => setPeriod(v)}
          options={[
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
            { value: 'year', label: 'Год' },
          ]}
        />
        <Segmented
          groupId="metric"
          value={metric}
          onChange={(v) => setMetric(v)}
          options={[
            { value: 'calories', label: 'Калории' },
            { value: 'weight', label: 'Вес' },
          ]}
        />
      </MotionCard>

      {/* Нарратив-инсайт (только для калорий): крупный процент + живой бар +
          читаемый вывод вместо трёх плоских цифр. Превращает график в историю. */}
      <AnimatePresence>
        {metric === 'calories' && narrative && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <MotionCard
              index={2}
              className="bg-surface rounded-[26px] p-5 shadow-card border border-line/40 relative overflow-hidden"
            >
              {/* Живой акцентный ореол — карточка не плоская, а с глубиной. */}
              <div
                className="absolute -top-12 -right-10 w-36 h-36 rounded-full blur-3xl opacity-60 pointer-events-none"
                style={{ background: 'var(--f-ambient-a)' }}
              />
              <div className="relative">
                <SectionLabel className="mb-3">Итог за {periodLabel}</SectionLabel>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-end gap-2">
                    <span className="font-display text-[44px] font-extrabold tnum leading-[0.85] text-accent">
                      <AnimatedNumber value={insight.adherence} />
                    </span>
                    <span className="font-display text-xl font-extrabold text-ink-faint leading-none mb-1">%</span>
                    <span className="text-[11px] text-ink-soft font-medium leading-tight mb-1">
                      дней
                      <br />
                      в цели
                    </span>
                  </div>
                  {calTrend && CalTrendIcon && (
                    <div
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold tnum"
                      style={{ background: calTrend.bg, color: calTrend.color }}
                    >
                      <CalTrendIcon className="w-3 h-3" />
                      {calTrend.label}
                    </div>
                  )}
                </div>

                {/* Тонкий бар соблюдения цели — заполняется spring'ом. */}
                <div className="h-1.5 rounded-full bg-line/60 mt-3.5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong"
                    initial={{ width: 0 }}
                    animate={{ width: `${insight.adherence}%` }}
                    transition={{ type: 'spring', stiffness: 70, damping: 20 }}
                  />
                </div>

                <p className="text-[13px] text-ink-soft leading-relaxed mt-3.5">{narrative}</p>

                <div className="flex gap-2.5 mt-4">
                  <StatChip label="Среднее" value={<AnimatedNumber value={insight.avg} />} unit="ккал" />
                  <StatChip
                    label="С перебором"
                    value={insight.over}
                    unit={pluralDays(insight.over)}
                    color={insight.over > 0 ? 'var(--f-warn)' : 'var(--f-accent)'}
                  />
                </div>
              </div>
            </MotionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* График */}
      <AnimatePresence mode="wait">
        {metric === 'calories' ? (
          <MotionCard key="calories" index={3} className="bg-surface rounded-[26px] p-6 shadow-card border border-line/40">
            <SectionLabel className="mb-1">Среднее за {periodLabel}</SectionLabel>
            <div className="flex items-end gap-1.5 mb-5">
              <span className="font-display text-3xl font-extrabold tnum text-ink">
                <AnimatedNumber value={avgCalories || 0} />
              </span>
              <span className="text-[11px] text-ink-faint mb-1">ккал / день</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={period} data={chartData} margin={{ top: 14, right: 4, left: -18, bottom: 0 }}>
                  {/* Горизонтальная сетка — глазу есть за что зацепиться при чтении высот. */}
                  <CartesianGrid vertical={false} stroke="var(--f-line)" strokeDasharray="3 4" strokeOpacity={0.7} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'var(--f-ink-faint)' }}
                    dy={8}
                    interval={period === 'month' ? 6 : 0}
                  />
                  {/* Ось значений — чтобы линия цели читалась в абсолютных цифрах. */}
                  <YAxis
                    width={34}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'var(--f-ink-faint)' }}
                    tickCount={4}
                    domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, settings.dailyGoal) / 200) * 200]}
                  />
                  {/* Линия дневной цели — главный ориентир: сразу видно, кто выше. */}
                  <ReferenceLine
                    y={settings.dailyGoal}
                    stroke="var(--f-ink-faint)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{ value: 'Цель', position: 'insideTopRight', fill: 'var(--f-ink-faint)', fontSize: 9, dy: -3 }}
                  />
                  <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--f-ink) 6%, transparent)', radius: 6 }} content={<ChartTooltip kind="calories" />} />
                  <Bar dataKey="calories" radius={[6, 6, 6, 6]} maxBarSize={26} isAnimationActive animationDuration={900} animationEasing="ease-out">
                    {chartData.map((entry) => (
                      <Cell key={entry.date} fill={barFill(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-ink-faint border-t border-line/50 pt-3 px-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--f-accent)' }} />В норме</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--f-warn)' }} />Лёгкое превышение</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--f-danger)' }} />Критическое</div>
            </div>
          </MotionCard>
        ) : (
          <MotionCard key="weight" index={3} className="bg-surface rounded-[26px] p-6 shadow-card border border-line/40">
            <SectionLabel className="mb-1">Текущий вес</SectionLabel>
            <div className="flex items-end gap-2 mb-5">
              <span className="font-display text-3xl font-extrabold tnum text-ink">{currentWeight || '--'}</span>
              <span className="text-[11px] text-ink-faint mb-1">кг</span>
              {weightChange !== 0 && (
                <span className="text-[11px] font-semibold mb-1 ml-1 flex items-center gap-0.5" style={{ color: weightTrend.color }}>
                  <TrendIcon className="w-3 h-3" />
                  {weightTrend.sign}
                  {Math.round(weightChange * 10) / 10} за период
                </span>
              )}
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    {/* Градиентная заливка под кривой веса — график выглядит живым,
                        а не как голая линия. */}
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--f-accent)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--f-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--f-line)" strokeDasharray="3 4" strokeOpacity={0.7} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--f-ink-faint)' }} dy={8} interval={period === 'month' ? 6 : 0} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--f-ink-faint)' }} width={34} />
                  <Tooltip cursor={{ stroke: 'var(--f-line)', strokeDasharray: '3 3' }} content={<ChartTooltip kind="weight" />} />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--f-accent)"
                    strokeWidth={3}
                    fill="url(#weightFill)"
                    dot={{ r: 4, fill: 'var(--f-accent)', strokeWidth: 2, stroke: 'var(--f-surface)' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </MotionCard>
        )}
      </AnimatePresence>

      {/* AI-анализ рациона */}
      <MotionCard index={4} className="bg-surface rounded-[26px] p-6 shadow-card border border-line/40 mt-1">
        <h3 className="font-display text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-accent-soft flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent" />
          </span>
          Анализ рациона
        </h3>
        <AnimatePresence mode="wait">
          {healthScore ? (
            <motion.div
              key="score"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-ink-soft bg-surface-2 border border-line/50 rounded-2xl p-4 prose prose-sm max-w-none [&_strong]:text-ink [&_li]:marker:text-accent"
            >
              <Markdown>{healthScore}</Markdown>
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              onClick={handleHealthAnalysis}
              disabled={healthLoading}
              className="relative w-full overflow-hidden bg-[linear-gradient(110deg,var(--f-accent),45%,var(--f-accent-strong),55%,var(--f-accent))] bg-[length:200%_200%] text-white font-bold text-sm py-3.5 rounded-2xl hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-glow disabled:opacity-70 disabled:active:scale-100 animate-[shimmer_3s_linear_infinite]"
            >
              {healthLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Получить оценку от ИИ'}
            </motion.button>
          )}
        </AnimatePresence>
      </MotionCard>
    </div>
  );
}
