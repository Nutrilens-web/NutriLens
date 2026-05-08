import React, { useState } from 'react';
import { ChatScreen } from './Chat';
import { RecommendationsScreen } from './Recommendations';
import { GroceryScreen } from './Grocery';
import { RecipesBookScreen } from './RecipesBook';
import { MessageCircle, Lightbulb, ShoppingCart, Book, ChevronLeft, Sparkles } from 'lucide-react';

type Tool = 'hub' | 'chat' | 'ideas' | 'grocery' | 'recipes';

export function AssistantScreen() {
  const [currentTool, setCurrentTool] = useState<Tool>('hub');

  if (currentTool === 'hub') {
    return (
      <div className="space-y-5 pb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Ассистент
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCurrentTool('chat')}
            className="bg-white p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-3 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-800">Чат с диетологом</span>
          </button>

          <button
            onClick={() => setCurrentTool('ideas')}
            className="bg-white p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-3 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
              <Lightbulb className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-800">Идеи для еды</span>
          </button>

          <button
            onClick={() => setCurrentTool('recipes')}
            className="bg-white p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-3 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-orange-100 p-3 rounded-full text-orange-600">
              <Book className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-800">Книга рецептов</span>
          </button>

          <button
            onClick={() => setCurrentTool('grocery')}
            className="bg-white p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center gap-3 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
          >
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-800 text-center">Список покупок</span>
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
        {currentTool === 'recipes' && <RecipesBookScreen />}
      </div>
    </div>
  );
}
