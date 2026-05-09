import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateRecipesByCategory, getDetailedRecipe } from '../utils/ai';
import { Loader2, Book, Search, BookOpen, X } from 'lucide-react';
import Markdown from 'react-markdown';

export function RecipesBookScreen() {
  const { settings } = useStore();
  const [category, setCategory] = useState<'Завтрак' | 'Обед' | 'Ужин' | 'Перекус'>('Завтрак');
  const [recipes, setRecipes] = useState<Array<{title: string, description: string, calories: number, prompt: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail view state
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<any>(null);
  const [detailedRecipe, setDetailedRecipe] = useState<string | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setError('Укажите API ключ Gemini в настройках');
      return;
    }
    setError(null);
    setIsLoading(true);
    setRecipes([]);
    try {
      const results = await generateRecipesByCategory(settings.apiKey, settings.userContext, settings.dailyGoal, category);
      setRecipes(results);
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecipe = async (item: any) => {
    setSelectedRecipeItem(item);
    setDetailedRecipe(null);
    setIsLoadingRecipe(true);

    try {
      const recipe = await getDetailedRecipe(settings.apiKey, item.prompt);
      setDetailedRecipe(recipe);
    } catch (err) {
      setDetailedRecipe("Ошибка при загрузке рецепта.");
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {['Завтрак', 'Обед', 'Ужин', 'Перекус'].map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${category === cat ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="w-full bg-emerald-50 text-emerald-600 font-medium py-3 rounded-[16px] hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        Найти рецепты
      </button>

      {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-[12px]">{error}</div>}

      <div className="space-y-3 mt-4">
        {recipes.map((item, idx) => (
          <div key={idx} className="bg-white rounded-[20px] p-4 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-medium text-gray-900 text-sm leading-tight">{item.title}</h4>
              <span className="text-emerald-600 font-medium text-sm whitespace-nowrap">~{item.calories} ккал</span>
            </div>
            <p className="text-xs text-gray-600">{item.description}</p>
            <button
              onClick={() => loadRecipe(item)}
              className="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors w-fit"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Смотреть рецепт
            </button>
          </div>
        ))}
      </div>

       {/* Recipe Modal */}
       {selectedRecipeItem && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6 pb-0 sm:pb-6">
          <div className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 truncate pr-4">{selectedRecipeItem.title}</h3>
              <button onClick={() => setSelectedRecipeItem(null)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {isLoadingRecipe ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-sm font-medium">Загрузка...</span>
                </div>
              ) : (
                <div className="prose prose-sm prose-emerald max-w-none text-sm text-gray-700 whitespace-pre-wrap">
                  <Markdown>{detailedRecipe}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
