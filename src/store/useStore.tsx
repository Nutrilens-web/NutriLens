import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
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
  nanoApiKey: '',
  dailyGoal: 2000,
  userContext: 'Я мужчина, 85 кг, жарю на 5г масла',
  apiMode: 'free',
  // Пустые строки = прямое подключение к API без прокси.
  // Логика в ai-wrapper.ts / fallback.ts трактует пустое значение как falsy.
  nanoApiEndpoint: '',
  geminiApiEndpoint: '',
};

// Безопасно читаем и парсим значение из localStorage.
// Если данные повреждены/отсутствуют — возвращаем fallback, чтобы приложение
// не падало белым экраном при загрузке.
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch (e) {
    console.warn(`Не удалось прочитать ${key}, используется значение по умолчанию.`, e);
    try {
      localStorage.removeItem(key);
    } catch {}
    return fallback;
  }
}

// Безопасно записываем значение в localStorage. Возвращает true при успехе.
function saveJSON(key: string, data: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

const INITIAL_CHAT: ChatMessage[] = [
  { role: 'model', text: 'Привет! Я твой ИИ-диетолог. Чем могу помочь сегодня?' },
];

interface StoreValue {
  settings: Settings;
  setSettings: (newSettings: Settings) => void;
  meals: Meal[];
  favorites: FavoriteMeal[];
  weights: WeightEntry[];
  groceryData: { plan: string, categories: { category: string, items: string[] }[] } | null;
  groceryCheckedItems: string[];
  chatHistory: ChatMessage[];
  addMeal: (meal: Meal) => void;
  updateMeal: (id: string, updates: Partial<Meal>) => void;
  deleteMeal: (id: string) => void;
  addFavorite: (favorite: Omit<FavoriteMeal, 'id'>) => void;
  removeFavorite: (id: string) => void;
  addWeight: (weight: number, date: string) => void;
  saveGroceryData: (data: { plan: string, categories: { category: string, items: string[] }[] } | null) => void;
  toggleGroceryCheckedItem: (item: string) => void;
  saveChatHistory: (history: ChatMessage[]) => void;
  clearChatHistory: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() =>
    loadJSON<Settings>(SETTINGS_KEY, defaultSettings),
  );

  const [meals, setMealsState] = useState<Meal[]>(() => loadJSON<Meal[]>(MEALS_KEY, []));

  const [favorites, setFavoritesState] = useState<FavoriteMeal[]>(() =>
    loadJSON<FavoriteMeal[]>(FAVORITES_KEY, []),
  );

  const [weights, setWeightsState] = useState<WeightEntry[]>(() =>
    loadJSON<WeightEntry[]>(WEIGHTS_KEY, []),
  );

  const [groceryData, setGroceryDataState] = useState<StoreValue['groceryData']>(() =>
    loadJSON<StoreValue['groceryData']>(GROCERY_KEY, null),
  );

  const [groceryCheckedItems, setGroceryCheckedItemsState] = useState<string[]>(() =>
    loadJSON<string[]>(GROCERY_CHECKED_KEY, []),
  );

  const [chatHistory, setChatHistoryState] = useState<ChatMessage[]>(() =>
    loadJSON<ChatMessage[]>(CHAT_HISTORY_KEY, INITIAL_CHAT),
  );

  const setSettings = useCallback((newSettings: Settings) => {
    setSettingsState(newSettings);
    saveJSON(SETTINGS_KEY, newSettings);
  }, []);

  const addMeal = useCallback((meal: Meal) => {
    setMealsState((prev) => {
      const currentMeals = prev;
      let updated: Meal[] = [meal, ...currentMeals];

      if (saveJSON(MEALS_KEY, updated)) {
        return updated;
      }

      console.warn('Недостаточно памяти на устройстве. Пытаемся освободить место, удаляя старые фото...');

      let tempMeals = [...currentMeals];
      let savedSuccessfully = false;

      // Удаляем фотографии от старых к новым, чтобы сохранить фото нового приема пищи
      for (let i = tempMeals.length - 1; i >= 0; i--) {
        if (tempMeals[i].images?.length || tempMeals[i].image) {
          tempMeals[i] = { ...tempMeals[i], images: [], image: undefined };
          updated = [meal, ...tempMeals];
          if (saveJSON(MEALS_KEY, updated)) {
            savedSuccessfully = true;
            break;
          }
        }
      }

      if (!savedSuccessfully) {
        console.warn('Память все еще переполнена, сохраняем новый прием пищи без фото.');
        const mealWithoutImages = { ...meal, images: [], image: undefined };
        updated = [mealWithoutImages, ...tempMeals];

        if (!saveJSON(MEALS_KEY, updated)) {
          // Если все еще переполнено, удаляем старые записи до 30 штук
          while (updated.length > 30 && !saveJSON(MEALS_KEY, updated)) {
            updated.pop();
          }
          if (!saveJSON(MEALS_KEY, updated)) {
            console.error('Failed to save meal entirely');
            return prev;
          }
        }
      }
      return updated;
    });
  }, []);

  const updateMeal = useCallback((id: string, updates: Partial<Meal>) => {
    setMealsState((prev) => {
      let updated: Meal[] = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));

      if (saveJSON(MEALS_KEY, updated)) {
        return updated;
      }

      console.warn('Память переполнена при обновлении. Пытаемся освободить место, удаляя старые фото...');
      let savedSuccessfully = false;

      // Удаляем фотографии из ДРУГИХ старых блюд
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].id !== id && (updated[i].images?.length || updated[i].image)) {
          updated[i] = { ...updated[i], images: [], image: undefined };
          if (saveJSON(MEALS_KEY, updated)) {
            savedSuccessfully = true;
            break;
          }
        }
      }

      // Если все еще мало места, удаляем фото самого обновляемого блюда
      if (!savedSuccessfully) {
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].id === id && (updated[i].images?.length || updated[i].image)) {
            updated[i] = { ...updated[i], images: [], image: undefined };
            if (saveJSON(MEALS_KEY, updated)) {
              savedSuccessfully = true;
              break;
            }
          }
        }
      }

      if (!savedSuccessfully) {
        while (updated.length > 30 && !saveJSON(MEALS_KEY, updated)) {
          updated.pop();
        }
        if (!saveJSON(MEALS_KEY, updated)) {
          console.error('Failed to update meal due to storage limits');
          return prev;
        }
      }
      return updated;
    });
  }, []);

  const deleteMeal = useCallback((id: string) => {
    setMealsState((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveJSON(MEALS_KEY, updated);
      return updated;
    });
  }, []);

  const addFavorite = useCallback((favorite: Omit<FavoriteMeal, 'id'>) => {
    setFavoritesState((prev) => {
      const newFavorite: FavoriteMeal = { ...favorite, id: Date.now().toString() };
      const updated = [newFavorite, ...prev];
      saveJSON(FAVORITES_KEY, updated);
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavoritesState((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveJSON(FAVORITES_KEY, updated);
      return updated;
    });
  }, []);

  const addWeight = useCallback((weight: number, date: string) => {
    setWeightsState((prev) => {
      // Upsert by date
      const existing = prev.findIndex((w) => w.date === date);
      let updated = [...prev];
      if (existing >= 0) {
        updated[existing] = { date, weight };
      } else {
        updated.push({ date, weight });
        updated.sort((a, b) => b.date.localeCompare(a.date)); // descending
      }
      saveJSON(WEIGHTS_KEY, updated);
      return updated;
    });
  }, []);

  const saveGroceryData = useCallback(
    (data: StoreValue['groceryData']) => {
      setGroceryDataState(data);
      if (data) {
        saveJSON(GROCERY_KEY, data);
      } else {
        try {
          localStorage.removeItem(GROCERY_KEY);
        } catch {}
        // Clear checked items as well
        setGroceryCheckedItemsState([]);
        try {
          localStorage.removeItem(GROCERY_CHECKED_KEY);
        } catch {}
      }
    },
    [],
  );

  const toggleGroceryCheckedItem = useCallback((item: string) => {
    setGroceryCheckedItemsState((prev) => {
      const isChecked = prev.includes(item);
      const updated = isChecked ? prev.filter((i) => i !== item) : [...prev, item];
      saveJSON(GROCERY_CHECKED_KEY, updated);
      return updated;
    });
  }, []);

  const saveChatHistory = useCallback((history: ChatMessage[]) => {
    setChatHistoryState(history);
    saveJSON(CHAT_HISTORY_KEY, history);
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistoryState(INITIAL_CHAT);
    saveJSON(CHAT_HISTORY_KEY, INITIAL_CHAT);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
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
    }),
    [
      settings,
      meals,
      favorites,
      weights,
      groceryData,
      groceryCheckedItems,
      chatHistory,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore должен использоваться внутри <StoreProvider>');
  }
  return ctx;
}
