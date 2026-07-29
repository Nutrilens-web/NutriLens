import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Droplets,
  Droplet,
  Drumstick,
  Salad,
  Activity,
  Moon,
  Flame,
  Camera,
  AlertTriangle,
  Clock,
  Utensils,
  Target,
  Dumbbell,
  CheckCircle2,
  Check,
  Wheat,
  Plus,
  Lightbulb,
  Bot,
  ChefHat,
  ShoppingCart,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { Screen } from '../App';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import { getLocalDateString, parseLocalDate } from '../utils/date';
import { SectionLabel, AnimatedNumber } from './ui';
import { haptic } from './haptics';
import {
  getDayTotals,
  calcStreak,
  greeting,
  waterNormaMl,
  effectiveMacroGoals,
  workoutMacros,
  buildInsights,
  nextMealFocus,
  HABITS,
  type Insight,
  type InsightTone,
  type InsightActionType,
} from './insights';

/* ============================================================
   FreshAssistant — «умный центр дня». Полная переработка меню
   ассистента: раньше это была плоская сетка инструментов (дубль
   «Ещё»), которой не пользовались, потому что на самом экране не
   было ценности. Теперь ассистент встречает пользователя живыми
   персональными данными: баланс дня, быстрые действия, совет «что
   съесть дальше», контекстные инсайты, спортивный режим с расчётом
   БЖУ под тренировку и чеклист привычек. Всё считается локально —
   полезно всегда, без сети и ключа. Инструменты остались, но
   вторичным компактным блоком внизу.
   ============================================================ */

/** Маппинг строковых ключей иконок из insights.ts на lucide. */
const ICONS: Record<string, LucideIcon> = {
  camera: Camera,
  alert: AlertTriangle,
  drumstick: Drumstick,
  droplets: Droplets,
  drop: Droplet,
  clock: Clock,
  utensils: Utensils,
  target: Target,
  dumbbell: Dumbbell,
  flame: Flame,
  check: CheckCircle2,
  wheat: Wheat,
  salad: Salad,
  activity: Activity,
  moon: Moon,
};

/** Цветовые роли инсайтов: хорошо / подсказка / предупреждение. */
const TONE: Record<InsightTone, { chip: string; bg: string }> = {
  good: { chip: 'var(--f-accent)', bg: 'color-mix(in srgb, var(--f-accent) 12%, transparent)' },
  tip: { chip: 'var(--f-protein)', bg: 'color-mix(in srgb, var(--f-protein) 12%, transparent)' },
  warn: { chip: 'var(--f-warn)', bg: 'color-mix(in srgb, var(--f-warn) 14%, transparent)' },
};

/** Компактные ссылки на инструменты (вторичный блок внизу). */
const TOOLS: { screen: Screen; label: string; icon: LucideIcon; accent: string }[] = [
  { screen: 'chat', label: 'Диетолог', icon: Bot, accent: 'var(--f-accent)' },
  { screen: 'recommendations', label: 'Идеи еды', icon: Lightbulb, accent: 'var(--f-fat)' },
  { screen: 'fridge', label: 'Холодильник', icon: ChefHat, accent: 'var(--f-protein)' },
  { screen: 'menu', label: 'Ресторан', icon: Utensils, accent: 'var(--f-carbs)' },
  { screen: 'grocery', label: 'Покупки', icon: ShoppingCart, accent: 'var(--f-accent)' },
  { screen: 'water', label: 'Вода', icon: Droplets, accent: 'var(--f-protein)' },
  { screen: 'habits', label: 'Привычки', icon: Activity, accent: 'var(--f-danger)' },
  { screen: 'stats', label: 'Отчёт', icon: BarChart3, accent: 'var(--f-accent)' },
];

