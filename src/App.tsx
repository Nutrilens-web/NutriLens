import React, { useState, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from './store/useStore';
import { Dashboard } from './screens/Dashboard';
import { AddMeal } from './screens/AddMeal';
import { SettingsScreen } from './screens/Settings';
import { AssistantScreen } from './screens/Assistant';
import { MoreScreen } from './screens/More';
import { WaterTrackerScreen } from './screens/WaterTracker';
import { FridgeScannerScreen } from './screens/FridgeScanner';
import { GroceryScreen } from './screens/Grocery';
import { HabitAnalyzerScreen } from './screens/HabitAnalyzer';
import { MenuAnalyzerScreen } from './screens/MenuAnalyzer';
import { ChatScreen } from './screens/Chat';
import { RecommendationsScreen } from './screens/Recommendations';
import { Camera, Settings as SettingsIcon, Home, BarChart3, Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from './utils/cn';
import { getLocalDateString } from './utils/date';
// Fresh-дизайн (переключается в Настройках, settings.design). Логика экранов
// общая, отличается только отрисовка — поэтому классика остаётся нетронутой.
import { useFreshTheme } from './v2/useFreshTheme';
import { FreshShell } from './v2/FreshShell';
import { FreshDashboard } from './v2/FreshDashboard';
import { FreshAddMeal } from './v2/FreshAddMeal';
import { FreshSettings } from './v2/FreshSettings';
import { FreshWater } from './v2/FreshWater';
import { FreshHub } from './v2/FreshHub';
import { FreshFridge, FreshMenu } from './v2/FreshPhotoTools';
import { FreshHabits } from './v2/FreshHabits';
import { FreshGrocery } from './v2/FreshGrocery';
import { FreshRecommendations } from './v2/FreshRecommendations';
import { FreshChat } from './v2/FreshChat';

// Тяжёлые экраны грузим лениво: Stats тянет recharts (~95 КБ gzip),
// Chat — react-markdown. На старте (Dashboard) они не нужны, поэтому
// выносим в отдельные chunk'и, которые подгружаются по требованию.
const StatsScreen = lazy(() => import('./screens/Stats').then(m => ({ default: m.StatsScreen })));
// Fresh-версия Отчёта — тоже лениво (recharts в отдельном чанке).
const LazyFreshStats = lazy(() => import('./v2/FreshStats').then(m => ({ default: m.FreshStats })));

// Простая заглушка-спиннер на время подгрузки ленивого чанка.
function ScreenLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export type Screen =
  | 'dashboard'
  | 'add'
  | 'settings'
  | 'stats'
  | 'assistant'
  | 'more'
  | 'water'
  | 'fridge'
  | 'grocery'
  | 'habits'
  | 'menu'
  | 'recommendations'
  | 'chat';

// Экраны, на которых скрыта нижняя навигация (полноэкранные режимы).
const FULLSCREEN_SCREENS: Screen[] = ['add'];

// Вспомогательные экраны, открываемые из хаба «Ещё».
const TOOL_SCREENS: Screen[] = ['water', 'fridge', 'grocery', 'habits', 'menu', 'recommendations', 'chat'];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const { meals } = useStore();

  // Ставит data-theme на <html> (авто по системе) и возвращает активный дизайн.
  // Вызывается до рендера, чтобы первая отрисовка была в правильной теме.
  const design = useFreshTheme();
  const isFresh = design === 'fresh';

  const todayDateStr = getLocalDateString();
  const todayMealsCount = meals.filter(m => m.date === todayDateStr).length;
  const shouldPulseFAB = todayMealsCount === 0;

  const goBack = () => setCurrentScreen('more');
  const isToolScreen = TOOL_SCREENS.includes(currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      // Dashboard и AddMeal имеют fresh-версии; остальные экраны пока
      // рендерятся классикой внутри fresh-оболочки (конвертируем позже).
      case 'dashboard': return isFresh ? <FreshDashboard onAddMeal={() => setCurrentScreen('add')} /> : <Dashboard />;
      case 'add': return isFresh
        ? <FreshAddMeal onComplete={() => setCurrentScreen('dashboard')} />
        : <AddMeal onComplete={() => setCurrentScreen('dashboard')} />;
      case 'settings': return isFresh
        ? <FreshSettings onBack={() => setCurrentScreen('dashboard')} />
        : <SettingsScreen onBack={() => setCurrentScreen('dashboard')} />;
      case 'stats': return isFresh ? <LazyFreshStats /> : <StatsScreen />;
      case 'assistant': return isFresh
        ? <FreshHub onNavigate={setCurrentScreen} title="Ассистент" icon={Sparkles} />
        : <AssistantScreen />;
      case 'more': return isFresh
        ? <FreshHub onNavigate={setCurrentScreen} title="Инструменты" icon={LayoutGrid} />
        : <MoreScreen onNavigate={setCurrentScreen} />;
      case 'water': return isFresh ? <FreshWater onBack={goBack} /> : <WaterTrackerScreen onBack={goBack} />;
      case 'fridge': return isFresh ? <FreshFridge onBack={goBack} /> : <FridgeScannerScreen onBack={goBack} />;
      case 'grocery': return isFresh ? <FreshGrocery onBack={goBack} /> : <GroceryScreen onBack={goBack} />;
      case 'habits': return isFresh ? <FreshHabits onBack={goBack} /> : <HabitAnalyzerScreen onBack={goBack} />;
      case 'menu': return isFresh ? <FreshMenu onBack={goBack} /> : <MenuAnalyzerScreen onBack={goBack} />;
      case 'recommendations': return isFresh ? <FreshRecommendations onBack={goBack} /> : <RecommendationsScreen onBack={goBack} />;
      case 'chat': return isFresh ? <FreshChat onBack={goBack} /> : <ChatScreen onBack={goBack} />;
      default: return isFresh ? <FreshDashboard onAddMeal={() => setCurrentScreen('add')} /> : <Dashboard />;
    }
  };

  const screen = (
    <Suspense fallback={<ScreenLoader />}>
      {renderScreen()}
    </Suspense>
  );

  // Fresh-оболочка: амбиентный фон, шапка с вордмарком, плавающий док.
  // Переходы между экранами — slide/fade через AnimatePresence (key по экрану).
  if (isFresh) {
    return (
      <FreshShell
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        shouldPulseFAB={shouldPulseFAB}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {screen}
          </motion.div>
        </AnimatePresence>
      </FreshShell>
    );
  }

  return (
    // Mobile-app shell: фиксированная по высоте колонка, где header и нижняя
    // навигация не прокручиваются, а основной контент скроллится внутри <main>.
    // Раньше использовался sticky-headers + скролл всего окна: motion-карточки
    // (transform) и layoutId-анимации экрана «Отчёт» создавали stacking-контексты,
    // которые при пролистывании налезали на верхнюю панель. Flex-шелл физически
    // разделяет header и скролл-зону, поэтому налезание невозможно.
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-50 text-gray-800 font-sans">
      {/* Header — shrink-0, не участвует в скролле, всегда сверху */}
      <header className="bg-white px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm/50 relative">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">NutriLens</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => setCurrentScreen('more')}
          className={cn(
            "p-2 rounded-full transition-colors",
            currentScreen === 'more' || isToolScreen ? "text-emerald-500 bg-emerald-50" : "text-gray-500 hover:bg-gray-100",
          )}
          aria-label="Ещё инструменты"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content — собственный скролл-контейнер, изолирован от header */}
      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-md mx-auto w-full hide-scrollbar">
        <Suspense fallback={<ScreenLoader />}>
          {renderScreen()}
        </Suspense>
      </main>

      {/* Bottom Navigation — shrink-0, в потоке flex-колонки (не fixed):
          навигация всегда прижата к низу экрана и не перекрывает контент. */}
      {!FULLSCREEN_SCREENS.includes(currentScreen) && (
        <div className="shrink-0 bg-white border-t border-gray-50 flex justify-evenly items-center z-20 pb-safe pt-2 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
          <button onClick={() => setCurrentScreen('dashboard')} className={cn("flex flex-col items-center gap-1 transition-colors w-16 mb-2", currentScreen === 'dashboard' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Дневник</span>
          </button>

          <button onClick={() => setCurrentScreen('stats')} className={cn("flex flex-col items-center gap-1 transition-colors w-16 mb-2", currentScreen === 'stats' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Отчёт</span>
          </button>

          {/* Floating Action Button for Add positioned relative to the nav */}
          <div className="relative -top-6 mx-2">
            <button
              onClick={() => setCurrentScreen('add')}
              className={cn("bg-emerald-500 text-white p-4 rounded-full shadow-[0_4px_20px_rgba(16,185,129,0.4)] hover:bg-emerald-600 active:scale-95 transition-all", shouldPulseFAB && "animate-[pulse-shadow_2s_ease-in-out_infinite]")}
            >
              <Camera className="w-6 h-6" />
            </button>
          </div>

          <button onClick={() => setCurrentScreen('assistant')} className={cn("flex flex-col items-center gap-1 transition-colors w-16 mb-2", currentScreen === 'assistant' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Ассистент</span>
          </button>

          <button onClick={() => setCurrentScreen('settings')} className={cn("flex flex-col items-center gap-1 transition-colors w-16 mb-2", currentScreen === 'settings' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">Настройки</span>
          </button>
        </div>
      )}
    </div>
  );
}
