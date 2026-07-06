/**
 * fooddb.ts — детерминированный lookup КБЖУ продуктов из встроенного справочника
 * (src/data/fooddb.json, сгенерирован скриптом scripts/build-fooddb.cjs из USDA).
 *
 * Идея: модель (Gemini flash lite) отвечает за зрение — что за блюдо и вес порции,
 * а калорийность/БЖУ на 100 г берутся из справочника, а не галлюцинируются
 * моделью. Итог считается детерминированно: калории = вес × плотность. Если
 * продукт в базе не найден — caller (ai.ts) использует оценку модели как fallback.
 *
 * Все функции синхронные и без I/O: справочник импортируется статически и живёт
 * в бандле. Lookup мгновенный, офлайн, $0.
 */
import foodDbRaw from '../data/fooddb.json';

/** Запись о продукте в справочнике (см. src/data/fooddb.json). */
export interface FoodEntry {
  aliases: string[];
  density_kcal_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  /** Ссылка на первоисточник USDA (fdcId/description/dataType) — для отладки. */
  _usda?: { fdcId: number; description: string; dataType: string };
}

/** Источник КБЖУ в item — помечается enrichItem для UI и отладки. */
export type MacroSource = 'db' | 'model';

// Справочник без служебных ключей (_comment_*, generated_at, source, products_count).
// Фильтруем на старте один раз — дальше lookup по чистому объекту.
type FoodDb = Record<string, FoodEntry>;
const DB: FoodDb = (() => {
  const clean: FoodDb = {};
  for (const [k, v] of Object.entries(foodDbRaw)) {
    if (k.startsWith('_')) continue; // служебные мета-поля
    const entry = v as Partial<FoodEntry>;
    if (
      typeof entry.density_kcal_per_100g === 'number' &&
      typeof entry.protein_per_100g === 'number' &&
      typeof entry.fat_per_100g === 'number' &&
      typeof entry.carbs_per_100g === 'number' &&
      Array.isArray(entry.aliases)
    ) {
      clean[k] = entry as FoodEntry;
    }
  }
  return clean;
})();

// Список всех валидных ключей базы — экспортируется для передачи в промпт ИИ,
// чтобы модель возвращала db_key из реального множества, а не галлюцинировала.
// Строится один раз при загрузке модуля.
export const FOOD_DB_KEYS: readonly string[] = Object.keys(DB);

// Обратный индекс алиасов → ключ. Строится один раз при загрузке модуля,
// чтобы lookup по русским/альтернативным названиям был O(1), а не O(n*aliases).
// В key кладём нормализованную форму алиаса (см. normalizeKey).
const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, entry] of Object.entries(DB)) {
    // сам ключ тоже нормализуем и индексируем — он может прийти от модели
    m.set(normalizeKey(key), key);
    for (const alias of entry.aliases) {
      m.set(normalizeKey(alias), key);
    }
  }
  return m;
})();

/**
 * Нормализация ключа/алиаса для сравнения: lower-case, обрезка, любые
 * не-буквенно-цифровые последовательности → '_', обрезка краёв.
 * «Buckwheat cooked» и «buckwheat_cooked» дают одну форму «buckwheat_cooked».
 */
export function normalizeKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    // ё→е: в русском «варёная» и «вареная» — одна и та же форма, но дают
    // разные нормализованные ключи (U+0451 vs U+0435). Унифицируем к «е»,
    // чтобы опечатка/вариант написания не ломала lookup.
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Ищет продукт в справочнике по db_key или любому названию (включая русские).
 * Сначала пробует точный ключ, затем нормализованный ключ, затем алиасы.
 * Возвращает запись или null (→ caller берёт оценку модели как fallback).
 */
export function lookupFood(dbKeyOrName: string | null | undefined): FoodEntry | null {
  if (!dbKeyOrName) return null;
  // 1) точный ключ как есть
  const direct = DB[dbKeyOrName];
  if (direct) return direct;
  // 2) нормализованный ключ (модель могла отдать «Buckwheat cooked»)
  const norm = normalizeKey(dbKeyOrName);
  if (DB[norm]) return DB[norm];
  // 3) по индексу алиасов (включая русские названия)
  const byAlias = ALIAS_INDEX.get(norm);
  if (byAlias) return DB[byAlias];
  return null;
}

/** Контракт item, который enrichItem читает и пишет. Совпадает с AnalyzedItem. */
export interface EnrichableItem {
  name: string;
  estimated_weight_g: number;
  portion_basis?: string;
  calorie_density?: number;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  breakdown?: string;
  /** db_key от модели (опционально — может не знать точный термин). */
  db_key?: string;
  /** Источник КБЖУ — проставляется enrichItem: 'db' (справочник) или 'model'. */
  source?: MacroSource;
}

