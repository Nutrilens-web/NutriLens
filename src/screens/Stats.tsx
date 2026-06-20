import { getAIForSettings, getApiKeyError } from '../utils/ai-wrapper';
import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { cn } from '../utils/cn';
import { Bot, Loader2 } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Markdown from 'react-markdown';
import { getLocalDateString } from '../utils/date';


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
        const status = avgCals <= avgGoal
          ? 'normal'
          : (avgCals <= avgGoal + 200 ? 'warning' : 'over');
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

        const status = cals <= settings.dailyGoal
          ? 'normal'
          : (cals <= settings.dailyGoal + 200 ? 'warning' : 'over');

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
      const modelName = mode === 'advanced'
        ? 'google/gemini-3-flash-preview-thinking'
        : (mode === 'simple' ? 'google/gemini-3.1-flash-lite' : 'gemini-2.5-flash');
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

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl font-semibold text-gray-900">Статистика</h2>
      </div>
      
      {/* Toggles */}
      <div className="flex flex-col gap-3">
        <div className="bg-gray-100 p-1 rounded-full flex mx-1">
          <button 
            onClick={() => setPeriod('week')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-full transition-all", period === 'week' ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-full transition-all", period === 'month' ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-full transition-all", period === 'year' ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
          >
            Год
          </button>
        </div>
        
        <div className="bg-gray-100 p-1 rounded-full flex mx-1">
          <button 
            onClick={() => setMetric('calories')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-full transition-all", metric === 'calories' ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
          >
            Калории
          </button>
          <button 
            onClick={() => setMetric('weight')}
            className={cn("flex-1 py-1.5 text-xs font-medium rounded-full transition-all", metric === 'weight' ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}
          >
            Вес
          </button>
        </div>
      </div>
      
      {metric === 'calories' ? (
        <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <h3 className="text-xs font-medium text-gray-500 mb-1">Среднее за {period === 'week' ? '7 дней' : (period === 'month' ? '30 дней' : 'год')}</h3>
          <div className="flex items-end gap-1.5 mb-5">
            <span className="text-2xl font-light text-gray-900">{avgCalories || 0}</span>
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
                  {chartData.map((entry, index) => (
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
        </div>
      ) : (
        <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <h3 className="text-xs font-medium text-gray-500 mb-1">Текущий вес</h3>
          <div className="flex items-end gap-2 mb-5">
            <span className="text-2xl font-light text-gray-900">{currentWeight || '--'}</span>
            <span className="text-[11px] text-gray-400 mb-1">кг</span>
            {weightChange !== 0 && (
              <span className={cn("text-[11px] font-medium mb-1 ml-2", weightChange > 0 ? "text-red-500" : "text-emerald-500")}>
                {weightChange > 0 ? '+' : ''}{Math.round(weightChange * 10) / 10} за период
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
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI Health Score feature */}
      <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-500" /> 
          Анализ рациона
        </h3>
        
        {healthScore ? (
          <div className="text-sm text-gray-700 bg-gray-50 rounded-[12px] p-4 prose prose-sm prose-emerald max-w-none">
             <Markdown>{healthScore}</Markdown>
          </div>
        ) : (
          <button 
             onClick={handleHealthAnalysis}
             disabled={healthLoading}
             className="relative w-full overflow-hidden bg-[linear-gradient(110deg,#10b981,45%,#34d399,55%,#10b981)] bg-[length:200%_200%] text-white font-medium text-sm py-3.5 rounded-2xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)] disabled:opacity-70 disabled:active:scale-100 animate-[shimmer_3s_linear_infinite]"
          >
             {healthLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Получить оценку от ИИ'}
          </button>
        )}
      </div>
    </div>
  );
}
