// find-correct-fdcids.cjs — ищет в кэше search-хитов USDA правильные продукты
// для проблемных ключей fooddb.json, где генератор выбрал не тот продукт.
//
// Для каждого проблемного ключа задаём: term (термин поиска в кэше) и
// descriptionMatch (подстрока/регэксп, которому должно соответствовать описание
// USDA). Скрипт находит лучший search-хит, вытаскивает fdcId + КБЖУ и выводит
// готовую строку для вставки в fooddb.json.
//
// КБЖУ берутся прямо из search-хита (там есть nutrient 208/203/204/205),
// БЕЗ обращения к сети.
const fs = require('fs');
const path = require('path');
const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', '.usda-cache.json'), 'utf8'));

const KCAL_CODES = ['208', '957', '958'];
const PROT = '203', FAT = '204', CARB = '205';

function macrosFromHit(hit) {
  const byCode = {};
  for (const n of (hit.foodNutrients || [])) {
    const c = String(n.nutrientNumber ?? n.nutrient?.number ?? '');
    if (c && !(c in byCode)) byCode[c] = Number(n.amount ?? n.value) || 0;
  }
  let kcal = 0;
  for (const c of KCAL_CODES) if (byCode[c]) { kcal = byCode[c]; break; }
  return { kcal, protein: byCode[PROT] || 0, fat: byCode[FAT] || 0, carbs: byCode[CARB] || 0 };
}

// Соберём плоский список всех search-хитов.
const allHits = [];
for (const [k, v] of Object.entries(cache)) {
  if (!k.startsWith('search::')) continue;
  const term = k.replace('search::', '');
  const arr = Array.isArray(v) ? v : (v.foods || []);
  for (const h of arr) allHits.push({ term, ...h });
}

// Проблемные ключи → (термин поиска в кэше, описание-критерий, dataType-приоритет).
// descriptionMatch — регулярное выражение (case-insensitive).
const wanted = [
  ['avocado', 'avocado raw', /^Avocado[,.]? raw/i, 'SR Legacy'],
  ['olives', 'olives black or green', /^Olives,.*raw/i, 'SR Legacy'],
  ['carrot', 'carrot raw', /^Carrots,.*raw/i, 'SR Legacy'],
  ['sunflower_oil', 'oil sunflower', /^Oil, sunflower/i, 'SR Legacy'],
  ['pancakes', 'pancake plain', /^Pancakes,.*plain/i, 'SR Legacy'],
  ['bell_pepper', 'peppers bell raw', /^Peppers, bell,.*raw/i, 'SR Legacy'],
  ['beetroot_boiled', 'beets cooked', /^Beets,.*cooked/i, 'SR Legacy'],
  ['salad_green_mixed', 'lettuce salad raw', /^Lettuce,.*raw/i, 'SR Legacy'],
  ['salad_olivier', 'potato salad', /^Potato salad/i, 'SR Legacy'],
  ['strawberry', 'strawberries raw', /^Strawberries,.*raw/i, 'SR Legacy'],
  ['lemon', 'lemons raw', /^Lemons,.*raw/i, 'SR Legacy'],
  ['chickpeas_cooked', 'chickpeas cooked', /^Chickpeas,.*cooked/i, 'SR Legacy'],
  ['lentils_cooked', 'lentils cooked', /^Lentils,.*cooked/i, 'SR Legacy'],
  ['sugar_white', 'sugar granulated white', /^Sugars, granulated/i, 'SR Legacy'],
  ['milk_whole', 'milk whole fluid', /^Milk,.*whole.*fluid/i, 'SR Legacy'],
  ['dumplings_meat', 'dumpling meat', /dumpling.*meat/i, 'SR Legacy'],
  ['syrniki', 'cheese pancake', /cottage cheese.*pancake|syrnik/i, 'SR Legacy'],
  ['potato_mashed', 'potato mashed', /^Potatoes,.*mashed/i, 'SR Legacy'],
  ['potato_boiled', 'potato boiled flesh', /^Potatoes,.*boled.*flesh|^Potatoes, flesh.*cooked/i, 'SR Legacy'],
  ['cucumber', 'cucumber raw', /^Cucumber,.*raw/i, 'SR Legacy'],
  ['salad_green_mixed_alt', 'salad green leafy', /^Lettuce,.*raw/i, 'SR Legacy'],
];

console.log('Поиск правильных продуктов в кэше USDA search-хитов:\n');
for (const [key, termHint, descRe, preferType] of wanted) {
  // Сначала ищем по точному термину в кэше.
  let candidates = allHits.filter(h => descRe.test(h.description || ''));
  // Если по описанию не нашлось — ищем по termHint среди терминов.
  if (!candidates.length) {
    const termLow = termHint.toLowerCase();
    candidates = allHits.filter(h => h.term.toLowerCase().includes(termLow) || (h.description||'').toLowerCase().includes(termLow));
  }
  if (!candidates.length) {
    console.log(`❌ ${key.padEnd(24)} — НЕ НАЙДЕН в кэше (term="${termHint}")`);
    continue;
  }
  // Приоритет SR Legacy > Foundation > остальное.
  candidates.sort((a, b) => {
    const rank = t => (t === 'SR Legacy' ? 0 : t === 'Foundation' ? 1 : 2);
    return rank(a.dataType) - rank(b.dataType);
  });
  const best = candidates[0];
  const m = macrosFromHit(best);
  console.log(`✓ ${key.padEnd(24)} fdcId=${best.fdcId} — ${best.description} [${best.dataType}] → ${m.kcal} ккал / Б${m.protein} / Ж${m.fat} / У${m.carbs}`);
}
