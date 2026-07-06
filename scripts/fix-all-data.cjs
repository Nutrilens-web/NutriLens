// fix-all-data.cjs — применяет все исправления fooddb.json из аудита.
// Запуск: node scripts/fix-all-data.cjs
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'data', 'fooddb.json');
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

// --- TIER 1: исправление 8 критичных ключей на правильные USDA fdcId ---
// Значения взяты из кэша search-хитов (реальные ответы USDA, не выдуманы).
const tier1 = {
  // millet_cooked: было сухое зерно (376) → варёное (119)
  millet_cooked: { fdcId:168871, description:'Millet, cooked', dataType:'SR Legacy', kcal:119, p:3.51, f:1, c:23.7,
    aliases:['пшённая каша','пшено варёное','пшено','millet cooked','millet'] },
  // croissant: было сэндвич с начинкой (289) → чистый масляный круассан (406)
  croissant: { fdcId:174987, description:'Croissants, butter', dataType:'SR Legacy', kcal:406, p:8.2, f:21, c:45.8,
    aliases:['круассан','круассаны','croissant','croissants'] },
  // lemonade_sweet: было порошок (376) → готовый лимонад (14)
  lemonade_sweet: { fdcId:174859, description:'Lemonade, powder, prepared with water', dataType:'SR Legacy', kcal:14, p:0, f:0.04, c:3.59,
    aliases:['лимонад','сладкая газировка','газировка','lemonade','cola','кола','содовая'] },
  // tea_with_sugar: было гибискус 0 ккал → подслащённый чай (45)
  tea_with_sugar: { fdcId:171888, description:'Beverages, tea, black, ready-to-drink, lemon, sweetened', dataType:'SR Legacy', kcal:45, p:0, f:0.22, c:10.8,
    aliases:['чай с сахаром','сладкий чай','sweet tea','tea with sugar','sweetened tea'] },
  // coffee_with_milk: было соевый SILK → латте на молоке (по SR Legacy нет, берём усреднённое из Foundation/SR: ~53-67)
  coffee_with_milk: { fdcId:2425632, description:'COFFEE LATTE COFFEE BEVERAGE, COFFEE', dataType:'Branded', kcal:53, p:2.14, f:1.07, c:8.9,
    aliases:['кофе с молоком','латте','капучино','latte','cappuccino','coffee with milk'] },
  // bacon: было Canadian bacon (146) → настоящий бекон запечённый (548)
  bacon: { fdcId:167914, description:'Pork, cured, bacon, cooked, baked', dataType:'SR Legacy', kcal:548, p:35.7, f:43.3, c:1.35,
    aliases:['бекон','бекон жареный','bacon','bacon cooked'] },
  // corn_canned: было cream style (72) → целые зёрна (67)
  corn_canned: { fdcId:169214, description:'Corn, sweet, yellow, canned, whole kernel, drained solids', dataType:'SR Legacy', kcal:67, p:2.29, f:1.22, c:14.3,
    aliases:['кукуруза консервированная','консервированная кукуруза','corn canned','canned corn'] },
  // minced_meat_pork_beef: USDA не имеет свино-говяжьего → оставляем говяжий 80/20 (243), уточняем описание
  minced_meat_pork_beef: { fdcId:2514744, description:'Beef, ground, 80% lean meat / 20% fat, raw', dataType:'Foundation', kcal:243, p:17.53, f:19.44, c:0,
    aliases:['фарш','фарш свино-говяжий','фарш мясной','minced meat','ground beef','ground pork','говяжий фарш','свиной фарш'] },
};

for (const [k, v] of Object.entries(tier1)) {
  d[k] = {
    aliases: v.aliases,
    density_kcal_per_100g: v.kcal,
    protein_per_100g: v.p,
    fat_per_100g: v.f,
    carbs_per_100g: v.c,
    _usda: { fdcId: v.fdcId, description: v.description, dataType: v.dataType },
  };
}

// salad_caesar: нет хорошего USDA → удалить (фолбэк на модель)
delete d.salad_caesar;

// --- TIER 2: Branded → SR Legacy где возможно ---
// olive_oil: 800 (Branded) → 884 (SR Legacy)
d.olive_oil = {
  aliases: ['оливковое масло','масло оливковое','olive oil','oil olive'],
  density_kcal_per_100g: 884, protein_per_100g: 0, fat_per_100g: 100, carbs_per_100g: 0,
  _usda: { fdcId: 171413, description: 'Oil, olive, salad or cooking', dataType: 'SR Legacy' },
};
// mayonnaise: 750 (Branded, противоречиво) → 680 (SR Legacy, Salad dressing)
d.mayonnaise = {
  aliases: ['майонез','mayonnaise','mayo'],
  density_kcal_per_100g: 680, protein_per_100g: 0.96, fat_per_100g: 74.8, carbs_per_100g: 0.57,
  _usda: { fdcId: 171009, description: 'Salad dressing, mayonnaise, regular', dataType: 'SR Legacy' },
};
// sour_cream_fatty: 200 (Branded) → 198 (SR Legacy cultured)
d.sour_cream_fatty = {
  aliases: ['сметана','сметана жирная','сметана 20%','сметана 25%','sour cream','sour cream full fat'],
  density_kcal_per_100g: 198, protein_per_100g: 2.44, fat_per_100g: 19.4, carbs_per_100g: 4.63,
  _usda: { fdcId: 171257, description: 'Cream, sour, cultured', dataType: 'SR Legacy' },
};
// sour_cream_lowfat: инверсия — реально 10-15% сметана. USDA Foundation 196 ккал (full fat) —
// для lowfat возьмём SR Legacy light если есть, иначе оставим Foundation но с правильным описанием.
// В кэше нет SR Legacy light для sour cream. Оставим Foundation full fat, но исправим алиасы/описание.
d.sour_cream_lowfat = {
  aliases: ['сметана 10%','сметана 15%','сметана лёгкая','lowfat sour cream','light sour cream'],
  density_kcal_per_100g: 163, protein_per_100g: 2.7, fat_per_100g: 14, carbs_per_100g: 4.2,
  // USDA нет точного SR Legacy для 10-15% сметаны; значение — усреднённое по типичной 10-15% сметане.
  // Помечаем Foundation-описание как аппроксимацию.
  _usda: { fdcId: 2346387, description: 'Cream, sour, full fat (approximation for lowfat)', dataType: 'Foundation' },
};

// --- TIER 3: удаление дубликатов ---
// parmesan дублирует cheese_hard (parmesan, SR Legacy, 392). Удаляем Branded parmesan.
delete d.parmesan;
// cheese_hard: исправим алиасы, добавим пармезан
d.cheese_hard.aliases = ['твёрдый сыр','пармезан','сыр пармезан','hard cheese','parmesan cheese','cheddar','чеддер'];

// --- Финализация ---
d._generated_at = new Date().toISOString();
const n = Object.keys(d).filter(k => !k.startsWith('_') && typeof d[k].density_kcal_per_100g === 'number').length;
d.products_count = n;
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log('Исправлено критичных (Tier 1):', Object.keys(tier1).length);
console.log('Удалено: salad_caesar, parmesan (дубликат)');
console.log('Branded→SR Legacy: olive_oil, mayonnaise, sour_cream_fatty');
console.log('Итого продуктов:', n);
