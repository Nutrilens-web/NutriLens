import React, { useState, Suspense, lazy } from 'react';
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

// Тяжёлые экраны грузим лениво: Stats тянет recharts (~95 КБ gzip),
// Chat — react-markdown. На старте (Dashboard) они не нужны, поэтому
// выносим в отдельные chunk'и, которые подгружаются по требованию.
const StatsScreen = lazy(() => import('./screens/Stats').then(m => ({ default: m.StatsScreen })));

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

  const todayDateStr = getLocalDateString();
  const todayMealsCount = meals.filter(m => m.date === todayDateStr).length;
  const shouldPulseFAB = todayMealsCount === 0;

  const goBack = () => setCurrentScreen('more');
  const isToolScreen = TOOL_SCREENS.includes(currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <Dashboard />;
      case 'add': return <AddMeal onComplete={() => setCurrentScreen('dashboard')} />;
      case 'settings': return <SettingsScreen onBack={() => setCurrentScreen('dashboard')} />;
      case 'stats': return <StatsScreen />;
      case 'assistant': return <AssistantScreen />;
      case 'more': return <MoreScreen onNavigate={setCurrentScreen} />;
      case 'water': return <WaterTrackerScreen onBack={goBack} />;
      case 'fridge': return <FridgeScannerScreen onBack={goBack} />;
      case 'grocery': return <GroceryScreen onBack={goBack} />;
      case 'habits': return <HabitAnalyzerScreen onBack={goBack} />;
      case 'menu': return <MenuAnalyzerScreen onBack={goBack} />;
      case 'recommendations': return <RecommendationsScreen onBack={goBack} />;
      case 'chat': return <ChatScreen onBack={goBack} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
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

      {/* Main Content */}
      <main className="px-4 py-5 max-w-md mx-auto">
        <Suspense fallback={<ScreenLoader />}>
          {renderScreen()}
        </Suspense>
      </main>

      {/* Bottom Navigation */}
      {!FULLSCREEN_SCREENS.includes(currentScreen) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 flex justify-evenly items-center z-20 pb-safe pt-2 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
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
