import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/Assistant.tsx'), 'utf-8');

// Assistant grouped tools layout
const newLayout = `
        <div className="space-y-6">
          {/* Block 1 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Еда и Рецепты</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCurrentTool('chat')}
                className="bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col items-start justify-between gap-3 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-emerald-100/50 p-2.5 rounded-2xl text-emerald-600">
                  <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-gray-800 text-left">Чат с диетологом</span>
              </button>

              <button
                onClick={() => setCurrentTool('ideas')}
                className="bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col items-start justify-between gap-3 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-yellow-100/50 p-2.5 rounded-2xl text-yellow-600">
                  <Lightbulb className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-gray-800 text-left">Идеи и Рецепты</span>
              </button>

              <button
                onClick={() => setCurrentTool('fridge')}
                className="col-span-2 bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-row items-center gap-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-blue-100/50 p-2.5 rounded-2xl text-blue-500 shrink-0">
                  <ChefHat className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-semibold text-gray-800">Разбор холодильника</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">Фото продуктов -> Рецепт</span>
                </div>
              </button>
            </div>
          </div>

          {/* Block 2 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Анализ и трекинг</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCurrentTool('menu')}
                className="bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col items-start justify-between gap-3 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-purple-100/50 p-2.5 rounded-2xl text-purple-600">
                  <Utensils className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-gray-800 text-left">Оценка ресторана</span>
              </button>

              <button
                onClick={() => setCurrentTool('habits')}
                className="bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col items-start justify-between gap-3 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-rose-100/50 p-2.5 rounded-2xl text-rose-500">
                  <Activity className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-gray-800 text-left">Разбор привычек</span>
              </button>

              <button
                onClick={() => setCurrentTool('water')}
                className="col-span-2 bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-row items-center gap-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-sky-100/50 p-2.5 rounded-2xl text-sky-500 shrink-0">
                  <Droplets className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-semibold text-gray-800">Водный баланс</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">Трекер и нормативы жидкости</span>
                </div>
              </button>
            </div>
          </div>

          {/* Block 3 */}
          <div>
             <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Организация</h3>
             <button
                onClick={() => setCurrentTool('grocery')}
                className="w-full bg-white p-4 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-row items-center gap-4 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all border border-transparent hover:border-emerald-100"
              >
                <div className="bg-indigo-100/50 p-2.5 rounded-2xl text-indigo-500 shrink-0">
                  <ShoppingCart className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="text-left">
                   <span className="block text-sm font-semibold text-gray-800">Список покупок</span>
                   <span className="block text-[10px] text-gray-400 mt-0.5">Генерация меню и корзины на неделю</span>
                </div>
              </button>
          </div>
        </div>
`;

content = content.replace(/<div className="grid grid-cols-2 gap-3">[\s\S]*?<\/div>\s*<\/div>\s*\);\s*}/g, newLayout + "\n      </div>\n    );\n  }");

fs.writeFileSync(path.resolve('src/screens/Assistant.tsx'), content);
console.log('Assistant updated');
