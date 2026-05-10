import React, { useState } from 'react';
import { ChatScreen } from './Chat';
import { RecommendationsScreen } from './Recommendations';
import { GroceryScreen } from './Grocery';
import { FridgeScannerScreen } from './FridgeScanner';
import { MenuAnalyzerScreen } from './MenuAnalyzer';
import { WaterTrackerScreen } from './WaterTracker';
import { HabitAnalyzerScreen } from './HabitAnalyzer';
import { MessageCircle, Lightbulb, ShoppingCart, ChevronLeft, Sparkles, ChefHat, Utensils, Droplets, Activity } from 'lucide-react';

type Tool = 'hub' | 'chat' | 'ideas' | 'grocery' | 'fridge' | 'menu' | 'water' | 'habits';

export function AssistantScreen() {
  const [currentTool, setCurrentTool] = useState<Tool>('hub');

  if (currentTool === 'hub') {
    return (
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Инструменты ИИ
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCurrentTool('chat')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Чат с диетологом</span>
          </button>

          <button
            onClick={() => setCurrentTool('ideas')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
              <Lightbulb className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Идеи и Рецепты</span>
          </button>

          <button
            onClick={() => setCurrentTool('fridge')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
              <ChefHat className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Разбор холодильника</span>
          </button>

          <button
            onClick={() => setCurrentTool('menu')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-purple-100 p-2 rounded-full text-purple-600">
              <Utensils className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Оценка ресторана</span>
          </button>

          <button
            onClick={() => setCurrentTool('water')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-sky-100 p-2 rounded-full text-sky-600">
              <Droplets className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Водный баланс</span>
          </button>

          <button
            onClick={() => setCurrentTool('habits')}
            className="bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-rose-100 p-2 rounded-full text-rose-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Разбор привычек</span>
          </button>

          <button
            onClick={() => setCurrentTool('grocery')}
            className="col-span-2 bg-white p-3 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-800 text-center">Список покупок на неделю</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <button
          onClick={() => setCurrentTool('hub')}
          className="p-2 -ml-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Назад к списку</span>
        </button>
      </div>
      <div className="flex-1">
        {currentTool === 'chat' && <ChatScreen />}
        {currentTool === 'ideas' && <RecommendationsScreen />}
        {currentTool === 'grocery' && <GroceryScreen />}
        {currentTool === 'fridge' && <FridgeScannerScreen />}
        {currentTool === 'menu' && <MenuAnalyzerScreen />}
        {currentTool === 'water' && <WaterTrackerScreen />}
        {currentTool === 'habits' && <HabitAnalyzerScreen />}
      </div>
    </div>
  );
}
