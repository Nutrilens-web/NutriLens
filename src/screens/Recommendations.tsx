import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { getRecommendations, getDetailedRecipe } from "../utils/ai";
import {
  Loader2,
  ChevronRight,
  Lightbulb,
  Search,
  BookOpen,
  X,
} from "lucide-react";

export function RecommendationsScreen() {
  const { settings, meals } = useStore();
  const [userInput, setUserInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [recommendations, setRecommendations] = useState<
    Array<{
      id: string;
      title: string;
      shortDescription: string;
      calories: number;
      recipePrompt: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  // Detail view state
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<any>(null);
  const [detailedRecipe, setDetailedRecipe] = useState<string | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [recipeProgress, setRecipeProgress] = useState(0);

  // Calculate remaining calories today
  const selectedDate = new Date().toISOString().split("T")[0];
  const currentMeals = meals.filter((m) => m.date === selectedDate);
  const totalCalories = currentMeals.reduce((sum, m) => sum + m.calories, 0);
  const remainingCalories = Math.max(0, settings.dailyGoal - totalCalories);

  const handleSearch = async () => {
    if (!settings.apiKey) {
      setError("Укажите API ключ Gemini в настройках");
      return;
    }
    setError(null);
    setIsSearching(true);
    setLoadingProgress(0);
    setRecommendations([]);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setLoadingProgress(Math.round(currentProgress));
    }, 200);

    const recentMealsText = currentMeals
      .map((m) => `- ${m.name} (${m.calories} ккал)`)
      .join("\n");

    try {
      const results = await getRecommendations(
        settings,
        settings.userContext,
        userInput,
        remainingCalories,
        recentMealsText,
      );
      setRecommendations(results);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при поиске идей");
    } finally {
      clearInterval(progressInterval);
      setIsSearching(false);
    }
  };

  const loadRecipe = async (item: any) => {
    setSelectedRecipeItem(item);
    setDetailedRecipe(null);
    setIsLoadingRecipe(true);
    setRecipeProgress(0);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setRecipeProgress(Math.round(currentProgress));
    }, 200);

    try {
      const recipe = await getDetailedRecipe(
        settings,
        item.recipePrompt,
      );
      setDetailedRecipe(recipe);
    } catch (err) {
      setDetailedRecipe("Ошибка при загрузке рецепта.");
    } finally {
      clearInterval(progressInterval);
      setIsLoadingRecipe(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Идеи для еды
        </h2>
      </div>

      <div className="bg-white rounded-[16px] p-4 shadow-sm space-y-4">
        <div>
          <h3 className="text-xs font-medium text-gray-700">
            Осталось на сегодня
          </h3>
          <p className="text-xl font-light text-emerald-600 mt-1">
            {remainingCalories}{" "}
            <span className="text-[11px] text-gray-400">ккал</span>
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-2">
            Идеи по категории или описанию
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-3 hide-scrollbar">
            {['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Десерт'].map(cat => (
              <button
                key={cat}
                onClick={() => setUserInput(cat)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${userInput === cat ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Мясо с картошкой, или что-то легкое..."
              className="w-full px-3 py-2 rounded-[12px] bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:border-emerald-500 transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-2.5 rounded-[10px] text-[11px]">
            {error}
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="relative overflow-hidden w-full bg-emerald-50 text-emerald-600 font-medium text-[13px] py-2.5 rounded-[12px] hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isSearching && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-emerald-100 transition-all duration-200"
              style={{ width: `${loadingProgress}%` }}
            />
          )}
          <div className="relative z-10 flex items-center gap-2">
            {isSearching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                Поиск... {loadingProgress}%
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5 text-emerald-600" />
                Найти идеи
              </>
            )}
          </div>
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-900 px-1 pt-1">
            Рекомендации
          </h3>
          {recommendations.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[16px] p-3 shadow-sm flex flex-col gap-1.5"
            >
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-medium text-gray-900 text-[13px] leading-tight">
                  {item.title}
                </h4>
                <span className="text-emerald-600 font-medium text-[13px] whitespace-nowrap">
                  {item.calories} ккал
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{item.shortDescription}</p>

              <button
                onClick={() => loadRecipe(item)}
                className="mt-1 text-[11px] font-medium text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors w-fit"
              >
                <BookOpen className="w-3 h-3" />
                Смотреть рецепт
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recipe Modal */}
      {selectedRecipeItem && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6 pb-0 sm:pb-6">
          <div className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 truncate pr-4">
                {selectedRecipeItem.title}
              </h3>
              <button
                onClick={() => setSelectedRecipeItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {isLoadingRecipe ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                  <span className="text-[13px] font-medium">
                    Создаем рецепт... {recipeProgress}%
                  </span>
                </div>
              ) : (
                <div className="prose prose-sm prose-emerald max-w-none text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {detailedRecipe}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
