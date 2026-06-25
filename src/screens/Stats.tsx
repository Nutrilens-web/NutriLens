import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import { getModelForMode } from '../utils/models';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { cn } from '../utils/cn';
import { Bot, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { getLocalDateString } from '../utils/date';
import { motion, AnimatePresence } from 'motion/react';


const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-gray-100/50">
        <p className="text-sm font-semibold text-gray-900">{payload[0].value} <span className="text-[10px] text-gray-500 font-normal">ккал</span></p>
      </div>
    );
  }
  return null;
};

// Плавно анимирует число от прошлого значения к новому (easeOutExpo по rAF).
// Используется в сводных карточках, чтобы цифры «перетекали» при смене периода.
function AnimatedNumber({ value, duration = 700 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = fromRef.current;
    const end = value;
    if (start === end) return;

    let ts0: number | null = null;
    const step = (t: number) => {
      if (ts0 === null) ts0 = t;
      const p = Math.min((t - ts0) / duration, 1);
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(start + (end - start) * ease);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = end;
        setDisplay(end);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{Math.round(display)}</>;
}

// Универсальный контейнер «карточки» с появлением снизу-вверх и лёгкой задержкой
// по индексу — создаёт эффект каскадного захода блоков при первом открытии экрана.
function MotionCard({
  children,
  index = 0,
  className = '',
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
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

export function StatsScreen() {
  const { meals, settings, weights } = useStore();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [metric, setMetric] = useState<'calories' | 'weight'>('calories');
  const [healthScore, setHealthScore] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const chartData = useMemo(() => {
    const days = [];
    const daysCount = period === 'week' ? 7 : (period === 'month' ? 30 : 365);

    if (period === 'year') {
      // Aggregate 365 days into ~12 monthly buckets so the chart stays readable.
      // We still iterate day-by-day to accumulate, then emit one bucket per month.
      const buckets: Record<string, {
        dateStr: string;
        label: string;
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        weightSum: number;
        weightCount: number;
        lastWeight: number | null;
        mealsList: string[];
        dayCount: number;
        goalSum: number;
        goalCount: number;
      }> = {};

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!buckets[monthKey]) {
          buckets[monthKey] = {
            dateStr,
            label: d.toLocaleDateString('ru-RU', { month: 'short' }),
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            weightSum: 0,
            weightCount: 0,
            lastWeight: null,
            mealsList: [],
            dayCount: 0,
            goalSum: 0,
            goalCount: 0,
          };
        }

        const bucket = buckets[monthKey];
        const dayMeals = meals.filter(m => m.date === dateStr);
        bucket.calories += dayMeals.reduce((sum, m) => sum + m.calories, 0);
        bucket.protein += dayMeals.reduce((sum, m) => sum + m.protein, 0);
        bucket.fat += dayMeals.reduce((sum, m) => sum + m.fat, 0);
        bucket.carbs += dayMeals.reduce((sum, m) => sum + m.carbs, 0);
        bucket.dayCount += 1;
        if (dayMeals.length) bucket.mealsList.push(...dayMeals.map(m => m.name));

        // Накапливаем снапшоты целей по дням, чтобы потом усреднить их по
        // месяцам для year-режима (см. dayGoal ниже).
        const daySnapshot = dayMeals.find(m => m.dailyGoalSnapshot != null)?.dailyGoalSnapshot;
        if (daySnapshot != null) {
          bucket.goalSum += daySnapshot;
          bucket.goalCount += 1;
        }

        const weightLog = weights.find(w => w.date === dateStr);
        if (weightLog) {
          bucket.weightSum += weightLog.weight;
          bucket.weightCount += 1;
          bucket.lastWeight = weightLog.weight;
        }
      }

      const avgGoal = settings.dailyGoal;
      Object.values(buckets).forEach(bucket => {
        const avgCals = bucket.dayCount > 0 ? bucket.calories / bucket.dayCount : 0;
        // Средняя цель по дням месяца из снапшотов; fallback на текущую цель
        // для дней/месяцев без снапшотов (старые записи).
        const monthGoal = bucket.goalCount > 0 ? bucket.goalSum / bucket.goalCount : avgGoal;
        const status = avgCals <= monthGoal
          ? 'normal'
          : (avgCals <= monthGoal + 200 ? 'warning' : 'over');
        days.push({
          name: bucket.label,
          calories: Math.round(avgCals),
          protein: Math.round(bucket.dayCount > 0 ? bucket.protein / bucket.dayCount : 0),
          fat: Math.round(bucket.dayCount > 0 ? bucket.fat / bucket.dayCount : 0),
          carbs: Math.round(bucket.dayCount > 0 ? bucket.carbs / bucket.dayCount : 0),
          weight: bucket.weightCount > 0 ? Math.round((bucket.weightSum / bucket.weightCount) * 10) / 10 : null,
          date: bucket.dateStr,
          isToday: false,
          status,
          mealsList: bucket.mealsList.slice(0, 30).join(', ')
        });
      });
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);

        const dayMeals = meals.filter(m => m.date === dateStr);
        const cals = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const protein = dayMeals.reduce((sum, m) => sum + m.protein, 0);
        const fat = dayMeals.reduce((sum, m) => sum + m.fat, 0);
        const carbs = dayMeals.reduce((sum, m) => sum + m.carbs, 0);

        const weightLog = weights.find(w => w.date === dateStr);
        const label = period === 'week'
          ? d.toLocaleDateString('ru-RU', { weekday: 'short' })
          : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

        // Историческая цель дня: снапшот цели на момент записи (берём у любого
        // приёма пищи этого дня — они записаны с одной и той же целью в рамках
        // дня). У старых записей поля н��т — fallback на текущую settings.dailyGoal.
        // Раньше статус считался от текущей цели, поэтому при её изменении
        // подсветка прошлых дней пересчитывалась задним числом.
        const dayGoal = dayMeals.find(m => m.dailyGoalSnapshot != null)?.dailyGoalSnapshot
          ?? settings.dailyGoal;

        const status = cals <= dayGoal
          ? 'normal'
          : (cals <= dayGoal + 200 ? 'warning' : 'over');

        days.push({
          name: label,
          calories: Math.round(cals),
          protein: Math.round(protein),
          fat: Math.round(fat),
          carbs: Math.round(carbs),
          weight: weightLog ? weightLog.weight : null,
          date: dateStr,
          isToday: i === 0,
          status,
          mealsList: dayMeals.map(m => m.name).join(', ')
        });
      }
    }

    if (metric === 'weight') {
      let lastWeight = days.find(d => d.weight !== null)?.weight;
      for (let day of days) {
        if (day.weight === null && lastWeight !== undefined) {
          day.weight = lastWeight; // carry forward
        } else if (day.weight !== null) {
          lastWeight = day.weight;
        }
      }
    }

    return days;
  }, [meals, weights, settings.dailyGoal, period, metric]);

  // Сводные показатели периода: среднее, лучшая/худшая точка и adherence
  // (доля дней в пределах цели). Показываются анимированными мини-карточками.
  const summary = useMemo(() => {
    const active = chartData.filter(d => d.calories > 0);
    const avg = active.length ? Math.round(active.reduce((s, d) => s + d.calories, 0) / active.length) : 0;
    const best = active.length ? Math.min(...active.map(d => d.calories)) : 0;
    const worst = active.length ? Math.max(...active.map(d => d.calories)) : 0;
    const within = active.filter(d => d.status === 'normal').length;
    const adherence = active.length ? Math.round((within / active.length) * 100) : 0;
    return { avg, best, worst, adherence, logged: active.length };
  }, [chartData]);

  const avgCalories = Math.round(chartData.reduce((sum, day) => sum + day.calories, 0) / chartData.length);
  const currentWeight = weights.length > 0 ? weights[0].weight : 0;
  const oldWeight = chartData.find(d => d.weight !== null)?.weight || currentWeight;
  const weightChange = currentWeight - oldWeight;

  const handleHealthAnalysis = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setHealthScore(keyError);
      return;
    }
    setHealthLoading(true);
    setHealthScore(null);

    const recentData = chartData
      .filter(d => d.calories > 0)
      .slice(period === 'year' ? -6 : -7)
      .map(d =>
      `${d.date}: ${d.calories} ккал (Б:${d.protein} Ж:${d.fat} У:${d.carbs}). Ел: ${d.mealsList}`
    ).join('\n');

    try {
      const ai = getAIForSettings(settings);
      const mode = settings.apiMode || 'free';
      const modelName = getModelForMode(mode);
      const prompt = `Проанализируй рацион за последние дни:\n${recentData}\n\nЦель пользователя: ${settings.dailyGoal} ккал/день.\n\nДай оценку от 1 до 10 (где 10 - идеально) и 2-3 коротких конструктивных совета по улучшению нутриентов/выбора блюд. Отвечай коротко и только по делу.`;

      const response = await ai.models.generateContent({
         model: modelName,
         contents: [
           {
             role: "user",
             parts: [{ text: prompt }]
           }
         ],
         config: {
           safetySettings: [
             {
               category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
             {
               category: HarmCategory.HARM_CATEGORY_HARASSMENT,
               threshold: HarmBlockThreshold.BLOCK_NONE,
             },
           ],
         }
      });
      setHealthScore(response.text || "Не смог сформировать оценку.");
    } catch (e: any) {
      console.error(e);
      setHealthScore(`Ошибка анализа: ${e?.message || 'Проверьте API ключ.'}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const periodLabel = period === 'week' ? '7 дней' : (period === 'month' ? '30 дней' : 'год');

  // Тренд веса: иконка + цвет + подпись. Используется в weight-метрике.
  const weightTrend = weightChange === 0
    ? { icon: Minus, color: 'text-gray-400', sign: '' }
    : weightChange > 0
      ? { icon: TrendingUp, color: 'text-red-500', sign: '+' }
      : { icon: TrendingDown, color: 'text-emerald-500', sign: '' };
  const TrendIcon = weightTrend.icon;

  return (
    <div className="space-y-5 pb-6">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="text-xl font-semibold text-gray-900 px-1"
      >
        Статистика
      </motion.h2>

      {/* Toggles */}
      <MotionCard index={1} className="flex flex-col gap-3">
        <div className="bg-gray-100 p-1 rounded-full flex mx-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="relative flex-1 py-1.5 text-xs font-medium rounded-full transition-colors"
            >
              {period === p && (
                <motion.span
                  layoutId="periodPill"
                  className="absolute inset-0 bg-white shadow-sm rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={cn("relative z-10", period === p ? "text-gray-900" : "text-gray-500")}>
                {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-gray-100 p-1 rounded-full flex mx-1">
          {(['calories', 'weight'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className="relative flex-1 py-1.5 text-xs font-medium rounded-full transition-colors"
            >
              {metric === m && (
                <motion.span
                  layoutId="metricPill"
                  className="absolute inset-0 bg-white shadow-sm rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={cn("relative z-10", metric === m ? "text-gray-900" : "text-gray-500")}>
                {m === 'calories' ? 'Калории' : 'Вес'}
              </span>
            </button>
          ))}
        </div>
      </MotionCard>

      {/* Сводные мини-карточки по калориям — показываются только в calories-метрике,
          чтобы дать быстрое «сегодня vs цель» резюме поверх графика. */}
      <AnimatePresence>
        {metric === 'calories' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2 px-1">
              {[
                { label: 'Среднее', value: summary.avg, unit: 'ккал', color: 'text-gray-900' },
                { label: 'Лучший', value: summary.best, unit: 'ккал', color: 'text-emerald-600' },
                { label: 'Держал цель', value: summary.adherence, unit: '%', color: 'text-blue-600' },
              ].map((card, i) => (
                <MotionCard
                  key={card.label}
                  index={2 + i * 0.4}
                  className="bg-white rounded-[18px] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col"
                >
                  <span className="text-[10px] text-gray-400 mb-1">{card.label}</span>
                  <span className={cn("text-lg font-light leading-none", card.color)}>
                    <AnimatedNumber value={card.value} />
                    <span className="text-[10px] text-gray-400 font-normal ml-0.5">{card.unit}</span>
                  </span>
                </MotionCard>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* График с плавной сменой при переключении метрики. key={metric} ремаунтит
          содержимое, чтобы AnimatePresence проиграл выход/вход. */}
      <AnimatePresence mode="wait">
        {metric === 'calories' ? (
          <MotionCard key="calories" index={3} className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-xs font-medium text-gray-500 mb-1">Среднее за {periodLabel}</h3>
            <div className="flex items-end gap-1.5 mb-5">
              <span className="text-2xl font-light text-gray-900">
                <AnimatedNumber value={avgCalories || 0} />
              </span>
              <span className="text-[11px] text-gray-400 mb-1">ккал / день</span>
            </div>

            <div className="h-40 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={period} data={chartData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                    dy={8}
                    interval={period === 'month' ? 6 : 0}
                  />
                  <Tooltip cursor={{ fill: '#F3F4F6', radius: 6 }} content={<CustomTooltip />} />
                  <Bar dataKey="calories" radius={[6, 6, 6, 6]} isAnimationActive={true} animationBegin={0} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.date}
                        fill={entry.status === 'over' ? '#F87171' : entry.status === 'warning' ? '#F59E0B' : (entry.isToday ? '#10B981' : '#34D399')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-50 pt-3 px-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#34D399]"></div>В норме</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>Легкое превышение</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F87171]"></div>Критическое</div>
            </div>
          </MotionCard>
        ) : (
          <MotionCard key="weight" index={3} className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <h3 className="text-xs font-medium text-gray-500 mb-1">Текущий вес</h3>
            <div className="flex items-end gap-2 mb-5">
              <span className="text-2xl font-light text-gray-900">{currentWeight || '--'}</span>
              <span className="text-[11px] text-gray-400 mb-1">кг</span>
              {weightChange !== 0 && (
                <span className={cn("text-[11px] font-medium mb-1 ml-1 flex items-center gap-0.5", weightTrend.color)}>
                  <TrendIcon className="w-3 h-3" />
                  {weightTrend.sign}{Math.round(weightChange * 10) / 10} за период
                </span>
              )}
            </div>

            <div className="h-40 w-full -ml-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                    dy={8}
                    interval={period === 'month' ? 6 : 0}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MotionCard>
        )}
      </AnimatePresence>

      {/* AI Health Score feature */}
      <MotionCard index={4} className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-500" />
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
              className="text-sm text-gray-700 bg-gray-50 rounded-[12px] p-4 prose prose-sm prose-emerald max-w-none"
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
              className="relative w-full overflow-hidden bg-[linear-gradient(110deg,#10b981,45%,#34d399,55%,#10b981)] bg-[length:200%_200%] text-white font-medium text-sm py-3.5 rounded-2xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)] disabled:opacity-70 disabled:active:scale-100 animate-[shimmer_3s_linear_infinite]"
            >
              {healthLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Получить оценку от ИИ'}
            </motion.button>
          )}
        </AnimatePresence>
      </MotionCard>
    </div>
  );
}