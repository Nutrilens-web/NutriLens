import type { Meal, Settings } from '../types';
import { getLocalDateString } from '../utils/date';

/* ============================================================
   Мозг умного ассистента. Вся логика — детерминированная и
   считается ЛОКАЛЬНО из данных пользователя (приёмы пищи, вода,
   вес, цели). Не требует ни сети, ни API-ключа, поэтому подсказки
   доступны всегда и мгновенно. ИИ остаётся для глубоких вопросов
   (чат, рецепты), а здесь — быстрые персональные выводы «на сейчас».
   ============================================================ */

/** Сводка по дню: суммарное КБЖУ, число записей и час последней. */
export interface DayTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealCount: number;
  /** Час (0-23) последней записи за день, либо null если записей нет. */
  lastMealHour: number | null;
}

export function getDayTotals(meals: Meal[], date: string): DayTotals {
  const day = meals.filter((m) => m.date === date);
  let lastMealHour: number | null = null;
  if (day.length > 0) {
    const sorted = [...day].sort((a, b) => a.time.localeCompare(b.time));
    const last = sorted[sorted.length - 1];
    const h = parseInt(last.time.split(':')[0], 10);
    if (!Number.isNaN(h)) lastMealHour = h;
  }
  return {
    calories: day.reduce((s, m) => s + m.calories, 0),
    protein: day.reduce((s, m) => s + m.protein, 0),
    fat: day.reduce((s, m) => s + m.fat, 0),
    carbs: day.reduce((s, m) => s + m.carbs, 0),
    mealCount: day.length,
    lastMealHour,
  };
}

/** Серия дней подряд с записями (как на дашборде, считаем независимо). */
export function calcStreak(meals: Meal[], now: Date): number {
  if (meals.length === 0) return 0;
  const dates = new Set(meals.map((m) => m.date));
  let streak = 0;
  const check = new Date(now);
  check.setHours(0, 0, 0, 0);
  if (dates.has(getLocalDateString(check))) {
    streak++;
  } else {
    check.setDate(check.getDate() - 1);
    if (!dates.has(getLocalDateString(check))) return 0;
  }
  for (;;) {
    check.setDate(check.getDate() - 1);
    if (dates.has(getLocalDateString(check))) streak++;
    else break;
  }
  return streak;
}

/** Приветствие по времени суток. */
export function greeting(now: Date): { text: string; emoji: string } {
  const h = now.getHours();
  if (h < 5) return { text: 'Доброй ночи', emoji: '🌙' };
  if (h < 12) return { text: 'Доброе утро', emoji: '☀️' };
  if (h < 18) return { text: 'Добрый день', emoji: '🌤️' };
  return { text: 'Добрый вечер', emoji: '🌆' };
}

/**
 * Суточная норма воды: ~35 мл/кг (округление до 50 мл), при тренировке +500 мл.
 * Если вес неизвестен — типовые 2000 мл.
 */
export function waterNormaMl(weightKg: number | null, workout: boolean): number {
  const base = weightKg ? Math.round((weightKg * 35) / 50) * 50 : 2000;
  return workout ? base + 500 : base;
}

/**
 * Эффективные цели по БЖУ. Если пользователь задал их в настройках — берём их;
 * иначе выводим из дневной цели калорий и веса (белок 1.8 г/кг, жиры 30% ккал,
 * углеводы — остаток). Это делает ассистента полезным сразу, без ручной настройки.
 */
export function effectiveMacroGoals(
  settings: Settings,
  weightKg: number | null,
): { protein: number; fat: number; carbs: number } {
  const protein =
    settings.proteinGoal ||
    (weightKg ? Math.round(weightKg * 1.8) : Math.round((settings.dailyGoal * 0.3) / 4));
  const fat = settings.fatGoal || Math.round((settings.dailyGoal * 0.3) / 9);
  const carbs = settings.carbsGoal || Math.round((settings.dailyGoal * 0.4) / 4);
  return { protein, fat, carbs };
}

/** Целевые диапазоны БЖУ под тренировочный день (зависят от веса). */
export function workoutMacros(
  weightKg: number | null,
): { protein: [number, number]; carbs: [number, number]; fat: [number, number] } | null {
  if (!weightKg) return null;
  return {
    protein: [Math.round(weightKg * 1.8), Math.round(weightKg * 2.0)],
    carbs: [Math.round(weightKg * 4), Math.round(weightKg * 5)],
    fat: [Math.round(weightKg * 0.8), Math.round(weightKg * 1.0)],
  };
}

/* ============================================================
   Инсайты «на сейчас»
   ============================================================ */