/**
 * Обогащает один item табличными КБЖУ из справочника, если продукт найден.
 * - Пересчитывает calorie_density, calories, protein, fat, carbs = вес/100 × табличное.
 * - Ставит source = 'db'.
 * - db_key нормализуется до канонического ключа записи (удобно для отладки/UI).
 *
 * Если продукт не найден — ничего не трогает, ставит source = 'model'
 * (caller использует оценку модели как fallback). Это гарантирует, что
 * худший случай = текущее поведение (нет регресса).
 */
export function enrichItem<T extends EnrichableItem>(item: T): T {
  // Валидация веса: 0, отрицательные или абсурдно большие (>2000 г) значения
  // не enrich'им — оставляем оценку модели. Иначе enrichItem обнулил бы
  // калории при weight=0 или выдал отрицательные при weight<0.
  const rawWeight = Number(item.estimated_weight_g);
  if (!rawWeight || rawWeight <= 0 || rawWeight > 2000) {
    return { ...item, source: 'model' as MacroSource };
  }

  // Guard смешанных блюд: если name содержит признаки составного блюда
  // (запятые, «с», «и», «в», соусы, суп, салат, плов...), enrich одиночным
  // продуктом срежет скрытые калории (масло, соус) и заменит верный модельный
  // итог на табличный «чистый продукт». Даже если модель вернула db_key —
  // она ошиблась классификацией, enrich здесь навредит. Не enrich'им.
  if (looksLikeMixedDish(item.name)) {
    return { ...item, source: 'model' as MacroSource };
  }

  const entry = lookupFood(item.db_key) ?? lookupFood(item.name);
  if (!entry) {
    return { ...item, source: 'model' as MacroSource };
  }
  const weight = rawWeight;
  const factor = weight / 100; // доля от 100 г
  const calories = Math.round(entry.density_kcal_per_100g * factor);
  const protein = round1(entry.protein_per_100g * factor);
  const fat = round1(entry.fat_per_100g * factor);
  const carbs = round1(entry.carbs_per_100g * factor);
  // Перегенерируем breakdown, чтобы он соответствовал табличным значениям.
  // Иначе в UI остаётся старый breakdown модели («200г × 356 = 712») рядом
  // с новой плотностью 92 и калориями 184 — тройное противоречие.
  const breakdown = `${weight}г × ${entry.density_kcal_per_100g} ккал/100г = ${calories} ккал [USDA]`;
  return {
    ...item,
    db_key: canonicalKey(entry) ?? item.db_key,
    calorie_density: entry.density_kcal_per_100g,
    calories,
    protein,
    fat,
    carbs,
    breakdown,
    source: 'db' as MacroSource,
  };
}

/**
 * Эвристика: похож ли name на смешанное/составное блюдо (плов, салат, суп,
 * отбивная в панировке, каша с маслом). Для таких блюд enrich одиночным
 * продуктом срежет скрытые калории — лучше оставить оценку модели.
 */
function looksLikeMixedDish(name: string): boolean {
  const n = String(name || '').toLowerCase();
  // Запятая = перечисление ингредиентов.
  if (n.includes(',')) return true;
  // Союзы/предлоги соединения — «рис с овощами», «котлета и пюре», «каша на молоке».
  if (/\s(с|и|в|на)\s/.test(n)) return true;
  // Явные составные блюда.
  if (/(суп|борщ|солянка|плов|жульен|рагу|голубцы|тефтели|ежики|гуляш|азу|ризотто|паэлья|суши|роллы|сэндвич|бургер|шаверма|шаурма|бутерброд|пицца|окрошка|винегрет|оливье|салат|рагу|запеканка|лазанья|паста|спагетти|карбонара)/.test(n)) return true;
  return false;
}

/** Применяет enrichItem к массиву items. Не мутирует исходный массив. */
export function enrichItems<T extends EnrichableItem>(items: T[] | null | undefined): T[] {
  if (!items || !items.length) return items ?? [];
  return items.map((it) => enrichItem(it));
}

/** Доля items, найденных в справочнике — для метрики покрытия/отладки. */
export function dbHitRate(items: EnrichableItem[]): number {
  if (!items.length) return 0;
  const hits = items.filter((it) => it.source === 'db').length;
  return hits / items.length;
}

// --- внутренние хелперы -------------------------------------------------

// Возвращает канонический ключ записи (для подстановки в item.db_key).
// Линейный поиск по DB — редко вызывается (только при успешном enrichItem),
// поэтому без отдельного обратного индекса.
function canonicalKey(entry: FoodEntry): string | undefined {
  for (const [k, v] of Object.entries(DB)) {
    if (v === entry) return k;
  }
  return undefined;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
