import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateGroceryList } from '../utils/ai';
import { getApiKeyError } from '../utils/ai-wrapper';
import { Loader2, ShoppingCart, Trash2, CheckSquare, Square, ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';

export function GroceryScreen({ onBack }: { onBack?: () => void }) {
  const { settings, groceryData, saveGroceryData, groceryCheckedItems, toggleGroceryCheckedItem } = useStore();
  const [preferences, setPreferences] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const keyError = getApiKeyError(settings);
    if (keyError) {
      setError(keyError);
      return;
    }
    setError(null);
    setIsLoading(true);
    
    try {
      const data = await generateGroceryList(settings, settings.userContext, settings.dailyGoal, preferences);
      if (data && data.categories) {
        saveGroceryData(data);
      } else {
        throw new Error('Пустой ответ');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации списка покупок');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    saveGroceryData(null);
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2 mb-1 px-1">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" aria-label="Назад">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <ShoppingCart className="w-5 h-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-gray-900">Список покупок</h2>
      </div>
      <div className="bg-white rounded-[16px] p-4 shadow-sm space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1.5">Пожелания или примечания</label>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="Например: Побольше рыбы, хочу смузи..."
            className="w-full px-3 py-2 rounded-[12px] bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:border-emerald-500 transition-colors h-16 resize-none"
          />
        </div>

        {error && <div className="text-red-500 text-[11px] bg-red-50 p-2.5 rounded-[10px]">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex-1 bg-emerald-500 text-white font-medium py-2.5 rounded-[12px] hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm text-[13px]"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Генерируем...</>
            ) : (
              <><ShoppingCart className="w-4 h-4" /> Список на неделю</>
            )}
          </button>

          {groceryData && (
             <button
              onClick={handleClear}
              className="px-3 bg-red-50 text-red-500 font-medium rounded-[12px] hover:bg-red-100 transition-all flex items-center justify-center shadow-sm"
             >
               <Trash2 className="w-4 h-4" />
             </button>
          )}
        </div>
      </div>

      {groceryData && (
        <div className="space-y-4">
          {groceryData.plan && (
            <div className="bg-emerald-50 text-emerald-900 rounded-[16px] p-4 shadow-sm">
              <h3 className="font-semibold mb-2 text-sm">План питания</h3>
              <div className="prose prose-sm prose-emerald max-w-none text-[13px] leading-relaxed whitespace-pre-wrap">
                <Markdown>{groceryData.plan}</Markdown>
              </div>
            </div>
          )}

          {groceryData.categories && groceryData.categories.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 px-1 mt-4 text-sm">Список продуктов</h3>
              <div className="space-y-2.5">
                {groceryData.categories.map((category: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-[16px] p-3.5 shadow-sm">
                    <h4 className="font-medium text-emerald-600 mb-2 text-[13px]">{category.category}</h4>
                    <ul className="space-y-1">
                      {category.items.map((item: string, i: number) => {
                        const isChecked = groceryCheckedItems.includes(item);
                        return (
                        <li 
                          key={i} 
                          className={`flex flex-row items-start gap-2 cursor-pointer transition-colors p-1 -mx-1 rounded-lg hover:bg-gray-50 ${isChecked ? 'opacity-50' : ''}`}
                          onClick={() => toggleGroceryCheckedItem(item)}
                        >
                          <div className={`mt-0.5 shrink-0 w-4 h-4 flex items-center justify-center transition-colors ${isChecked ? 'text-emerald-500' : 'text-gray-300'}`}>
                            {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <span className={`text-[13px] text-gray-800 flex-1 leading-snug ${isChecked ? 'line-through text-gray-400' : ''}`}>
                            <Markdown components={{ p: 'span' }}>{item}</Markdown>
                          </span>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
