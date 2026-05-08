import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateGroceryList } from '../utils/ai';
import { Loader2, ShoppingCart, Text, ArrowRight, Check } from 'lucide-react';

export function GroceryScreen() {
  const { settings } = useStore();
  const [preferences, setPreferences] = useState('');
  const [groceryList, setGroceryList] = useState<{category: string, items: string[]}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setError('Укажите API ключ Gemini в настройках');
      return;
    }
    setError(null);
    setIsLoading(true);
    
    try {
      const list = await generateGroceryList(settings.apiKey, settings.userContext, settings.dailyGoal, preferences);
      setGroceryList(list);
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации списка покупок');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Пожелания или примечания</label>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="Например: Побольше рыбы, исключить молочку, хочу попробовать смузи по утрам..."
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors h-24 resize-none"
          />
        </div>

        {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-[12px]">{error}</div>}

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full bg-emerald-500 text-white font-medium py-3 rounded-[12px] hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Генерируем...</>
          ) : (
            <><ShoppingCart className="w-5 h-5" /> Создать список на неделю</>
          )}
        </button>
      </div>

      {groceryList.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 px-1 mt-6">Ваш список на неделю</h3>
          <div className="space-y-3">
            {groceryList.map((category, idx) => (
              <div key={idx} className="bg-white rounded-[20px] p-4 shadow-sm">
                <h4 className="font-medium text-emerald-600 mb-3 text-sm">{category.category}</h4>
                <ul className="space-y-2">
                  {category.items.map((item, i) => (
                    <li key={i} className="flex flex-row items-start gap-2.5">
                      <div className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-300 flex items-center justify-center">
                         {/* user can technically tap this but we are not persisting checkbox state currently for simplicity */}
                      </div>
                      <span className="text-sm text-gray-800">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
