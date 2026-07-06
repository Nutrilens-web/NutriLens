// verify-fooddb.cjs — сверка fooddb.json с живым USDA FoodData Central API.
//
// Для каждой записи берёт _usda.fdcId, запрашивает /food/{fdcId} и сравнивает:
//   - description (должен совпадать с тем, что записано в базе)
//   -dataType (должен совпадать)
//   -КБЖУ (вытаскивает из живого ответа по тем же кодам нутриентов, что и
//    генератор: 208/957/958 — энергия, 203 — белок, 204 — жиры, 205 — углеводы)
//
// Выводит построчный отчёт: OK / РАСХОЖДЕНИЕ / ОШИБКА_СЕТИ.
// В конце — сводка: сколько совпало, сколько расхождений, сколько не удалось
// проверить. Любое расхождение — повод перепроверить эту запись вручную.
//
// Запуск: node scripts/verify-fooddb.cjs
// Ключ USDA_API_KEY читается из .env.local (не попадает в репозиторий).

const fs = require('fs');
const path = require('path');

// Загружаем .env.local вручную (это не Vite-среда, dotenv не подключаем ради
// одной строки). Ищем USDA_API_KEY="...".
const envPath = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const keyMatch = envText.match(/USDA_API_KEY\s*=\s*["']?([^"'\s]+)["']?/);
if (!keyMatch) {
  console.error('USDA_API_KEY не найден в .env.local');
  process.exit(1);
}
const API_KEY = keyMatch[1];
const BASE = 'https://fooddata.central.usda.gov/fdc/v1';

// Коды нутриентов USDA (те же, что в build-fooddb.cjs).
// 208 — энергия kcal (SR Legacy / Branded), 957/958 — Atwater (Foundation).
const KCAL_CODES = ['208', '957', '958'];
const NUTRIENT_CODES = { protein: '203', fat: '204', carbs: '205' };

function extractMacros(food) {
  const nuts = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const byCode = {};
  for (const n of nuts) {
    const code = String(n.nutrient?.number ?? n.nutrientNumber ?? '');
    if (!code) continue;
    // Берём первое встретившееся значение для каждого кода.
    if (!(code in byCode)) byCode[code] = Number(n.amount) || 0;
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

function approxEq(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

async function verifyEntry(key, entry) {
  const fdcId = entry._usda?.fdcId;
  if (!fdcId) {
    return { key, status: 'NO_FDCID', detail: 'нет _usda.fdcId — невозможно проверить' };
  }
  const url = `${BASE}/food/${fdcId}?api_key=${API_KEY}`;
  let resp;
  try {
    resp = await fetch(url);
  } catch (e) {
    return { key, status: 'NET_ERROR', detail: String(e.message || e) };
  }
  if (!resp.ok) {
    return { key, status: 'HTTP_' + resp.status, detail: `fdcId=${fdcId}` };
  }
  const food = await resp.json();
  const live = extractMacros(food);
  const descMatch = (food.description || '').trim() === (entry._usda.description || '').trim();
  const typeMatch = (food.dataType || '').trim() === (entry._usda.dataType || '').trim();
  // Допуски: КБЖУ в USDA могут отличаться на единицы из-за округления/разных
  // подвыборок. Допускаем 2 ккал и 0.5 г на макронутриент.
  const kcalOk = approxEq(live.kcal, entry.density_kcal_per_100g, 2);
  const proteinOk = approxEq(live.protein, entry.protein_per_100g, 0.5);
  const fatOk = approxEq(live.fat, entry.fat_per_100g, 0.5);
  const carbsOk = approxEq(live.carbs, entry.carbs_per_100g, 0.5);
  const macrosOk = kcalOk && proteinOk && fatOk && carbsOk;

  if (descMatch && typeMatch && macrosOk) {
    return {
      key, status: 'OK', fdcId,
      detail: `${food.description} [${food.dataType}] — ${live.kcal} ккал / Б${live.protein} / Ж${live.fat} / У${live.carbs}`,
    };
  }
  const mismatches = [];
  if (!descMatch) mismatches.push(`desc: база="${entry._usda.description}" → USDA="${food.description}"`);
  if (!typeMatch) mismatches.push(`dataType: база=${entry._usda.dataType} → USDA=${food.dataType}`);
  if (!kcalOk) mismatches.push(`kcal: база=${entry.density_kcal_per_100g} → USDA=${live.kcal}`);
  if (!proteinOk) mismatches.push(`protein: база=${entry.protein_per_100g} → USDA=${live.protein}`);
  if (!fatOk) mismatches.push(`fat: база=${entry.fat_per_100g} → USDA=${live.fat}`);
  if (!carbsOk) mismatches.push(`carbs: база=${entry.carbs_per_100g} → USDA=${live.carbs}`);
  return { key, status: 'MISMATCH', fdcId, detail: mismatches.join(' | ') };
}

(async () => {
  const dbPath = path.join(__dirname, '..', 'src', 'data', 'fooddb.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const keys = Object.keys(db).filter(k => !k.startsWith('_') && typeof db[k].density_kcal_per_100g === 'number');
  console.log(`Проверяю ${keys.length} продуктов против USDA FoodData Central...\n`);

  let ok = 0, mismatch = 0, errors = 0;
  const mismatches = [];
  const errorList = [];

  for (const k of keys) {
    const r = await verifyEntry(k, db[k]);
    if (r.status === 'OK') {
      ok++;
      console.log(`OK      ${k.padEnd(24)} → ${r.detail}`);
    } else if (r.status === 'MISMATCH') {
      mismatch++;
      mismatches.push(r);
      console.log(`РАСХОЖД ${k.padEnd(24)} → ${r.detail}`);
    } else {
      errors++;
      errorList.push(r);
      console.log(`ОШИБКА  ${k.padEnd(24)} [${r.status}] → ${r.detail}`);
    }
  }

  console.log(`\n=== СВОДКА ===`);
  console.log(`Всего:     ${keys.length}`);
  console.log(`OK:        ${ok}`);
  console.log(`Расхожд.:  ${mismatch}`);
  console.log(`Ошибок:    ${errors}`);
  if (mismatches.length) {
    console.log(`\nПродукты с расхождениями (нужно перепроверить вручную):`);
    for (const m of mismatches) {
      console.log(`  - ${m.key} (fdcId=${m.fdcId}): ${m.detail}`);
    }
  }
})().catch(e => {
  console.error('Фатальная ошибка:', e);
  process.exit(1);
});
