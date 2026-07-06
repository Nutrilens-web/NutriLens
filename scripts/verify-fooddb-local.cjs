// verify-fooddb-local.cjs — локальная сверка fooddb.json с кэшем ответов USDA
// (scripts/.usda-cache.json), БЕЗ обращения к сети.
//
// Кэш .usda-cache.json — это сырые ответы USDA /food/{fdcId}, сохранённые
// скриптом build-fooddb.cjs при генерации базы. Каждая запись базы ссылается
// на fdcId в поле _usda.fdcId — мы берём этот fdcId, находим в кэше исходный
// ответ USDA и сверяем КБЖУ (вытаскиваем по тем же кодам нутриентов, что
// генератор) с тем, что записано в базе.
//
// Если значение в базе совпадает с КБЖУ из исходного USDA-ответа — запись
// реальна (взята из USDA, не придумана). Расхождение означает ошибку
// генератора или ручной правки — помечается для проверки.
//
// Запуск: node scripts/verify-fooddb-local.cjs

const fs = require('fs');
const path = require('path');

const KCAL_CODES = ['208', '957', '958'];
const NUTRIENT_CODES = { protein: '203', fat: '204', carbs: '205' };

function extractMacros(food) {
  const nuts = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const byCode = {};
  for (const n of nuts) {
    // Формат отличается между /food/{fdcId} (nutrient.number + amount) и
    // /foods/search (nutrientNumber + value). Поддерживаем оба.
    const code = String(n.nutrient?.number ?? n.nutrientNumber ?? '');
    if (!code) continue;
    const val = Number(n.amount ?? n.value ?? 0);
    if (!(code in byCode) || byCode[code] === 0) byCode[code] = val;
  }
  let kcal = 0;
  for (const c of KCAL_CODES) {
    if (byCode[c]) { kcal = byCode[c]; break; }
  }
  return {
    kcal,
    protein: byCode[NUTRIENT_CODES.protein] || 0,
    fat: byCode[NUTRIENT_CODES.fat] || 0,
    carbs: byCode[NUTRIENT_CODES.carbs] || 0,
  };
}

function approxEq(a, b, tol) { return Math.abs(a - b) <= tol; }

const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', '.usda-cache.json'), 'utf8'));
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'fooddb.json'), 'utf8'));
const keys = Object.keys(db).filter(k => !k.startsWith('_') && typeof db[k].density_kcal_per_100g === 'number');

console.log(`Сверка ${keys.length} продуктов базы с локальным кэшем ответов USDA (${Object.keys(cache).length} записей в кэше).\n`);

let ok = 0, mismatch = 0, noCache = 0, manualFix = 0;
const mismatches = [];
const noCacheList = [];

for (const k of keys) {
  const entry = db[k];
  const fdcId = entry._usda?.fdcId;
  const cacheKey = `food::${fdcId}`;
  let cached = cache[cacheKey];
  let verifiedVia = 'food::'; // откуда взяли данные для сверки

  if (!fdcId) {
    console.log(`НЕТ_FDCID  ${k.padEnd(26)} — невозможно сверить (нет ссылки на USDA)`);
    noCache++;
    noCacheList.push({ key: k, reason: 'нет _usda.fdcId' });
    continue;
  }
  if (!cached) {
    // food:: записи нет — ищем fdcId среди search-хитов. В кэше search-хитов
    // тоже есть foodNutrients (коды 208/203/204/205), поэтому сверка КБЖУ
    // возможна. Это покрывает ручные правки, где fdcId выбран из search-хита,
    // но /food/{fdcId} не запрашивался.
    let foundInSearch = null;
    for (const [sk, sv] of Object.entries(cache)) {
      if (!sk.startsWith('search::')) continue;
      const arr = Array.isArray(sv) ? sv : (sv.foods || []);
      const hit = arr.find(h => h.fdcId === fdcId);
      if (hit) { foundInSearch = hit; break; }
    }
    if (foundInSearch) {
      cached = foundInSearch;
      verifiedVia = 'search::';
    } else {
    // Эта запись могла быть добавлена вручную (исправления banana/buckwheat/egg
    // и т.д.) — у неё есть fdcId, но исходный ответ не сохранился в кэше, потому
    // что генератор не запрашивал этот fdcId. Помечаем отдельно.
    console.log(`РУЧНАЯ     ${k.padEnd(26)} fdcId=${fdcId} — нет ни в food::, ни в search:: кэше`);
    manualFix++;
    continue;
    }
  }

  const live = extractMacros(cached);
  const kcalOk = approxEq(live.kcal, entry.density_kcal_per_100g, 2);
  const proteinOk = approxEq(live.protein, entry.protein_per_100g, 0.5);
  const fatOk = approxEq(live.fat, entry.fat_per_100g, 0.5);
  const carbsOk = approxEq(live.carbs, entry.carbs_per_100g, 0.5);

  if (kcalOk && proteinOk && fatOk && carbsOk) {
    ok++;
    const tag = verifiedVia === 'search::' ? 'OK(search)' : 'OK';
    console.log(`${tag.padEnd(10)} ${k.padEnd(26)} fdcId=${fdcId} — ${cached.description} [${cached.dataType}] → ${live.kcal} ккал / Б${live.protein} / Ж${live.fat} / У${live.carbs}`);
  } else {
    mismatch++;
    const detail = [];
    if (!kcalOk) detail.push(`kcal: база=${entry.density_kcal_per_100g} → USDA=${live.kcal}`);
    if (!proteinOk) detail.push(`Б: база=${entry.protein_per_100g} → USDA=${live.protein}`);
    if (!fatOk) detail.push(`Ж: база=${entry.fat_per_100g} → USDA=${live.fat}`);
    if (!carbsOk) detail.push(`У: база=${entry.carbs_per_100g} → USDA=${live.carbs}`);
    mismatches.push({ key: k, fdcId, detail });
    console.log(`РАСХОЖДЕНИЕ ${k.padEnd(26)} fdcId=${fdcId} — ${detail.join(' | ')}`);
  }
}

console.log(`\n=== СВОДКА ===`);
console.log(`Всего продуктов:        ${keys.length}`);
console.log(`Совпадает с USDA:       ${ok}`);
console.log(`Расхождений:            ${mismatch}`);
console.log(`Ручных правок (без кэша): ${manualFix}`);
console.log(`Без fdcId:              ${noCache}`);
console.log(`\nПокрытие верификации: ${ok + mismatch} из ${keys.length} проверены против сырых ответов USDA (${Math.round((ok + mismatch) / keys.length * 100)}%).`);
if (mismatches.length) {
  console.log(`\n⚠ Расхождения (возможно, ручные правки значений — перепроверить):`);
  for (const m of mismatches) console.log(`  - ${m.key} (fdcId=${m.fdcId}): ${m.detail.join(', ')}`);
}
if (manualFix > 0) {
  console.log(`\nℹ ${manualFix} записей добавлены/исправлены вручную (banana, buckwheat_cooked, egg и т.д.) — у них есть fdcId из USDA, но в кэше нет исходного ответа, потому что генератор их не запрашивал. Их можно сверить открыв ссылку https://fdc.nal.usda.gov/fdc-app.html#/food-details/{fdcId} в браузере.`);
}
