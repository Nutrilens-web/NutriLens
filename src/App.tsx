import React, { useState } from 'react';
import { Dashboard } from './screens/Dashboard';
import { AddMeal } from './screens/AddMeal';
import { SettingsScreen } from './screens/Settings';
import { StatsScreen } from './screens/Stats';
import { RecommendationsScreen } from './screens/Recommendations';
import { ChatScreen } from './screens/Chat';
import { Camera, Settings as SettingsIcon, Home, BarChart3, Lightbulb, MessageCircle } from 'lucide-react';
import { cn } from './utils/cn';

export type Screen = 'dashboard' | 'add' | 'settings' | 'stats' | 'recommendations' | 'chat';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

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
      </header>

      {/* Main Content */}
      <main className="px-4 py-5 max-w-md mx-auto">
        {currentScreen === 'dashboard' && <Dashboard />}
        {currentScreen === 'add' && <AddMeal onComplete={() => setCurrentScreen('dashboard')} />}
        {currentScreen === 'settings' && <SettingsScreen onBack={() => setCurrentScreen('dashboard')} />}
        {currentScreen === 'stats' && <StatsScreen />}
        {currentScreen === 'recommendations' && <RecommendationsScreen />}
        {currentScreen === 'chat' && <ChatScreen />}
      </main>

      {/* Bottom Navigation */}
      {currentScreen !== 'add' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-evenly items-center z-20 pb-safe pt-2 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <button onClick={() => setCurrentScreen('dashboard')} className={cn("flex flex-col items-center gap-1 transition-colors w-12 mb-2", currentScreen === 'dashboard' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <Home className="w-5 h-5" />
            <span className="text-[8px] font-medium mt-0.5">Дневник</span>
          </button>
          
          <button onClick={() => setCurrentScreen('recommendations')} className={cn("flex flex-col items-center gap-1 transition-colors w-12 mb-2", currentScreen === 'recommendations' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <Lightbulb className="w-5 h-5" />
            <span className="text-[8px] font-medium mt-0.5">Идеи</span>
          </button>

          {/* Floating Action Button for Add positioned relative to the nav */}
          <div className="relative -top-5 mx-1">
            <button
              onClick={() => setCurrentScreen('add')}
              className="bg-emerald-500 text-white p-3 rounded-full shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Camera className="w-6 h-6" />
            </button>
          </div>

          <button onClick={() => setCurrentScreen('stats')} className={cn("flex flex-col items-center gap-1 transition-colors w-12 mb-2", currentScreen === 'stats' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <BarChart3 className="w-5 h-5" />
            <span className="text-[8px] font-medium mt-0.5">Отчет</span>
          </button>

          <button onClick={() => setCurrentScreen('chat')} className={cn("flex flex-col items-center gap-1 transition-colors w-12 mb-2", currentScreen === 'chat' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <MessageCircle className="w-5 h-5" />
            <span className="text-[8px] font-medium mt-0.5">Чат</span>
          </button>

          <button onClick={() => setCurrentScreen('settings')} className={cn("flex flex-col items-center gap-1 transition-colors w-12 mb-2", currentScreen === 'settings' ? "text-emerald-500" : "text-gray-400 hover:text-gray-600")}>
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[8px] font-medium mt-0.5">Настройки</span>
          </button>
        </div>
      )}
    </div>
  );
}