export type InsightTone = 'good' | 'tip' | 'warn';
export type InsightActionType = 'water' | 'add' | 'ideas' | 'chat';

export interface Insight {
  id: string;
  tone: InsightTone;
  /** Ключ иконки — маппинг на lucide живёт в UI (insights остаётся без React). */
  icon: string;
  title: string;
  text: string;
  priority: number;
  action?: { label: string; type: InsightActionType };
}

export interface InsightContext {
  totals: DayTotals;
  settings: Settings;
  macroGoals: { protein: number; fat: number; carbs: number };
  waterToday: number;
  waterGoal: number;
  streak: number;
  workout: boolean;
  weightKg: number | null;
  now: Date;
}

/**
 * Собирает все релевантные подсказки, сортирует по приоритету и отдаёт
 * топ-4. Приоритеты: сначала срочное (перебор, пустой день, дефициты),
 * затем позитив — чтобы экран был сбалансированным, а не «пугалкой».
 */
export function buildInsights(ctx: InsightContext): Insight[] {
  const { totals, settings, macroGoals, waterToday, waterGoal, streak, workout, weightKg, now } = ctx;
  const out: Insight[] = [];
  const hour = now.getHours();
  const remaining = settings.dailyGoal - totals.calories;

  // Пустой день — приглашение начать.
  if (totals.mealCount === 0) {
    out.push({
      id: 'empty',
      tone: 'tip',
      icon: 'camera',
      title: 'Пока нет записей',
      text: 'Запишите первый приём пищи — и я начну следить за балансом и подсказывать, что съесть дальше.',
      priority: 95,
      action: { label: 'Добавить', type: 'add' },
    });
  }

  // Перебор калорий.
  if (totals.mealCount > 0 && remaining < 0) {
    out.push({
      id: 'over',
      tone: 'warn',
      icon: 'alert',
      title: `Перебор на ${Math.round(-remaining)} ккал`,
      text: 'Не критично. Следующий приём сделайте легче: белок + овощи, без жирного и сладкого.',
      priority: 100,
      action: { label: 'Лёгкие идеи', type: 'ideas' },
    });
  }

  // Белок: дефицит или выполнение нормы.
  const proteinDiff = macroGoals.protein - totals.protein;
  if (totals.mealCount > 0 && proteinDiff > 15) {
    out.push({
      id: 'protein-low',
      tone: 'tip',
      icon: 'drumstick',
      title: `Не хватает ${Math.round(proteinDiff)} г белка`,
      text: 'Белок даёт сытость и сохраняет мышцы. Добавьте творог, яйца, курицу или протеиновый коктейль.',
      priority: 80,
      action: { label: 'Белковые идеи', type: 'ideas' },
    });
  } else if (totals.mealCount > 0 && totals.protein >= macroGoals.protein) {
    out.push({
      id: 'protein-ok',
      tone: 'good',
      icon: 'drumstick',
      title: 'Норма белка выполнена',
      text: `${Math.round(totals.protein)} г белка за день — отлично для мышц и контроля аппетита.`,
      priority: 40,
    });
  }

  // Вода: мало или норма.
  if (waterToday < waterGoal * 0.5) {
    out.push({
      id: 'water-low',
      tone: 'tip',
      icon: 'droplets',
      title: `Выпито ${waterToday} из ${waterGoal} мл`,
      text: 'Вода помогает контролировать аппетит и уровень энергии. Выпейте стакан прямо сейчас.',
      priority: 70,
      action: { label: 'Выпить стакан', type: 'water' },
    });
  } else if (waterGoal > 0 && waterToday >= waterGoal) {
    out.push({
      id: 'water-ok',
      tone: 'good',
      icon: 'droplets',
      title: 'Норма воды выполнена 💧',
      text: 'Отличная гидратация сегодня — так держать!',
      priority: 38,
    });
  }

  // Долгая пауза без записей.
  if (totals.lastMealHour !== null && totals.mealCount > 0) {
    const gap = hour - totals.lastMealHour;
    if (gap >= 5 && hour >= 6 && hour <= 23) {
      out.push({
        id: 'gap',
        tone: 'tip',
        icon: 'clock',
        title: `Без записей уже ${gap} ч`,
        text: 'Долгие паузы часто ведут к перееданию вечером. Запишите перекус или приём пищи.',
        priority: 60,
        action: { label: 'Записать', type: 'add' },
      });
    }
  }

  // Вечер, а калорий ещё много — напоминание поужинать.
  if (totals.mealCount > 0 && remaining > 0 && hour >= 17 && remaining > settings.dailyGoal * 0.35) {
    out.push({
      id: 'evening',
      tone: 'tip',
      icon: 'utensils',
      title: `На ужин ещё ${Math.round(remaining)} ккал`,
      text: 'Не пропускайте ужин — иначе велик риск сорваться ночью. Выберите белок и овощи.',
      priority: 55,
      action: { label: 'Идеи ужина', type: 'ideas' },
    });
  }

  // Почти у цели по калориям.
  if (totals.mealCount > 0 && remaining > 0 && remaining < 200) {
    out.push({
      id: 'nearly',
      tone: 'good',
      icon: 'target',
      title: 'Почти у цели',
      text: `Осталось всего ${Math.round(remaining)} ккал. Лёгкий перекус — и день идеально сбалансирован.`,
      priority: 35,
    });
  }

  // Тренировочный день.
  if (workout) {
    const macros = workoutMacros(weightKg);
    out.push({
      id: 'workout',
      tone: 'tip',
      icon: 'dumbbell',
      title: 'Тренировочный день 💪',
      text: macros
        ? `Сделайте упор на белок (~${macros.protein[0]}–${macros.protein[1]} г) и углеводы до и после нагрузки — это ускорит восстановление.`
        : 'Поешьте за 1,5–2 ч до тренировки (углеводы + белок) и в течение часа после. Укажите вес в дневнике — посчитаю нормы точнее.',
      priority: 50,
      action: { label: 'Что съесть', type: 'ideas' },
    });
  }

  // Серия дней.
  if (streak >= 3) {
    out.push({
      id: 'streak',
      tone: 'good',
      icon: 'flame',
      title: `Серия ${streak} дн. 🔥`,
      text: 'Вы ведёте дневник без пропусков. Регулярность — главный секрет результата.',
      priority: 30,
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

/* ============================================================
   «Что съесть дальше» — рекомендация фокуса следующего приёма.
   ============================================================ */

export interface MealFocus {
  icon: string;
  title: string;
  text: string;
}

export function nextMealFocus(
  totals: DayTotals,
  settings: Settings,
  macroGoals: { protein: number; fat: number; carbs: number },
): MealFocus | null {
  if (totals.mealCount === 0) return null;

  const deficits = [
    { key: 'protein' as const, ratio: totals.protein / macroGoals.protein, left: macroGoals.protein - totals.protein },
    { key: 'fat' as const, ratio: totals.fat / macroGoals.fat, left: macroGoals.fat - totals.fat },
    { key: 'carbs' as const, ratio: totals.carbs / macroGoals.carbs, left: macroGoals.carbs - totals.carbs },
  ];

  if (deficits.every((d) => d.left <= 0)) {
    return {
      icon: 'check',
      title: 'Все цели по БЖУ закрыты',
      text: 'Отличный баланс! Следующий приём сделайте лёгким: овощи + нежирный белок.',
    };
  }

  // Самый отстающий макронутриент (минимальная доля выполнения).
  const worst = [...deficits].sort((a, b) => a.ratio - b.ratio)[0];
  const variants: Record<'protein' | 'fat' | 'carbs', MealFocus> = {
    protein: {
      icon: 'drumstick',
      title: `Акцент на белок (+${Math.round(worst.left)} г)`,
      text: 'Курица, рыба, яйца, творог или бобовые. Добавьте овощи — они дадут объём без лишних калорий.',
    },
    fat: {
      icon: 'drop',
      title: `Доберите полезных жиров (+${Math.round(worst.left)} г)`,
      text: 'Авокадо, орехи, оливковое масло или жирная рыба. Жиры важны для гормонов и сытости.',
    },
    carbs: {
      icon: 'wheat',
      title: `Нужны углеводы (+${Math.round(worst.left)} г)`,
      text: 'Крупы, цельнозерновой хлеб, фрукты. Это энергия — особенно если впереди тренировка.',
    },
  };
  return variants[worst.key];
}

/* ============================================================
   Привычки дня — константы чеклиста.
   ============================================================ */

export interface HabitDef {
  id: string;
  label: string;
  icon: string;
}

export const HABITS: HabitDef[] = [
  { id: 'water', label: 'Выпить норму воды', icon: 'droplets' },
  { id: 'protein', label: 'Белок в каждом приёме', icon: 'drumstick' },
  { id: 'vegs', label: 'Овощи или фрукты', icon: 'salad' },
  { id: 'move', label: '30 минут активности', icon: 'activity' },
  { id: 'no_late', label: 'Не есть за 3 ч до сна', icon: 'moon' },
];
