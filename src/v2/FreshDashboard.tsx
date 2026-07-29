import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Star,
  Scale,
  Flame,
  AlertTriangle,
  Check,
  UtensilsCrossed,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Meal } from '../types';
import { getLocalDateString, parseLocalDate } from '../utils/date';
import { AnimatedNumber, FreshRing, Modal, SectionLabel, Toast, EmptyState } from './ui';
import { haptic } from './haptics';

/* ============================================================
   FreshDashboard — главный экран в новом дизайне.
   Функциональность 1-в-1 с классическим Dashboard: те же store-
   операции, модалки веса/редактирования/предупреждения ИИ.
   Отличается только отрисовка (дизайн-токены + типографика).
   ============================================================ */

export function FreshDashboard({ onAddMeal }: { onAddMeal?: () => void }) {
  const { settings, meals, deleteMeal, updateMeal, addMeal, addFavorite, favorites, weights, addWeight } =
    useStore();

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [warningMeal, setWarningMeal] = useState<Meal | null>(null);

  // Отмена удаления: храним последнюю удалённую запись и показываем тост
  // с кнопкой «Отменить» на 6 секунд. Раньше удаление было необратимым.
  const [deletedMeal, setDeletedMeal] = useState<Meal | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!deletedMeal) return;
    undoTimer.current = setTimeout(() => setDeletedMeal(null), 6000);
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, [deletedMeal]);

  const handleDelete = (meal: Meal) => {
    deleteMeal(meal.id);
    setDeletedMeal(meal);
    haptic('error');
  };
  const handleUndoDelete = () => {
    if (deletedMeal) {
      addMeal(deletedMeal);
      haptic('success');
    }
    setDeletedMeal(null);
  };

  const todayWeight = weights.find((w) => w.date === selectedDate)?.weight || '';
  const [weightInput, setWeightInput] = useState(todayWeight.toString());

  const latestWeight =
    weights.length > 0
      ? [...weights].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())[0]
      : null;
  const daysSinceLastWeightUpdate = latestWeight
    ? Math.floor((new Date().getTime() - parseLocalDate(latestWeight.date).getTime()) / (1000 * 3600 * 24))
    : Infinity;
  const weightReminder = daysSinceLastWeightUpdate >= 7;

  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalDateString(d));
  };
  const handleNextDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalDateString(d));
  };

  const currentMeals = meals.filter((m) => m.date === selectedDate);
  const todayStr = getLocalDateString();
  const isToday = selectedDate === todayStr;
  const displayDate = parseLocalDate(selectedDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });

  const totalCalories = currentMeals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = currentMeals.reduce((s, m) => s + m.protein, 0);
  const totalFat = currentMeals.reduce((s, m) => s + m.fat, 0);
  const totalCarbs = currentMeals.reduce((s, m) => s + m.carbs, 0);

  const progress = Math.min((totalCalories / settings.dailyGoal) * 100, 100);
  // Переедание: кольцо краснеет и показывает величину перебора.
  const isOver = totalCalories > settings.dailyGoal;
  const overBy = Math.round(totalCalories - settings.dailyGoal);

  const streak = useMemo(() => {
    if (meals.length === 0) return 0;
    const dates = new Set(meals.map((m) => m.date));
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDay = new Date(today);
    if (dates.has(getLocalDateString(checkDay))) {
      currentStreak++;
    } else {
      checkDay.setDate(checkDay.getDate() - 1);
      if (!dates.has(getLocalDateString(checkDay))) return 0;
    }
    while (true) {
      checkDay.setDate(checkDay.getDate() - 1);
      if (dates.has(getLocalDateString(checkDay))) currentStreak++;
      else break;
    }
    return currentStreak;
  }, [meals]);

  const isFavorite = (meal: Meal) =>
    favorites.some((f) => f.name === meal.name && f.calories === meal.calories);

  const handleAddFavorite = (meal: Meal) => {
    addFavorite({
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
    });
    haptic('success');
  };

  const handleSaveWeight = () => {
    if (weightInput) addWeight(Number(weightInput), selectedDate);
    setShowWeightModal(false);
    haptic('success');
  };

  return (
    <div className="space-y-6">
      {/* Заголовок + стрик */}
      <div className="flex items-center justify-between px-0.5">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight text-ink">
          Дневник
        </h1>
        {streak > 0 && (
          <div
            className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full shadow-soft"
            title="Дней подряд"
          >
            <Flame className="w-4 h-4 text-warn fill-warn" />
            <span className="font-display text-sm font-bold text-ink">{streak}</span>
          </div>
        )}
      </div>

      {/* Переключатель дня */}
      <div className="flex items-center justify-between bg-surface rounded-full p-1.5 shadow-soft border border-line/50">
        <button
          onClick={handlePrevDay}
          className="p-2 rounded-full hover:bg-surface-2 transition-colors active:scale-90"
          aria-label="Предыдущий день"
        >
          <ChevronLeft className="w-4 h-4 text-ink-soft" />
        </button>
        <span className="font-display font-bold text-sm text-ink">
          {isToday ? 'Сегодня' : displayDate}
        </span>
        <button
          onClick={handleNextDay}
          disabled={isToday}
          aria-label="Следующий день"
          className={cn(
            'p-2 rounded-full transition-all active:scale-90',
            isToday ? 'opacity-30 cursor-default' : 'hover:bg-surface-2',
          )}
        >
          <ChevronRight className="w-4 h-4 text-ink-soft" />
        </button>
      </div>

      {/* Hero: калории + кольцо + макросы */}
      <div className="bg-surface rounded-[28px] shadow-card border border-line/40 p-6 relative overflow-hidden">
        {/* Кнопка веса — в углу hero. */}
        <button
          onClick={() => {
            setWeightInput(todayWeight.toString() || (latestWeight?.weight.toString() || ''));
            setShowWeightModal(true);
          }}
          className={cn(
            'absolute top-5 right-5 flex flex-col items-center gap-1 transition-colors z-10',
            weightReminder
              ? 'text-danger animate-pulse hover:opacity-80'
              : 'text-ink-faint hover:text-accent',
          )}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[10px] font-semibold">
            {todayWeight
              ? `${Math.round(Number(todayWeight) * 10) / 10} кг`
              : weightReminder
                ? 'Взвесьтесь!'
                : 'Вес'}
          </span>
        </button>

        <SectionLabel className="mb-1">Съедено {isToday ? 'сегодня' : ''}</SectionLabel>

        <div className="flex justify-center py-2">
          <button
            onClick={() => setShowRemaining(!showRemaining)}
            className="outline-none active:scale-[0.97] transition-transform"
            aria-label="Переключить: съедено / осталось"
          >
            <FreshRing progress={progress} tone={isOver ? 'over' : 'normal'}>
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
                    isOver ? (
                      <>
                        <span className="font-display text-[40px] font-extrabold tnum text-danger leading-none">
                          +<AnimatedNumber value={overBy} />
                        </span>
                        <span className="text-[11px] text-danger/80 mt-1.5">перебор ккал</span>
                      </>
                    ) : (
                      <>
                        <span className="font-display text-[42px] font-extrabold tnum text-ink leading-none">
                          <AnimatedNumber value={Math.max(0, settings.dailyGoal - Math.round(totalCalories))} />
                        </span>
                        <span className="text-[11px] text-ink-faint mt-1.5">осталось ккал</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="font-display text-[42px] font-extrabold tnum text-ink leading-none">
                        <AnimatedNumber value={Math.round(totalCalories)} />
                      </span>
                      <span className="text-[11px] text-ink-faint mt-1.5">
                        из {settings.dailyGoal} ккал
                      </span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </FreshRing>
          </button>
        </div>

        {/* Макросы — три стат-блока с цветными барами. */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <MacroStat label="Белки" value={totalProtein} goal={settings.proteinGoal} color="var(--f-protein)" />
          <MacroStat label="Жиры" value={totalFat} goal={settings.fatGoal} color="var(--f-fat)" />
          <MacroStat label="Углеводы" value={totalCarbs} goal={settings.carbsGoal} color="var(--f-carbs)" />
        </div>
      </div>

      {/* Список приёмов пищи */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <SectionLabel>Приёмы пищи</SectionLabel>
          <span className="text-[11px] text-ink-faint font-medium">
            {currentMeals.length || '—'}
          </span>
        </div>

        {currentMeals.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            text="Нет записей за этот день"
            actionLabel={isToday && onAddMeal ? '+ Добавить приём пищи' : undefined}
            onAction={onAddMeal}
          />
        ) : (
          <div className="space-y-2.5">
            {currentMeals.map((meal, index) => (
              <motion.div
                key={meal.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                transition={{
                  duration: 0.32,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                  y: { type: 'spring', stiffness: 320, damping: 22 },
                }}
                className="bg-surface rounded-[20px] p-3 border border-line/40 shadow-soft flex items-center gap-3 hover:shadow-card hover:border-accent-ring/60 transition-[box-shadow,border-color]"
              >
                {meal.images && meal.images.length > 0 ? (
                  <img
                    src={meal.images[0]}
                    alt={meal.name}
                    className="w-13 h-13 rounded-[14px] object-cover bg-surface-2 shrink-0"
                  />
                ) : meal.image ? (
                  <img
                    src={meal.image}
                    alt={meal.name}
                    className="w-13 h-13 rounded-[14px] object-cover bg-surface-2 shrink-0"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-[14px] bg-accent-soft flex items-center justify-center text-lg shrink-0">
                    🍽️
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <h3 className="font-semibold text-[13.5px] text-ink line-clamp-2 leading-tight flex-1">
                        {meal.name}
                      </h3>
                      {meal.confidence_score && meal.confidence_score < 7 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWarningMeal(meal);
                          }}
                          className="shrink-0 bg-warn/15 text-warn rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5"
                          title="ИИ не уверен в точности"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" /> AI
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-ink-faint whitespace-nowrap pt-0.5 shrink-0">
                      {meal.time}
                    </span>
                  </div>
                  <p className="font-display text-[13px] font-bold text-accent mt-1">
                    {meal.calories} ккал
                  </p>
                  <p className="text-[10.5px] text-ink-faint mt-0.5">
                    Б: {meal.protein}г · Ж: {meal.fat}г · У: {meal.carbs}г
                  </p>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {!isFavorite(meal) && (
                    <button
                      onClick={() => handleAddFavorite(meal)}
                      className="p-1 text-ink-faint/60 hover:text-warn transition-colors rounded-full"
                      title="В избранное"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingMeal(meal)}
                    className="p-1 text-ink-faint hover:text-accent transition-colors rounded-full"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(meal)}
                    className="p-1 text-ink-faint hover:text-danger transition-colors rounded-full"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Предупреждение ИИ */}
      <Modal
        open={!!warningMeal}
        onClose={() => setWarningMeal(null)}
        title={
          <span className="flex items-center gap-2 text-warn">
            <AlertTriangle className="w-4.5 h-4.5" /> Внимание (ИИ)
          </span>
        }
      >
        {warningMeal && (
          <>
            <p className="text-xs text-ink-soft mb-3 leading-relaxed">
              Нейросеть не смогла с высокой точностью распознать это блюдо (уверенность:{' '}
              {warningMeal.confidence_score}/10). Вот как она рассуждала:
            </p>
            <div className="bg-surface-2 border border-line/50 p-4 rounded-2xl text-xs text-ink-soft whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {warningMeal.reasoning || warningMeal.ai_thoughts || 'Нет описания.'}
            </div>
            <button
              onClick={() => {
                setEditingMeal(warningMeal);
                setWarningMeal(null);
              }}
              className="w-full mt-4 py-3 rounded-xl bg-surface-2 border border-line/60 text-ink-soft text-sm font-semibold hover:bg-accent-soft hover:text-accent transition-colors"
            >
              Отредактировать КБЖУ вручную
            </button>
          </>
        )}
      </Modal>

      {/* Вес */}
      <Modal
        open={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        title={`Ваш вес (${isToday ? 'Сегодня' : displayDate})`}
      >
        <div className="relative">
          <input
            type="number"
            step="0.1"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="Например, 75.5"
            className="w-full bg-surface-2 border border-line/60 rounded-xl px-3.5 py-3 font-display text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-accent/40 placeholder:font-body placeholder:font-normal placeholder:text-sm placeholder:text-ink-faint"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint font-medium">кг</span>
        </div>
        <button
          onClick={handleSaveWeight}
          className="w-full bg-gradient-to-br from-accent to-accent-strong text-white rounded-xl py-3 mt-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-glow hover:brightness-105 active:scale-[0.98] transition-all"
        >
          <Check className="w-4 h-4" /> Сохранить вес
        </button>
      </Modal>

      {/* Редактирование КБЖУ */}
      <Modal open={!!editingMeal} onClose={() => setEditingMeal(null)} title="Редактировать" wide>
        {editingMeal && (
          <>
            <div className="mb-3.5">
              <SectionLabel className="mb-1.5">Название блюда</SectionLabel>
              <input
                type="text"
                value={editingMeal.name}
                onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                className="w-full bg-surface-2 border border-line/60 rounded-xl px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MacroInput label="Калории (ккал)" value={editingMeal.calories} color="var(--f-accent)"
                onChange={(v) => setEditingMeal({ ...editingMeal, calories: v })} />
              <MacroInput label="Белки (г)" value={editingMeal.protein} color="var(--f-protein)"
                onChange={(v) => setEditingMeal({ ...editingMeal, protein: v })} />
              <MacroInput label="Жиры (г)" value={editingMeal.fat} color="var(--f-fat)"
                onChange={(v) => setEditingMeal({ ...editingMeal, fat: v })} />
              <MacroInput label="Углеводы (г)" value={editingMeal.carbs} color="var(--f-carbs)"
                onChange={(v) => setEditingMeal({ ...editingMeal, carbs: v })} />
            </div>
            <button
              onClick={() => {
                updateMeal(editingMeal.id, editingMeal);
                setEditingMeal(null);
                haptic('success');
              }}
              className="w-full bg-gradient-to-br from-accent to-accent-strong text-white rounded-xl py-3 mt-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-glow hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Check className="w-4 h-4" /> Сохранить
            </button>
          </>
        )}
      </Modal>

      {/* Тост отмены удаления */}
      <Toast
        show={!!deletedMeal}
        message="Запись удалена"
        actionLabel="Отменить"
        onAction={handleUndoDelete}
      />
    </div>
  );
}

/** Стат-блок макроса: подпись, значение, цель и анимированный бар. */
function MacroStat({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal?: number;
  color: string;
}) {
  const percent = goal ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="bg-surface-2 border border-line/40 rounded-2xl px-3 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[10px] text-ink-faint font-medium">{label}</span>
      </div>
      <div className="font-display font-extrabold text-[17px] tnum text-ink leading-none">
        <AnimatedNumber value={Math.round(value)} />
        <span className="text-[10px] font-semibold text-ink-faint ml-0.5">г</span>
      </div>
      {goal && <div className="text-[9.5px] text-ink-faint mt-0.5">цель {goal} г</div>}
      <div className="h-1.5 rounded-full bg-line/60 mt-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${goal ? percent : 0}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 22 }}
        />
      </div>
    </div>
  );
}

/** Поле ввода макроса в модалке редактирования. */
function MacroInput({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <SectionLabel className="mb-1.5">{label}</SectionLabel>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-surface-2 border border-line/60 rounded-xl px-3 py-2.5 font-display font-bold text-sm outline-none focus:ring-2 focus:ring-accent/40 tnum"
        style={{ color }}
      />
    </div>
  );
}
