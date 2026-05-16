import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/Dashboard.tsx'), 'utf-8');

// 1. Add motion imports
content = content.replace(
  "import { Trash2, ChevronLeft, ChevronRight, Edit2, X, Check, Star, Scale, Flame } from 'lucide-react';",
  "import { Trash2, ChevronLeft, ChevronRight, Edit2, X, Check, Star, Scale, Flame, AlertTriangle } from 'lucide-react';\nimport { motion, AnimatePresence } from 'motion/react';"
);

// 2. Add showRemaining state and showWarningModal
content = content.replace(
  "const [showWeightModal, setShowWeightModal] = useState(false);",
  "const [showWeightModal, setShowWeightModal] = useState(false);\n  const [showRemaining, setShowRemaining] = useState(false);\n  const [warningMeal, setWarningMeal] = useState<Meal | null>(null);"
);

// 3. Update ProgressRing contents
const oldProgressRing = `<ProgressRing radius={80} stroke={8} progress={progress} color="#10B981">
          <span className="text-3xl font-light text-gray-900">{Math.round(totalCalories)}</span>
          <span className="text-[11px] text-gray-400 mt-0.5">из {settings.dailyGoal} ккал</span>
        </ProgressRing>`;

const newProgressRing = `<button onClick={() => setShowRemaining(!showRemaining)} className="outline-none active:scale-95 transition-transform">
          <ProgressRing radius={80} stroke={8} progress={progress} color="#10B981">
            <AnimatePresence mode="popLayout">
              <motion.div 
                key={showRemaining ? 'remaining' : 'total'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                {showRemaining ? (
                  <>
                    <span className="text-3xl font-light text-gray-900">{Math.max(0, settings.dailyGoal - Math.round(totalCalories))}</span>
                    <span className="text-[11px] text-gray-400 mt-0.5">осталось ккал</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-light text-gray-900">{Math.round(totalCalories)}</span>
                    <span className="text-[11px] text-gray-400 mt-0.5">из {settings.dailyGoal} ккал</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </ProgressRing>
        </button>`;

content = content.replace(oldProgressRing, newProgressRing);

// 4. Update shadow of progress section
content = content.replace(
  'className="bg-white rounded-[20px] p-5 shadow-sm flex flex-col items-center relative"',
  'className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col items-center relative"'
);

// 5. Update Meal Cards mapping
const oldMealsMap = `className="bg-white rounded-[16px] p-3 shadow-sm flex items-center gap-3"`;
const newMealsMap = `className="bg-white rounded-[20px] p-3 border border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}`;

content = content.replace(/<div key=\{meal\.id\} className="bg-white rounded-\[16px\].*?">/g, `<motion.div key={meal.id} layout ${newMealsMap}>`);
content = content.replace(/<\/div>\s*\}\)\}\s*<\/div>\s*\)\}\s*<\/div>/g, `</motion.div>\n            ))}\n          </div>\n        )}\n      </div>`); // replace closing div with closing motion.div inside mapping

// Add Warning Badge inside Meal Card (after meal.name)
content = content.replace(
  /<h3 className="font-medium text-sm text-gray-900 truncate pr-2">\{meal\.name\}<\/h3>/g,
  `<div className="flex items-center gap-1.5 pr-2"><h3 className="font-medium text-sm text-gray-900 truncate">{meal.name}</h3>{meal.confidence_score && meal.confidence_score < 7 && (<button onClick={(e) => { e.stopPropagation(); setWarningMeal(meal); }} className="shrink-0 bg-yellow-100 text-yellow-600 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider uppercase flex items-center gap-1" title="ИИ не уверен в точности"><AlertTriangle className="w-2.5 h-2.5"/> AI</button>)}</div>`
);

// 6. MacroBar tweak
content = content.replace(
  '<div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">',
  '<div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">'
);

// 7. Add Warning Modal
const warningModal = `
      {/* Warning Modal */}
      <AnimatePresence>
      {warningMeal && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setWarningMeal(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-[0_10px_40px_rgba(0,0,0,0.1)] space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-semibold flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="w-5 h-5" /> Внимание (ИИ)
              </h3>
              <button onClick={() => setWarningMeal(null)} className="p-1.5 bg-gray-50 rounded-full text-gray-400 hover:text-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Нейросеть не смогла с высокой точностью распознать это блюдо (уверенность: {warningMeal.confidence_score}/10). Вот как она рассуждала:</p>
            <div className="bg-gray-50 p-4 rounded-2xl text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {warningMeal.reasoning || warningMeal.ai_thoughts || "Нет описания."}
            </div>
            <button 
              onClick={() => { setEditingMeal(warningMeal); setWarningMeal(null); }}
              className="w-full mt-2 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Отредактировать КБЖУ вручную
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
`;

content = content.replace('{/* Weight Modal */}', warningModal + '\n\n      {/* Weight Modal */}');


fs.writeFileSync(path.resolve('src/screens/Dashboard.tsx'), content);
console.log('Dashboard code updated');
