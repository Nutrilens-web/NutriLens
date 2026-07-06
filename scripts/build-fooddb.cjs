#!/usr/bin/env node
/**
 * build-fooddb.cjs — генерирует src/data/fooddb.json из USDA FoodData Central.
 *
 * Запуск:
 *   1) Положите USDA_API_KEY в .env.local  (USDA_API_KEY="...")
 *   2) node scripts/build-fooddb.cjs
 *
 * Что делает (двухшаговый запрос — это особенность USDA):
 *   1) /foods/search?query=...  — находит fdcId лучшего совпадения по dataType
 *      (Foundation, Survey FNDDS, SR Legacy; без скобок в dataType — они ломают
 *       парсинг на стороне nginx USDA и дают HTTP 400).
 *   2) /food/{fdcId}            — тянет ПОЛНУЮ нутриентную разбивку. Search-эндпоинт
 *      отдаёт лишь сокращённый набор нутриентов (макросов там часто нет), поэтому
 *      полный объект нужен обязательно.
 *
 * Нутриенты USDA идентифицируются по nutrient.number (не по id и не по
 * nutrientNumber): 208=Energy(kcal), 203=Protein, 204=Total lipid, 205=Carbs.
 * Значения amount уже на 100 г для Foundation/SR Legacy/Survey.
 *
 * Кеш в scripts/.usda-cache.json (поисковые запросы + полные объекты по fdcId),
 * чтобы при повторных прогонах не долбить API. Ключ USDA НЕ попадает в
 * бандл/репозиторий: читается только локально из .env.local (.env* в .gitignore).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env.local');
const CACHE_PATH = path.join(__dirname, '.usda-cache.json');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'fooddb.json');
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA nutrient.number коды макронутриентов (НЕ id, а именно number-строка).
// Energy в SR Legacy/Survey приходит под кодом 208, но в Foundation часто
// отсутствует — там энергия под альтернативными кодами Atwater: 957 (General)
// или 958 (Specific). Порядок в массиве = приоритет (208 точнее для справочника).
const KCAL_CODES = ['208', '957', '958'];
const NUTRIENT_CODES = { protein: '203', fat: '204', carbs: '205' };
// Приоритет типов данных: чистые справочные выше брендовых.
const TYPE_ORDER = { Foundation: 0, 'Survey (FNDDS)': 1, 'SR Legacy': 2, Branded: 3 };

function loadApiKey() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Не найден .env.local. Создайте его со строкой USDA_API_KEY="..."');
    process.exit(1);
  }
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const m = text.match(/^USDA_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) {
    console.error('В .env.local нет USDA_API_KEY. Добавьте USDA_API_KEY="..."');
    process.exit(1);
  }
  return m[1].trim();
}

function getJson(urlStr, { retries = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      https.get(urlStr, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode === 429 || res.statusCode >= 500) {
            if (n < retries) {
              const wait = 1500 * (n + 1);
              console.warn(`  HTTP ${res.statusCode}, retry через ${wait}мс...`);
              setTimeout(() => attempt(n + 1), wait);
              return;
            }
            reject(new Error(`HTTP ${res.statusCode} after ${n} retries`));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 160)}`));
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('bad JSON: ' + e.message)); }
        });
      }).on('error', (e) => {
        if (n < retries) setTimeout(() => attempt(n + 1), 1000 * (n + 1));
        else reject(e);
      });
    };
    attempt(0);
  });
}

// Превращает результаты поиска в ранжированный список кандидатов (лучшие первыми).
// Жёсткое правило: описание ОБЯЗАНО содержать главное существительное запроса
// (первое осмысленное слово длиннее 2 символов, с нормализацией множественного
// числа). Без этого кандидат просто отбрасывается. Раньше короткие запросы
// («tomato», «grapes», «orange») случайно совпадали с неродственными записями
// высокого dataType — томат выбирал «Onions, red», масла — «Oil, coconut»,
// апельсин — «Orange peel». Теперь родственное слово обязано присутствовать.
function rankSearchHits(foods, query) {
  if (!foods || !foods.length) return [];
  const q = query.toLowerCase();
  const qwords = q.split(/\s+/).filter(Boolean);
  const wantCooked = q.includes('cooked') || q.includes('boiled') || q.includes('mashed') || q.includes('roasted');
  const wantRaw = q.includes('raw');

  // Главное существительное запроса: первое слово > 2 символов, не стоп-слово.
  const STOP = new Set(['raw', 'cooked', 'boiled', 'roasted', 'plain', 'whole', 'fluid', 'meat', 'yellow', 'green', 'red', 'white', 'dark', 'light', 'sweet', 'fresh', 'commercial', 'home', 'regular', 'enriched', 'salted', 'unsalted', 'skin', 'peeled', 'canned', 'oil', 'cheese', 'milk', 'and', 'or', 'with', 'raw', 'florida', 'california']);
  let noun = qwords.find((w) => w.length > 2 && !STOP.has(w)) || '';
  // Нормализация множественного числа. Раньше наивный replace(/s$/,'') ломал
  // слова на -us/-is/-as (couscous→couscou, hummus→hummu, nuts→nut), и
  // token-матч по «искалеченной» форме проваливался даже для идеальных хитов.
  // Теперь обрезаем 's' только для настоящих множественных: после гласной/согласной,
  // но НЕ после u/i/a (где -s часть корня). ies→y как обычно (berries→berry).
  const nounSingular = singularize(noun);

  return foods
    .filter((f) => {
      const desc = String(f.description || '').toLowerCase();
      if (!nounSingular) return true;
      // Матчим и по единственному, и по исходному (множественному) — USDA
      // часто пишет «Apples, ...», а noun после singularize = «apple».
      const tokenRe = new RegExp(`(^|[^a-z])(${escapeRe(nounSingular)}|${escapeRe(noun)})([^a-z]|$)`);
      if (!tokenRe.test(desc)) return false;
      return true;
    })
    .map((f) => {
      const typeRank = TYPE_ORDER[f.dataType] ?? 9;
      const desc = String(f.description || '').toLowerCase();
      const hits = qwords.filter((w) => w.length > 2 && desc.includes(w)).length;
      // штрафы за несоответствие формы (raw vs cooked) — большие, чтобы перебить dataType
      let formPenalty = 0;
      if (wantCooked && /(^|\W)raw(\W|$)/.test(desc)) formPenalty -= 1000;
      if (wantRaw && /(^|\W)cooked(\W|$)/.test(desc)) formPenalty -= 1000;
      // чёрный список несущественных частей продукта / неродственных хитов:
      // peel/rind (цедра вместо плода), seasoning/marinade (приправа вместо блюда),
      // oat milk / soy milk (напиток вместо каши), rendered fat (вытопленный жир),
      // flour (мука вместо крупы), juice/nugget/dressing/seitan/meatless и т.п.
      const badSignals = ['peel', 'rind', 'seasoning', 'marinade', 'oat milk', 'soy milk', 'rendered fat', 'flour', 'nugget', 'dressing', 'seitan', 'meatless', 'spice'];
      const badPenalty = badSignals.filter((b) => desc.includes(b) && !q.includes(b)).length * -500;
      // предпочтение короткому описанию (более «каноничная» запись)
      const lenBonus = desc.length < 55 ? 8 : 0;
      const score = (4 - typeRank) * 100 + hits * 10 + formPenalty + badPenalty + lenBonus;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ fdcId: x.f.fdcId, description: x.f.description, dataType: x.f.dataType, score: x.score }));
}

// Из полного объекта /food/{fdcId} достаёт макросы по nutrient.number.
function extractMacros(food) {
  const out = {};
  for (const n of food.foodNutrients || []) {
    const num = n.nutrient?.number ?? n.nutrientNumber;
    const val = Number(n.amount ?? n.value);
    if (!Number.isFinite(val)) continue;
    // Энергия: берём первый доступный код по приоритету (208 > 957 > 958).
    if (KCAL_CODES.includes(num) && out.kcal === undefined) out.kcal = val;
    else if (num === NUTRIENT_CODES.protein) out.protein = val;
    else if (num === NUTRIENT_CODES.fat) out.fat = val;
    else if (num === NUTRIENT_CODES.carbs) out.carbs = val;
  }
  return out;
}

function round1(v) { return Math.round(Number(v) * 10) / 10; }

// Экранирование спецсимволов для RegExp (для noun-матча по границе слова).
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Нормализация множественного числа для lookup. Наивный replace(/s$/,'') ломал
// слова на -us/-is/-as (couscous→couscou, hummus→hummu), что убивало token-матч.
// Здесь обрезаем 's' только для настоящих множественных: НЕ после u/i/a/ss/us/is.
function singularize(w) {
  if (!w) return w;
  if (/ies$/.test(w) && w.length > 4) return w.replace(/ies$/, 'y');
  if (/ss$/.test(w)) return w; // kiss, glass, bass — не множественное
  if (/[ui]s$/.test(w)) return w; // couscous, hummus, peas→pea ок ниже, но -us/-is оставляем
  if (/as$/.test(w) && w.length > 4) return w; //avoid 'gas'/'illias' edge cases
  if (/s$/.test(w) && w.length > 3) return w.replace(/s$/, '');
  return w;
}

// Нормализация множественного числа для token-матча. Наивный replace(/s$/,'')
// ломал слова на -us/-is/-as (couscous→couscou, hummus→hummu, nuts→nut) —
// для них -s часть корня, а не показатель множественного. Поэтому обрезаем
// 's' только когда перед ней НЕ u/i/a/ss. ies→y (berries→berry).
function singularize(w) {
  if (!w) return w;
  if (/ies$/.test(w) && w.length > 4) return w.replace(/ies$/, 'y');
  if (/s$/.test(w) && !/(us|is|as|ss)$/i.test(w)) return w.slice(0, -1);
  return w;
}

// --- список продуктов (term — поисковый запрос USDA; key — ключ в JSON) ----
const PRODUCTS = [
  // крупы/гарниры варёные
  { term: 'rice white cooked long grain regular', key: 'white_rice_cooked', aliases: ['рис варёный','рис','белый рис','вареный рис','рисовая каша','white rice','cooked rice','rice'] },
  { term: 'buckwheat groats cooked roasted', key: 'buckwheat_cooked', aliases: ['гречка','гречневая каша','гречневая крупа','гречка варёная','buckwheat','kasha','grechka'] },
  { term: 'oats cooked plain', key: 'oatmeal_cooked', aliases: ['овсянка','овсяная каша','овсянка на воде','овсянка на молоке','геркулес','oatmeal','porridge','oats'], fdcId: 173905 },
  { term: 'pasta cooked plain', key: 'pasta_cooked', aliases: ['макароны','паста','спагетти варёные','макароны варёные','pasta','spaghetti','macaroni','noodles'] },
  { term: 'potato boiled flesh and skin', key: 'potato_boiled', aliases: ['картофель варёный','картошка варёная','вареная картошка','отварной картофель','boiled potato','potato'] },
  { term: 'potato mashed home prepared', key: 'potato_mashed', aliases: ['картофельное пюре','пюре картофельное','пюре','mashed potato','mashed potatoes'] },
  { term: 'potato french fried', key: 'french_fries', aliases: ['картофель фри','фри','жареная картошка','жареный картофель','fries','chips'] },
  { term: 'millet cooked', key: 'millet_cooked', aliases: ['пшено','пшённая каша','пшенная каша','millet','millet porridge'] },
  { term: 'quinoa cooked', key: 'quinoa_cooked', aliases: ['киноа','кинва','quinoa'] },
  { term: 'couscous cooked', key: 'couscous_cooked', aliases: ['кускус','кус-кус','couscous'] },
  { term: 'lentils cooked', key: 'lentils_cooked', aliases: ['чечевица','чечевица варёная','lentils','lentil'] },
  { term: 'beans kidney cooked', key: 'beans_cooked', aliases: ['фасоль варёная','фасоль','красная фасоль','beans','kidney beans'] },
  { term: 'chickpeas cooked', key: 'chickpeas_cooked', aliases: ['нут','нут варёный','chickpeas','garbanzo'] },
  { term: 'hummus commercial', key: 'hummus', aliases: ['хумус','hummus'] },

  // мясо/птица
  { term: 'chicken breast meat cooked roasted', key: 'chicken_breast', aliases: ['куриная грудка','грудка куриная','куриная грудка варёная','куриная грудка жареная','chicken breast','grilled chicken'] },
  { term: 'chicken thigh meat cooked', key: 'chicken_thigh', aliases: ['куриное бедро','бедро куриное','куриный окорочок','chicken thigh','chicken leg'] },
  { term: 'chicken wing cooked', key: 'chicken_wing', aliases: ['куриное крыло','крылья куриные','крылышки','chicken wing','wings'] },
  { term: 'beef ground raw', key: 'minced_meat_pork_beef', aliases: ['фарш','фарш мясной','говяжий фарш','свино-говяжий фарш','minced meat','ground beef','ground meat'] },
  { term: 'beef cooked boiled', key: 'beef_steamboat', aliases: ['говядина','отварная говядина','говядина варёная','beef','boiled beef'] },
  { term: 'beef steak cooked', key: 'beef_steak', aliases: ['стейк говяжий','жареная говядина','steak','beef steak'] },
  { term: 'pork loin cooked', key: 'pork_lean', aliases: ['свинина','нежирная свинина','свиная вырезка','pork','pork loin'] },
  { term: 'pork belly raw', key: 'pork_fat', aliases: ['жирная свинина','свиная грудинка','грудинка','fatty pork','pork belly'], fdcId: 167812 },
  { term: 'turkey breast meat cooked', key: 'turkey_breast', aliases: ['индейка','грудка индейки','филе индейки','turkey','turkey breast'] },
  { term: 'duck meat and skin cooked', key: 'duck', aliases: ['утка','утиная грудка','duck','duck breast'] },
  { term: 'sausage cooked', key: 'sausage', aliases: ['сосиска','сосиски','колбаса варёная','колбаса','sausage','hot dog'] },
  { term: 'bacon cooked', key: 'bacon', aliases: ['бекон','bacon'] },
  { term: 'ham cooked', key: 'ham', aliases: ['ветчина','ham'] },
  { term: 'meatball or cutlet', key: 'cutlet_meat', aliases: ['котлета','котлета мясная','отбивная','cutlet','meatball'], fdcId: 169447 },

  // рыба/морепродукты
  { term: 'salmon cooked', key: 'salmon', aliases: ['лосось','сёмга','семга','горбуша','salmon'] },
  { term: 'tuna canned water', key: 'tuna_canned', aliases: ['тунец консервированный','тунец','консервированный тунец','tuna','canned tuna'] },
  { term: 'cod cooked', key: 'cod', aliases: ['треска','минтай','белая рыба','cod','white fish','pollock'] },
  { term: 'shrimp cooked', key: 'shrimp', aliases: ['креветки','shrimp','prawns'] },
  { term: 'squid cooked', key: 'squid', aliases: ['кальмар','кальмары','squid','calamari'] },
  { term: 'mussel cooked', key: 'mussels', aliases: ['мидии','mussels'] },
  { term: 'herring pickled', key: 'herring', aliases: ['сельдь','селёдка','сельдь солёная','herring'] },
  { term: 'sardine canned oil', key: 'sardines_canned', aliases: ['шпроты','сардины','сардина консервированная','sardines','sprats'] },

  // молочка
  { term: 'milk whole fluid', key: 'milk_whole', aliases: ['молоко','цельное молоко','milk','whole milk'] },
  { term: 'kefir', key: 'kefir', aliases: ['кефир','ряженка','kefir','buttermilk'] },
  { term: 'yogurt plain whole milk', key: 'yogurt_plain', aliases: ['йогурт натуральный','йогурт','греческий йогурт','yogurt','greek yogurt'] },
  { term: 'cottage cheese low fat 2', key: 'cottage_cheese_lowfat', aliases: ['творог','творог обезжиренный','творог 5%','cottage cheese','curd','tvorog'] },
  { term: 'cottage cheese full fat', key: 'cottage_cheese_fatty', aliases: ['жирный творог','творог 9%','творог 18%','fatty cottage cheese'] },
  { term: 'sour cream light', key: 'sour_cream_lowfat', aliases: ['сметана 15%','сметана 10%','нежирная сметана','sour cream'] },
  { term: 'sour cream', key: 'sour_cream_fatty', aliases: ['сметана','сметана 20%','жирная сметана'] },
  { term: 'cheese hard', key: 'cheese_hard', aliases: ['сыр','твёрдый сыр','российский сыр','голландский сыр','cheese','hard cheese','cheddar'] },
  { term: 'mozzarella cheese', key: 'mozzarella', aliases: ['моцарелла','mozzarella'] },
  { term: 'cream cheese', key: 'cream_cheese', aliases: ['сливочный сыр','творожный сыр','маскарпоне','cream cheese','mascarpone'] },
  { term: 'parmesan cheese', key: 'parmesan', aliases: ['пармезан','parmesan'] },
  { term: 'feta cheese', key: 'feta', aliases: ['фета','брынза','feta','feta cheese'] },
  { term: 'butter salted', key: 'butter', aliases: ['масло сливочное','сливочное масло','butter'] },
  { term: 'cream fluid 20', key: 'cream_20', aliases: ['сливки','сливки 20%','сливки 10%','cream'] },

  // хлеб/выпечка
  { term: 'bread white commercial', key: 'bread_white', aliases: ['белый хлеб','хлеб','батон','white bread','bread'] },
  { term: 'bread rye', key: 'bread_black', aliases: ['чёрный хлеб','ржаной хлеб','бородинский','бородинский хлеб','black bread','rye bread'] },
  { term: 'bread wheat toasted', key: 'bread_toast', aliases: ['тост','тостовый хлеб','toast','toast bread'] },
  { term: 'croissant butter', key: 'croissant', aliases: ['круассан','croissant'] },
  { term: 'bread french or vienna', key: 'baguette', aliases: ['багет','baguette','french bread'] },
  { term: 'pancakes plain', key: 'pancakes', aliases: ['блины','блин','блинчики','pancakes','pancake','crepes','crepe'] },
  { term: 'cheese pancake syrniki', key: 'syrniki', aliases: ['сырники','творожники','syrniki','cottage cheese pancakes'] },
  { term: 'omelet or omelette', key: 'omelette', aliases: ['омлет','яичница','omelette','omelet','fried eggs'] },
  { term: 'pizza cheese regular', key: 'pizza_slice', aliases: ['пицца','кусочек пиццы','pizza','pizza slice'] },
  { term: 'hamburger single patty', key: 'burger', aliases: ['бургер','гамбургер','чебурек','burger','hamburger'] },
  { term: 'gyro sandwich pita beef', key: 'shawarma', aliases: ['шаурма','шаверма','донер','shawarma','doner','kebab wrap','gyro'] },
  { term: 'dumpling meat filled', key: 'dumplings_meat', aliases: ['пельмени','вареники','dumplings','pelmeni','vareniki'] },

  // овощи
  { term: 'cucumber raw', key: 'cucumber', aliases: ['огурец','огурцы','cucumber'] },
  { term: 'tomato red raw', key: 'tomato', aliases: ['помидор','томаты','tomato'], fdcId: 170457 },
  { term: 'lettuce green leaf raw', key: 'lettuce', aliases: ['салат','салатные листья','листовой салат','lettuce','salad leaves'] },
  { term: 'carrot raw', key: 'carrot', aliases: ['морковь','морковка','carrot'] },
  { term: 'cabbage raw', key: 'cabbage', aliases: ['капуста','белокочанная капуста','cabbage'] },
  { term: 'broccoli raw', key: 'broccoli', aliases: ['брокколи','broccoli'] },
  { term: 'cauliflower raw', key: 'cauliflower', aliases: ['цветная капуста','cauliflower'] },
  { term: 'zucchini raw', key: 'zucchini', aliases: ['кабачок','цуккини','кабачки','zucchini','courgette'] },
  { term: 'eggplant raw', key: 'eggplant', aliases: ['баклажан','баклажаны','eggplant','aubergine'] },
  { term: 'peppers sweet green raw', key: 'bell_pepper', aliases: ['болгарский перец','сладкий перец','перец','bell pepper','capsicum'] },
  { term: 'onion raw', key: 'onion', aliases: ['лук','лук репчатый','onion','onions'] },
  { term: 'mushrooms white button raw', key: 'mushrooms_champignon', aliases: ['грибы','шампиньоны','шампиньон','mushrooms','champignons'] },
  { term: 'corn yellow canned', key: 'corn_canned', aliases: ['кукуруза','консервированная кукуруза','кукуруза консервированная','corn','canned corn'] },
  { term: 'avocado raw', key: 'avocado', aliases: ['авокадо','avocado'] },
  { term: 'olives black or green', key: 'olives', aliases: ['оливки','маслины','olives'] },
  { term: 'beets cooked boiled', key: 'beetroot_boiled', aliases: ['свёкла','свекла варёная','beetroot','beets'] },
  { term: 'salad vegetable tossed', key: 'salad_green_mixed', aliases: ['овощной салат','салат из овощей','green salad','vegetable salad'] },
  { term: 'salad caesar', key: 'salad_caesar', aliases: ['цезарь','салат цезарь','caesar salad'] },
  { term: 'salad olivier', key: 'salad_olivier', aliases: ['оливье','салат оливье','мясной салат','olivier salad'] },

  // фрукты
  { term: 'banana raw', key: 'banana', aliases: ['банан','бананы','banana'] },
  { term: 'apple raw with skin', key: 'apple', aliases: ['яблоко','яблоки','apple'] },
  { term: 'orange raw florida', key: 'orange', aliases: ['апельсин','апельсины','orange'], fdcId: 169918 },
  { term: 'grapes red or green', key: 'grapes', aliases: ['виноград','grapes','grape'], fdcId: 174683 },
  { term: 'strawberries raw', key: 'strawberry', aliases: ['клубника','земляника','strawberry','strawberries'] },
  { term: 'watermelon raw', key: 'watermelon', aliases: ['арбуз','watermelon'] },
  { term: 'pear raw', key: 'pear', aliases: ['груша','груши','pear'] },
  { term: 'lemon raw', key: 'lemon', aliases: ['лимон','lemon'] },

  // яйца
  { term: 'egg whole cooked hard', key: 'boiled_egg', aliases: ['варёное яйцо','яйцо варёное','вареное яйцо','яйцо','boiled egg','egg'] },

  // масла/соусы
  { term: 'olive oil', key: 'olive_oil', aliases: ['оливковое масло','масло оливковое','olive oil'] },
  { term: 'oil sunflower', key: 'sunflower_oil', aliases: ['подсолнечное масло','растительное масло','масло растительное','sunflower oil','vegetable oil'] },
  { term: 'mayonnaise', key: 'mayonnaise', aliases: ['майонез','mayonnaise','mayo'] },
  { term: 'ketchup', key: 'ketchup', aliases: ['кетчуп','томатный соус','ketchup','tomato sauce'] },
  { term: 'soy sauce', key: 'soy_sauce', aliases: ['соевый соус','soy sauce'] },

  // орехи/семена
  { term: 'nuts almonds', key: 'almonds', aliases: ['миндаль','almonds'] },
  { term: 'nuts walnuts english halves', key: 'walnuts', aliases: ['грецкие орехи','грецкий орех','walnuts','walnut'], fdcId: 170187 },
  { term: 'peanuts raw', key: 'peanuts', aliases: ['арахис','арахис жареный','peanuts','peanut'] },
  { term: 'peanut butter smooth', key: 'peanut_butter', aliases: ['арахисовая паста','арахисовое масло','peanut butter'] },
  { term: 'seeds sunflower kernels', key: 'sunflower_seeds', aliases: ['семечки','семена подсолнечника','sunflower seeds'] },

  // напитки
  { term: 'coffee brewed espresso', key: 'coffee_black', aliases: ['чёрный кофе','кофе','кофе без сахара','black coffee','coffee','espresso','американо'] },
  { term: 'coffee latte', key: 'coffee_with_milk', aliases: ['кофе с молоком','латте','капучино','кофе с сахаром','latte','cappuccino','coffee with milk'] },
  { term: 'tea black brewed', key: 'tea_black', aliases: ['чай','чёрный чай','зелёный чай','tea','black tea','green tea'] },
  { term: 'tea with sugar', key: 'tea_with_sugar', aliases: ['чай с сахаром','сладкий чай','sweet tea','tea with sugar'] },
  { term: 'orange juice raw florida', key: 'juice_orange', aliases: ['апельсиновый сок','сок','сок апельсиновый','orange juice','juice'], fdcId: 2003597 },
  { term: 'lemonade sweetened', key: 'lemonade_sweet', aliases: ['лимонад','сладкая газировка','кола','лимонад сладкий','lemonade','soda','cola'] },
  { term: 'beer regular', key: 'beer', aliases: ['пиво','beer'] },
  { term: 'wine red table', key: 'wine_red', aliases: ['красное вино','вино','белое вино','wine','red wine','white wine'] },

  // сладкое/прочее
  { term: 'chocolate dark', key: 'dark_chocolate', aliases: ['тёмный шоколад','горький шоколад','шоколад','dark chocolate','chocolate'] },
  { term: 'chocolate milk', key: 'milk_chocolate', aliases: ['молочный шоколад','milk chocolate'] },
  { term: 'cookies plain', key: 'cookies_plain', aliases: ['печенье','печенье песочное','cookies','biscuits'] },
  { term: 'honey', key: 'honey', aliases: ['мёд','мед','honey'] },
  { term: 'sugar granulated white', key: 'sugar_white', aliases: ['сахар','сахар белый','сахар-песок','sugar','white sugar'] },
  { term: 'ice cream vanilla', key: 'ice_cream_vanilla', aliases: ['мороженое','пломбир','сливочное мороженое','ice cream','vanilla ice cream'] },
  { term: 'cake sponge', key: 'cake_sponge', aliases: ['торт','бисквит','пирожное','cake','sponge cake','pastry'] },
];

async function searchFood(term, apiKey, cache) {
  const ck = 'search::' + term;
  if (cache[ck]) return cache[ck];
  // dataType БЕЗ скобок — скобки в "Survey (FNDDS)" ломают nginx USDA (HTTP 400).
  const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`
    + `&query=${encodeURIComponent(term)}`
    + `&dataType=Foundation,Survey%20FNDDS,SR%20Legacy,Branded`
    + `&pageSize=20&pageNumber=0`;
  const data = await getJson(url);
  const foods = data.foods || [];
  cache[ck] = foods;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  return foods;
}

async function getFoodDetail(fdcId, apiKey, cache) {
  const ck = 'food::' + fdcId;
  if (cache[ck]) return cache[ck];
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const data = await getJson(url);
  cache[ck] = data;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  return data;
}

async function main() {
  const apiKey = loadApiKey();
  console.log(`USDA key loaded (${apiKey.slice(0, 4)}...). Products: ${PRODUCTS.length}`);

  let cache = {};
  if (fs.existsSync(CACHE_PATH)) {
    try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
    catch { cache = {}; }
  }

  const result = {};
  let found = 0;
  let missed = 0;

  for (const p of PRODUCTS) {
    try {
      // Если задан проверенный fdcId — пропускаем search (эвристика выбора
      // несовершенна для продуктов с цветом-названием: orange→«Tomatoes, orange»,
      // grapes→grapefruit). fdcId задаётся вручную после сверки с USDA и даёт
      // детерминированно правильный продукт. См. комментарий в PRODUCTS.
      if (p.fdcId) {
        const detail = await getFoodDetail(p.fdcId, apiKey, cache);
        const macros = extractMacros(detail);
        if (macros.kcal == null || macros.protein == null || macros.fat == null || macros.carbs == null) {
          console.warn(`  ✗ ${p.key}: fdcId=${p.fdcId} макросы неполные ← ${detail.description}`);
          missed++;
          continue;
        }
        result[p.key] = {
          aliases: p.aliases,
          density_kcal_per_100g: Math.round(macros.kcal),
          protein_per_100g: round1(macros.protein),
          fat_per_100g: round1(macros.fat),
          carbs_per_100g: round1(macros.carbs),
          _usda: { fdcId: p.fdcId, description: detail.description, dataType: detail.dataType, fdcIdOverride: true },
        };
        found++;
        console.log(`  ✓ ${p.key}: ${Math.round(macros.kcal)} ккал, Б${round1(macros.protein)} Ж${round1(macros.fat)} У${round1(macros.carbs)} ← ${detail.description} [fdcId override]`);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      const foods = await searchFood(p.term, apiKey, cache);
      const hits = rankSearchHits(foods, p.term);
      if (!hits.length) {
        console.warn(`  ✗ ${p.key}: ничего не найдено (term="${p.term}")`);
        missed++;
        continue;
      }
      // Пробуем кандидатов по убыванию ранга: первый, у которого /food/{fdcId}
      // отдаёт полный набор макросов. Раньше брали только топ-1 и падали на 404
      // или «макросы неполные» — теперь спускаемся ниже по списку.
      let resolved = null;
      for (const hit of hits.slice(0, 5)) {
        let detail;
        try {
          detail = await getFoodDetail(hit.fdcId, apiKey, cache);
        } catch (e) {
          // 404/сетевая ошибка для этого fdcId — пробуем следующего кандидата
          continue;
        }
        const macros = extractMacros(detail);
        if (macros.kcal == null || macros.protein == null || macros.fat == null || macros.carbs == null) {
          continue;
        }
        resolved = { hit, macros, description: detail.description, dataType: detail.dataType };
        break;
      }
      if (!resolved) {
        console.warn(`  ✗ ${p.key}: ни один кандидат не дал полных макросов (term="${p.term}")`);
        missed++;
        continue;
      }
      const { hit, macros } = resolved;
      result[p.key] = {
        aliases: p.aliases,
        density_kcal_per_100g: Math.round(macros.kcal),
        protein_per_100g: round1(macros.protein),
        fat_per_100g: round1(macros.fat),
        carbs_per_100g: round1(macros.carbs),
        _usda: { fdcId: hit.fdcId, description: resolved.description, dataType: resolved.dataType },
      };
      found++;
      console.log(`  ✓ ${p.key}: ${Math.round(macros.kcal)} ккал, Б${round1(macros.protein)} Ж${round1(macros.fat)} У${round1(macros.carbs)} ← ${resolved.description}`);
      await new Promise((r) => setTimeout(r, 200)); // мягкий throttle
    } catch (e) {
      console.error(`  ✗ ${p.key}: ${e.message}`);
      missed++;
    }
  }

  const header = {
    _comment_format: 'Встроенный справочник КБЖУ продуктов/блюд (на 100 г съедобной части). Сгенерирован скриптом scripts/build-fooddb.cjs из USDA FoodData Central (типы Foundation/Survey FNDDS/SR Legacy). Ключ — английский snake_case термин (такой же, какой модель должна вернуть в поле db_key). aliases — включая русские названия, для устойчивого matching\'а при промахе модели. Итог = вес × плотность. Не найдено в базе → fallback на оценку модели. _usda содержит ссылку на первоисточник (fdcId/description/dataType).',
    generated_at: new Date().toISOString(),
    source: 'USDA FoodData Central (https://fdc.nal.usda.gov)',
    products_count: found,
  };
  const out = { ...header, ...result };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nГотово: найдено ${found}, пропущено ${missed}.`);
  console.log(`Записано: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