export function FreshAssistant({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const {
    settings,
    meals,
    weights,
    water,
    setWater,
    workouts,
    setWorkout,
    habitsLog,
    toggleHabit,
  } = useStore();

  const now = new Date();
  const today = getLocalDateString(now);

  const totals = useMemo(() => getDayTotals(meals, today), [meals, today]);
  const streak = useMemo(() => calcStreak(meals, now), [meals]); // eslint-disable-line react-hooks/exhaustive-deps

  const workout = !!workouts[today];
  const weightKg =
    weights.length > 0
      ? [...weights].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())[0].weight
      : null;
  const waterToday = water[today] || 0;
  const waterGoal = useMemo(() => waterNormaMl(weightKg, workout), [weightKg, workout]);
  const macroGoals = useMemo(() => effectiveMacroGoals(settings, weightKg), [settings, weightKg]);

  const insights = useMemo(
    () =>
      buildInsights({
        totals,
        settings,
        macroGoals,
        waterToday,
        waterGoal,
        streak,
        workout,
        weightKg,
        now,
      }),
    // now намеренно не в зависимостях — пересчёт по изменению данных дня.
    [totals, settings, macroGoals, waterToday, waterGoal, streak, workout, weightKg], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const focus = useMemo(() => nextMealFocus(totals, settings, macroGoals), [totals, settings, macroGoals]);

  const greet = greeting(now);
  const dateLine = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const remaining = settings.dailyGoal - totals.calories;
  const isOver = remaining < 0;

  const habitsToday = habitsLog[today] || [];
  const habitsDone = habitsToday.length;

  const addWater = (delta: number) => {
    setWater(today, Math.max(0, waterToday + delta));
    haptic(delta > 0 ? 'success' : 'light');
  };

  const runAction = (type: InsightActionType) => {
    if (type === 'water') {
      addWater(250);
      return;
    }
    haptic('light');
    onNavigate(type === 'add' ? 'add' : type === 'ideas' ? 'recommendations' : 'chat');
  };

  const go = (s: Screen) => {
    haptic('light');
    onNavigate(s);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Приветствие + серия */}
      <div className="px-0.5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight text-ink">
            {greet.text} {greet.emoji}
          </h1>
          {streak > 0 && (
            <div
              className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full shadow-soft"
              title="Дней подряд с записями"
            >
              <Flame className="w-4 h-4 text-warn fill-warn" />
              <span className="font-display text-sm font-bold text-ink">{streak}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-ink-faint mt-1 capitalize">{dateLine} · персональные подсказки</p>
      </div>

      {/* Баланс дня */}
      <div className="bg-surface rounded-[26px] shadow-card border border-line/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Баланс дня</SectionLabel>
          <span className="text-[11px] text-ink-faint font-medium">цель {settings.dailyGoal} ккал</span>
        </div>

        {/* Калории — крупно */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[32px] font-extrabold tnum text-ink leading-none">
                <AnimatedNumber value={Math.round(totals.calories)} />
              </span>
              <span className="text-[11px] text-ink-faint">ккал съедено</span>
            </div>
            <span className={cn('text-[12px] font-bold tnum', isOver ? 'text-danger' : 'text-accent')}>
              {isOver ? `+${Math.round(-remaining)} перебор` : `осталось ${Math.round(remaining)}`}
            </span>
          </div>
          <MiniBar value={totals.calories} goal={settings.dailyGoal} color={isOver ? 'var(--f-danger)' : 'var(--f-accent)'} />
        </div>

        {/* Белки */}
        <MetricRow
          icon={Drumstick}
          label="Белки"
          value={totals.protein}
          goal={macroGoals.protein}
          unit="г"
          color="var(--f-protein)"
        />

        {/* Вода + быстрая кнопка */}
        <MetricRow
          icon={Droplets}
          label="Вода"
          value={waterToday}
          goal={waterGoal}
          unit="мл"
          color="var(--f-protein)"
          trailing={
            <button
              onClick={() => addWater(250)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-accent-soft text-accent text-[11px] font-bold hover:brightness-105 active:scale-95 transition-all"
              aria-label="Добавить стакан воды"
            >
              <Plus className="w-3.5 h-3.5" /> 250
            </button>
          }
        />
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-4 gap-2.5">
        <QuickAction icon={Camera} label="Приём пищи" accent="var(--f-accent)" onClick={() => go('add')} />
        <QuickAction icon={Droplets} label="+250 мл" accent="var(--f-protein)" onClick={() => addWater(250)} />
        <QuickAction icon={Lightbulb} label="Идеи" accent="var(--f-fat)" onClick={() => go('recommendations')} />
        <QuickAction icon={Bot} label="Диетолог" accent="var(--f-carbs)" onClick={() => go('chat')} />
      </div>

      {/* Что съесть дальше */}
      {focus && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="bg-gradient-to-br from-accent-soft to-surface rounded-[24px] border border-accent-ring/50 p-5 shadow-soft"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl shrink-0" style={{ background: 'color-mix(in srgb, var(--f-accent) 16%, transparent)' }}>
              {React.createElement(ICONS[focus.icon] || Sparkles, { className: 'w-5 h-5', style: { color: 'var(--f-accent)' } })}
            </div>
            <div className="min-w-0">
              <SectionLabel className="mb-1">Что съесть дальше</SectionLabel>
              <h3 className="font-display text-[15px] font-extrabold text-ink leading-tight">{focus.title}</h3>
              <p className="text-[12px] text-ink-soft leading-relaxed mt-1">{focus.text}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Советы на сейчас */}
      <div>
        <SectionLabel className="mb-3 px-0.5">Советы на сейчас</SectionLabel>
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {insights.map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} index={i} onAction={runAction} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Спортивный режим */}
      <WorkoutCard
        workout={workout}
        weightKg={weightKg}
        onToggle={() => {
          setWorkout(today, !workout);
          haptic('medium');
        }}
      />

      {/* Привычки дня */}
      <HabitsCard
        log={habitsToday}
        done={habitsDone}
        onToggle={(id, wasChecked) => {
          toggleHabit(today, id);
          haptic(wasChecked ? 'light' : 'success');
        }}
      />

      {/* Все инструменты */}
      <div>
        <SectionLabel className="mb-3 px-0.5">Все инструменты</SectionLabel>
        <div className="grid grid-cols-4 gap-2.5">
          {TOOLS.map((t) => (
            <ToolChip key={t.screen} tool={t} onNavigate={go} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Мелкие строительные блоки
   ============================================================ */

/** Анимированный бар прогресса. */
function MiniBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full bg-line/60 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 22 }}
      />
    </div>
  );
}

/** Строка метрики (белки/вода): иконка, значение с целью, бар, опц. хвост. */
function MetricRow({
  icon: Icon,
  label,
  value,
  goal,
  unit,
  color,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="p-2 rounded-xl shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-ink-faint font-medium">{label}</span>
          <span className="text-[11px] font-bold text-ink tnum">
            {Math.round(value)} / {goal} {unit}
          </span>
        </div>
        <MiniBar value={value} goal={goal} color={color} />
      </div>
      {trailing}
    </div>
  );
}

/** Кнопка быстрого действия. */
function QuickAction({
  icon: Icon,
  label,
  accent,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="bg-surface rounded-2xl border border-line/40 shadow-soft py-3 flex flex-col items-center gap-1.5 hover:shadow-card transition-shadow"
    >
      <div className="p-2 rounded-xl" style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <span className="text-[10px] font-semibold text-ink-soft leading-tight text-center px-1">{label}</span>
    </motion.button>
  );
}

/** Карточка инсайта с действием. */
function InsightCard({
  insight,
  index,
  onAction,
}: {
  insight: Insight;
  index: number;
  onAction: (type: InsightActionType) => void;
}) {
  const Icon = ICONS[insight.icon] || Sparkles;
  const tone = TONE[insight.tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="bg-surface rounded-[20px] border border-line/40 shadow-soft p-4 flex items-start gap-3"
    >
      <div className="p-2 rounded-xl shrink-0" style={{ background: tone.bg }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: tone.chip }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-bold text-ink leading-tight">{insight.title}</h4>
        <p className="text-[11.5px] text-ink-soft leading-relaxed mt-0.5">{insight.text}</p>
        {insight.action && (
          <button
            onClick={() => onAction(insight.action!.type)}
            className="mt-2.5 text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            style={{ background: tone.bg, color: tone.chip }}
          >
            {insight.action.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** Спортивный режим: тумблер + раскрывающиеся нормы БЖУ под нагрузку. */
function WorkoutCard({
  workout,
  weightKg,
  onToggle,
}: {
  workout: boolean;
  weightKg: number | null;
  onToggle: () => void;
}) {
  const macros = workoutMacros(weightKg);
  return (
    <div className="bg-surface rounded-[24px] border border-line/40 shadow-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2.5 rounded-2xl shrink-0"
            style={{ background: 'color-mix(in srgb, var(--f-danger) 12%, transparent)' }}
          >
            <Dumbbell className="w-5 h-5 text-danger" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-extrabold text-ink leading-tight">Тренировочный день</h3>
            <p className="text-[11px] text-ink-faint mt-0.5">Подстроим нормы воды и БЖУ</p>
          </div>
        </div>
        <Toggle on={workout} onToggle={onToggle} />
      </div>

      <AnimatePresence initial={false}>
        {workout && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-line/40">
              {macros ? (
                <div className="grid grid-cols-3 gap-2.5">
                  <MacroTarget label="Белки" range={macros.protein} color="var(--f-protein)" />
                  <MacroTarget label="Углеводы" range={macros.carbs} color="var(--f-carbs)" />
                  <MacroTarget label="Жиры" range={macros.fat} color="var(--f-fat)" />
                </div>
              ) : (
                <p className="text-[12px] text-ink-soft leading-relaxed">
                  Укажите вес в дневнике — рассчитаю индивидуальные нормы БЖУ под вашу нагрузку.
                </p>
              )}
              <p className="text-[11.5px] text-ink-soft leading-relaxed mt-3">
                💡 Поешьте за 1,5–2 ч до тренировки и в течение часа после — белок и углеводы для восстановления. Норма воды увеличена на 500 мл.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Цель БЖУ под тренировку (диапазон). */
function MacroTarget({ label, range, color }: { label: string; range: [number, number]; color: string }) {
  return (
    <div className="bg-surface-2 border border-line/40 rounded-2xl px-2 py-3 text-center">
      <div className="font-display text-[15px] font-extrabold tnum leading-none" style={{ color }}>
        {range[0]}–{range[1]}
      </div>
      <div className="text-[9.5px] text-ink-faint mt-1">{label}, г</div>
    </div>
  );
}

/** Пружинный тумблер. */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={cn('w-12 h-7 rounded-full p-1 flex items-center shrink-0 transition-colors', on ? 'justify-end' : 'justify-start')}
      style={{ background: on ? 'var(--f-accent)' : 'var(--f-line)' }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className="w-5 h-5 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

/** Чеклист привычек дня с прогрессом. */
function HabitsCard({
  log,
  done,
  onToggle,
}: {
  log: string[];
  done: number;
  onToggle: (id: string, wasChecked: boolean) => void;
}) {
  const percent = Math.round((done / HABITS.length) * 100);
  return (
    <div className="bg-surface rounded-[24px] border border-line/40 shadow-soft p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2.5 rounded-2xl shrink-0"
            style={{ background: 'color-mix(in srgb, var(--f-accent) 12%, transparent)' }}
          >
            <CheckCircle2 className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-extrabold text-ink leading-tight">Привычки дня</h3>
            <p className="text-[11px] text-ink-faint mt-0.5">
              Выполнено {done} из {HABITS.length}
            </p>
          </div>
        </div>
        <span className="font-display text-[16px] font-extrabold text-accent tnum shrink-0">{percent}%</span>
      </div>

      <div className="my-3">
        <MiniBar value={done} goal={HABITS.length} color="var(--f-accent)" />
      </div>

      <div className="space-y-0.5">
        {HABITS.map((h) => {
          const checked = log.includes(h.id);
          const HIcon = ICONS[h.icon] || Sparkles;
          return (
            <button
              key={h.id}
              onClick={() => onToggle(h.id, checked)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 transition-colors active:scale-[0.99]"
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                  checked ? 'bg-accent border-accent' : 'border-line bg-surface-2',
                )}
              >
                {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </span>
              <HIcon className={cn('w-4 h-4 shrink-0', checked ? 'text-accent' : 'text-ink-faint')} />
              <span
                className={cn(
                  'text-[12.5px] font-medium text-left flex-1 transition-colors',
                  checked ? 'text-ink-faint line-through' : 'text-ink',
                )}
              >
                {h.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Компактная ссылка на инструмент. */
function ToolChip({
  tool,
  onNavigate,
}: {
  tool: { screen: Screen; label: string; icon: LucideIcon; accent: string };
  onNavigate: (s: Screen) => void;
}) {
  const Icon = tool.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={() => onNavigate(tool.screen)}
      className="bg-surface rounded-2xl border border-line/40 shadow-soft py-3 flex flex-col items-center gap-1.5 hover:shadow-card transition-shadow"
    >
      <div className="p-2 rounded-xl" style={{ background: `color-mix(in srgb, ${tool.accent} 13%, transparent)` }}>
        <Icon className="w-4 h-4" style={{ color: tool.accent }} />
      </div>
      <span className="text-[9.5px] font-semibold text-ink-soft leading-tight text-center px-0.5">{tool.label}</span>
    </motion.button>
  );
}
