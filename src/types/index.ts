export interface Settings {
  apiKey: string;
  nanoApiKey?: string;
  dailyGoal: number;
  userContext: string;
  proteinGoal?: number;
  fatGoal?: number;
  carbsGoal?: number;
  apiMode?: 'free' | 'simple' | 'advanced';
  // Кастомный URL прокси/эндпоинта для обхода региональных блокировок.
  // Если пусто — используются дефолтные адреса (nano-gpt.com / Google).
  nanoApiEndpoint?: string;
  geminiApiEndpoint?: string;
}

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  ai_thoughts: string;
  reasoning?: string;
  confidence_score?: number;
  images?: string[]; // Base64 array
  image?: string; // For backward compatibility
  items?: AnalyzedItem[]; // Поэлементная разбивка: вес × плотность для каждого блюда
  // Снапшот дневной цели калорий на момент записи приёма пищи.
  // Нужен, чтобы подсветка дней в Статистике не пересчитывалась задним числом
  // при изменении settings.dailyGoal: исторический день оценивается по цели,
  // которая действовала тогда, а не по текущей. У старых записей (до этого
  // поля) отсутствует — тогда берётся текущая цель как fallback.
  dailyGoalSnapshot?: number;
}

// Один элемент разобранного приёма пищи: название, расчётный вес,
// чем оценён размер (portion_basis), типичная калорийность на 100 г,
// КБЖУ именно этой порции и строка расчёта.
export interface AnalyzedItem {
  name: string;
  estimated_weight_g: number;
  portion_basis: string;
  calorie_density: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  breakdown: string;
  // db_key — английский snake_case термин продукта, который модель возвращает
  // для lookup во встроенном справочнике КБЖУ (utils/fooddb.ts). Опционально —
  // модель может не знать точный термин; тогда берётся оценка модели (fallback).
  db_key?: string;
  // Источник КБЖУ: 'db' — из справочника USDA (детерминированно), 'model' —
  // оценка модели. Помечается в utils/ai.ts через enrichItems; используется UI
  // (бейдж «из базы» в AddMeal) и для отладки hit-rate.
  source?: 'db' | 'model';
}

export interface FavoriteMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  images?: string[];
}
