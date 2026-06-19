import { useState, useEffect, useCallback } from 'react';
import { Meal, Settings, FavoriteMeal, WeightEntry, ChatMessage } from '../types';

const SETTINGS_KEY = 'nutrilens_settings';
const MEALS_KEY = 'nutrilens_meals';
const FAVORITES_KEY = 'nutrilens_favorites';
const WEIGHTS_KEY = 'nutrilens_weights';
const GROCERY_KEY = 'nutrilens_grocery';
const GROCERY_CHECKED_KEY = 'nutrilens_grocery_checked';
const CHAT_HISTORY_KEY = 'nutrilens_chat_history';

const defaultSettings: Settings = {
  apiKey: '',
  dailyGoal: 2000,
  userContext: 'Я мужчина, 85 кг, тарелки диаметром 26 см, жарю на 5г масла',
  apiMode: 'free',
};

export function useStore() {
  const [settings, setSettingsState] = useState<Settings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [meals, setMealsState] = useState<Meal[]>(() => {
    const saved = localStorage.getItem(MEALS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavoritesState] = useState<FavoriteMeal[]>(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [weights, setWeightsState] = useState<WeightEntry[]>(() => {
    const saved = localStorage.getItem(WEIGHTS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [groceryData, setGroceryDataState] = useState<{ plan: string, categories: {category: string, items: string[]}[] } | null>(() => {
    const saved = localStorage.getItem(GROCERY_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [groceryCheckedItems, setGroceryCheckedItemsState] = useState<string[]>(() => {
    const saved = localStorage.getItem(GROCERY_CHECKED_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [chatHistory, setChatHistoryState] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [
      { role: 'model', text: 'Привет! Я твой ИИ-диетолог. Чем могу помочь сегодня?' }
    ];
  });

  const setSettings = useCallback((newSettings: Settings) => {
    setSettingsState(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  }, []);

  const addMeal = useCallback((meal: Meal) => {
    const saved = localStorage.getItem(MEALS_KEY);
    const currentMeals = saved ? JSON.parse(saved) : [];
    
    let updated = [meal, ...currentMeals];

    const trySave = (data: any[]) => {
      try {
        localStorage.setItem(MEALS_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    };

    if (!trySave(updated)) {
      console.warn('Недостаточно памяти на устройстве. Прием пищи сохранен без фото.');
      const mealWithoutImages = { ...meal, images: [], image: undefined };
      updated = [mealWithoutImages, ...currentMeals];
      
      if (!trySave(updated)) {
        // Strip images from oldest to newest until it fits
        console.warn('Память все еще переполнена, удаляем старые фото.');
        
        // Ensure we iterate from oldest (end of array) to newest
        for (let i = updated.length - 1; i >= 1; i--) {
          if (updated[i].images?.length || updated[i].image) {
            updated[i] = { ...updated[i], images: [], image: undefined };
            if (trySave(updated)) {
              break;
            }
          }
        }

        // If it still fails, aggressively prune oldest meals
        if (!trySave(updated)) {
          while (updated.length > 30 && !trySave(updated)) {
            updated.pop();
          }
          if (!trySave(updated)) {
             console.error('Failed to save meal entirely');
             return;
          }
        }
      }
    }
    setMealsState(updated);
  }, []);

  const updateMeal = useCallback((id: string, updates: Partial<Meal>) => {
    const saved = localStorage.getItem(MEALS_KEY);
    const currentMeals = saved ? JSON.parse(saved) : [];
    
    let updated = currentMeals.map((m: Meal) => (m.id === id ? { ...m, ...updates } : m));
    
    const trySave = (data: any[]) => {
      try {
        localStorage.setItem(MEALS_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    };

    if (!trySave(updated)) {
      console.warn('Память переполнена, удаляем старые фото для сохранения.');
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].images?.length || updated[i].image) {
          updated[i] = { ...updated[i], images: [], image: undefined };
          if (trySave(updated)) {
            break;
          }
        }
      }
      
      if (!trySave(updated)) {
         while (updated.length > 30 && !trySave(updated)) {
           updated.pop();
         }
         if (!trySave(updated)) {
            console.error('Failed to update meal due to storage limits');
            return;
         }
      }
    }
    setMealsState(updated);
  }, []);

  const deleteMeal = useCallback((id: string) => {
    const saved = localStorage.getItem(MEALS_KEY);
    const currentMeals = saved ? JSON.parse(saved) : [];
    
    const updated = currentMeals.filter((m: Meal) => m.id !== id);
    localStorage.setItem(MEALS_KEY, JSON.stringify(updated));
    setMealsState(updated);
  }, []);

  const addFavorite = useCallback((favorite: Omit<FavoriteMeal, 'id'>) => {
    const newFavorite: FavoriteMeal = { ...favorite, id: Date.now().toString() };
    setFavoritesState(prev => {
      const updated = [newFavorite, ...prev];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavoritesState(prev => {
      const updated = prev.filter(f => f.id !== id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addWeight = useCallback((weight: number, date: string) => {
    setWeightsState(prev => {
      // Upsert by date
      const existing = prev.findIndex(w => w.date === date);
      let updated = [...prev];
      if (existing >= 0) {
        updated[existing] = { date, weight };
      } else {
        updated.push({ date, weight });
        updated.sort((a, b) => b.date.localeCompare(a.date)); // descending
      }
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const saveGroceryData = useCallback((data: { plan: string, categories: {category: string, items: string[]}[] } | null) => {
    setGroceryDataState(data);
    if (data) {
        localStorage.setItem(GROCERY_KEY, JSON.stringify(data));
    } else {
        localStorage.removeItem(GROCERY_KEY);
        // Clear checked items as well
        setGroceryCheckedItemsState([]);
        localStorage.removeItem(GROCERY_CHECKED_KEY);
    }
  }, []);

  const toggleGroceryCheckedItem = useCallback((item: string) => {
    setGroceryCheckedItemsState(prev => {
      const isChecked = prev.includes(item);
      const updated = isChecked ? prev.filter(i => i !== item) : [...prev, item];
      localStorage.setItem(GROCERY_CHECKED_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const saveChatHistory = useCallback((history: ChatMessage[]) => {
    setChatHistoryState(history);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  }, []);

  const clearChatHistory = useCallback(() => {
    const initial: ChatMessage[] = [{ role: 'model', text: 'Привет! Я твой ИИ-диетолог. Чем могу помочь сегодня?' }];
    setChatHistoryState(initial);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(initial));
  }, []);

  return {
    settings,
    setSettings,
    meals,
    favorites,
    weights,
    groceryData,
    groceryCheckedItems,
    chatHistory,
    addMeal,
    updateMeal,
    deleteMeal,
    addFavorite,
    removeFavorite,
    addWeight,
    saveGroceryData,
    toggleGroceryCheckedItem,
    saveChatHistory,
    clearChatHistory,
  };
}
