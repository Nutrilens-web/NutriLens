import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/Dashboard.tsx'), 'utf-8');

const targetStr = `<div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 pr-2"><h3 className="font-medium text-sm text-gray-900 truncate">{meal.name}</h3>{meal.confidence_score && meal.confidence_score < 7 && (<button onClick={(e) => { e.stopPropagation(); setWarningMeal(meal); }} className="shrink-0 bg-yellow-100 text-yellow-600 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider uppercase flex items-center gap-1" title="ИИ не уверен в точности"><AlertTriangle className="w-2.5 h-2.5"/> AI</button>)}</div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">{meal.time}</span>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">{meal.calories} ккал</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Б: {meal.protein}г • Ж: {meal.fat}г • У: {meal.carbs}г
                  </p>
                </div>

                <div className="flex flex-col gap-1 pr-1">`;

const replacementStr = `<div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <h3 className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight flex-1">{meal.name}</h3>
                      {meal.confidence_score && meal.confidence_score < 7 && (
                         <button onClick={(e) => { e.stopPropagation(); setWarningMeal(meal); }} className="shrink-0 bg-yellow-100 text-yellow-600 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5" title="ИИ не уверен в точности"><AlertTriangle className="w-2.5 h-2.5"/> AI</button>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5 shrink-0">{meal.time}</span>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium mt-1">{meal.calories} ккал</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Б: {meal.protein}г • Ж: {meal.fat}г • У: {meal.carbs}г
                  </p>
                </div>

                <div className="flex flex-col gap-1 shrink-0">`;

content = content.replace(targetStr, replacementStr);
content = content.replace('className="w-12 h-12 rounded-[10px] object-cover bg-gray-100"', 'className="w-12 h-12 rounded-[10px] object-cover bg-gray-100 shrink-0"');
content = content.replace('className="w-12 h-12 rounded-[10px] object-cover bg-gray-100"', 'className="w-12 h-12 rounded-[10px] object-cover bg-gray-100 shrink-0"');
content = content.replace('className="w-12 h-12 rounded-[10px] bg-gray-100 flex items-center justify-center text-base"', 'className="w-12 h-12 rounded-[10px] bg-gray-100 flex items-center justify-center text-base shrink-0"');

// Fix Defensive CSS pb-24
content = content.replace(/<div className="flex-1 overflow-y-auto px-4 pt-4 hide-scrollbar">/g, '<div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 hide-scrollbar">');

fs.writeFileSync(path.resolve('src/screens/Dashboard.tsx'), content);
console.log('Done');
