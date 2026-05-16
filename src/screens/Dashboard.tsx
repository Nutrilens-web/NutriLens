import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { ProgressRing } from '../components/ProgressRing';
import { Trash2, ChevronLeft, ChevronRight, Edit2, X, Check, Star, Scale, Flame, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Meal } from '../types';

export function Dashboard() {
  const { settings, meals, deleteMeal, updateMeal, addFavorite, favorites, weights, addWeight } = useStore();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [warningMeal, setWarningMeal] = useState<Meal | null>(null);
  
  const todayWeight = weights.find(w => w.date === selectedDate)?.weight || '';
  const [weightInput, setWeightInput] = useState(todayWeight.toString());

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  
  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const currentMeals = meals.filter(m => m.date === selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const displayDate = new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

  const totalCalories = currentMeals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = currentMeals.reduce((sum, m) => sum + m.protein, 0);
  const totalFat = currentMeals.reduce((sum, m) => sum + m.fat, 0);
  const totalCarbs = currentMeals.reduce((sum, m) => sum + m.carbs, 0);

  const progress = Math.min((totalCalories / settings.dailyGoal) * 100, 100);

  const streak = useMemo(() => {
    if (meals.length === 0) return 0;
    const dates = [...new Set(meals.map(m => m.date))].sort((a,b) => b.localeCompare(a));
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let checkDay = new Date(today);
    let todayStr = checkDay.toISOString().split('T')[0];
    
    if (dates.includes(todayStr)) {
      currentStreak++;
    } else {
      checkDay.setDate(checkDay.getDate() - 1);
      let yesterdayStr = checkDay.toISOString().split('T')[0];
      if (!dates.includes(yesterdayStr)) return 0; // Lost streak
    }

    while (true) {
      checkDay.setDate(checkDay.getDate() - 1);
      let dateStr = checkDay.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        currentStreak++;
      } else {
        break;
      }
    }
    return currentStreak;
  }, [meals]);

  const isFavorite = (meal: Meal) => {
    return favorites.some(f => f.name === meal.name && f.calories === meal.calories);
  };

  const handleAddFavorite = (meal: Meal) => {
    addFavorite({
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
    });
  };

  const handleSaveWeight = () => {
    if (weightInput) {
      addWeight(Number(weightInput), selectedDate);
    }
    setShowWeightModal(false);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header / Date Navigation */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Дневник</h1>
        
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full" title="Дней подряд">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-medium text-orange-600">{streak}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-white rounded-full p-1.5 shadow-sm">
        <button onClick={handlePrevDay} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="font-medium text-sm text-gray-800">
          {isToday ? 'Сегодня' : displayDate}
        </span>
        <button 
          onClick={handleNextDay} 
          disabled={isToday}
          className={`p-1.5 rounded-full transition-colors ${isToday ? 'opacity-30 cursor-default' : 'hover:bg-gray-100'}`}
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col items-center relative">
        <button 
          onClick={() => {
            setWeightInput(todayWeight.toString());
            setShowWeightModal(true);
          }}
          className="absolute top-4 right-4 flex flex-col items-center gap-1 text-gray-400 hover:text-emerald-500 transition-colors"
        >
          <Scale className="w-5 h-5" />
          <span className="text-[10px] font-medium">{todayWeight ? `${Math.round(Number(todayWeight) * 10) / 10} кг` : 'Вес'}</span>
        </button>

        <button onClick={() => setShowRemaining(!showRemaining)} className="outline-none active:scale-95 transition-transform">
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
        </button>

        {/* Macros */}
        <div className="flex w-full justify-between mt-6 px-4">
          <MacroBar label="Белки" value={totalProtein} goal={settings.proteinGoal} color="bg-blue-500" />
          <MacroBar label="Жиры" value={totalFat} goal={settings.fatGoal} color="bg-amber-500" />
          <MacroBar label="Углеводы" value={totalCarbs} goal={settings.carbsGoal} color="bg-purple-500" />
        </div>
      </div>

      {/* Meals List */}
      <div>
        <h2 className="text-base font-medium text-gray-900 mb-3 px-1">Приемы пищи</h2>
        {currentMeals.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6 bg-white rounded-[20px] border border-dashed border-gray-200">
            Нет записей за этот день
          </div>
        ) : (
          <div className="space-y-2">
            {currentMeals.map((meal, index) => (
              <motion.div key={meal.id} layout className="bg-white rounded-[20px] p-3 border border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}>
                {meal.images && meal.images.length > 0 ? (
                  <img src={meal.images[0]} alt={meal.name} className="w-12 h-12 rounded-[10px] object-cover bg-gray-100" />
                ) : meal.image ? (
                  <img src={meal.image} alt={meal.name} className="w-12 h-12 rounded-[10px] object-cover bg-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-[10px] bg-gray-100 flex items-center justify-center text-base">🍽️</div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 pr-2"><h3 className="font-medium text-sm text-gray-900 truncate">{meal.name}</h3>{meal.confidence_score && meal.confidence_score < 7 && (<button onClick={(e) => { e.stopPropagation(); setWarningMeal(meal); }} className="shrink-0 bg-yellow-100 text-yellow-600 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider uppercase flex items-center gap-1" title="ИИ не уверен в точности"><AlertTriangle className="w-2.5 h-2.5"/> AI</button>)}</div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">{meal.time}</span>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">{meal.calories} ккал</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Б: {meal.protein}г • Ж: {meal.fat}г • У: {meal.carbs}г
                  </p>
                </div>

                <div className="flex flex-col gap-1 pr-1">
                  {!isFavorite(meal) && (
                    <button 
                      onClick={() => handleAddFavorite(meal)}
                      className="p-1 text-gray-300 hover:text-yellow-400 transition-colors rounded-full"
                      title="В избранное"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setEditingMeal(meal)}
                    className="p-1 text-gray-400 hover:text-emerald-500 transition-colors rounded-full"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => deleteMeal(meal.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      
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


      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base font-medium">Ваш вес ({isToday ? 'Сегодня' : displayDate})</h3>
              <button onClick={() => setShowWeightModal(false)} className="p-1 text-gray-400 hover:text-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="relative">
              <input 
                type="number" 
                step="0.1"
                value={weightInput} 
                onChange={e => setWeightInput(e.target.value)}
                placeholder="Например, 75.5"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald-500/50"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">кг</span>
            </div>

            <button 
              onClick={handleSaveWeight}
              className="w-full bg-emerald-500 text-white rounded-xl py-2.5 mt-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              Сохранить вес
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base font-medium">Редактировать</h3>
              <button onClick={() => setEditingMeal(null)} className="p-1 text-gray-400 hover:text-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase">Название блюда</label>
              <input 
                type="text" 
                value={editingMeal.name} 
                onChange={e => setEditingMeal({...editingMeal, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase">Калории (ккал)</label>
                <input 
                  type="number" 
                  value={editingMeal.calories} 
                  onChange={e => setEditingMeal({...editingMeal, calories: Number(e.target.value)})}
                  className="w-full bg-gray-50 text-emerald-700 font-semibold text-sm border-none rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase">Белки (г)</label>
                <input 
                  type="number" 
                  value={editingMeal.protein} 
                  onChange={e => setEditingMeal({...editingMeal, protein: Number(e.target.value)})}
                  className="w-full bg-gray-50 text-blue-700 font-medium text-sm border-none rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase">Жиры (г)</label>
                <input 
                  type="number" 
                  value={editingMeal.fat} 
                  onChange={e => setEditingMeal({...editingMeal, fat: Number(e.target.value)})}
                  className="w-full bg-gray-50 text-amber-700 font-medium text-sm border-none rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase">Углеводы (г)</label>
                <input 
                  type="number" 
                  value={editingMeal.carbs} 
                  onChange={e => setEditingMeal({...editingMeal, carbs: Number(e.target.value)})}
                  className="w-full bg-gray-50 text-purple-700 font-medium text-sm border-none rounded-xl px-3 py-2 outline-none"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                updateMeal(editingMeal.id, editingMeal);
                setEditingMeal(null);
              }}
              className="w-full bg-emerald-500 text-white rounded-xl py-2.5 mt-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal?: number; color: string }) {
  const percent = goal ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <div className="font-medium text-sm text-gray-900 mb-1.5">{Math.round(value)}г {goal && <span className="text-[10px] text-gray-400 font-normal">/ {goal}</span>}</div>
      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: goal ? `${percent}%` : '100%' }} />
      </div>
    </div>
  );
}
