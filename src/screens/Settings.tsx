import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { ArrowLeft, Trash2, Download, Upload } from 'lucide-react';
import { getLocalDateString } from '../utils/date';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, setSettings } = useStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    setSettings(localSettings);
    onBack();
  };

  const handleClearData = () => {
    localStorage.removeItem('nutrilens_settings');
    localStorage.removeItem('nutrilens_meals');
    localStorage.removeItem('nutrilens_favorites');
    localStorage.removeItem('nutrilens_weights');
    localStorage.removeItem('nutrilens_grocery');
    localStorage.removeItem('nutrilens_grocery_checked');
    localStorage.removeItem('nutrilens_chat_history');
    window.location.reload();
  };

  const handleExport = () => {
    const data = {
      settings: localStorage.getItem('nutrilens_settings'),
      meals: localStorage.getItem('nutrilens_meals'),
      favorites: localStorage.getItem('nutrilens_favorites'),
      weights: localStorage.getItem('nutrilens_weights'),
      grocery: localStorage.getItem('nutrilens_grocery'),
      grocery_checked: localStorage.getItem('nutrilens_grocery_checked'),
      chat_history: localStorage.getItem('nutrilens_chat_history')
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrilens_backup_${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.settings) localStorage.setItem('nutrilens_settings', json.settings);
        if (json.meals) localStorage.setItem('nutrilens_meals', json.meals);
        if (json.favorites) localStorage.setItem('nutrilens_favorites', json.favorites);
        if (json.weights) localStorage.setItem('nutrilens_weights', json.weights);
        if (json.grocery) localStorage.setItem('nutrilens_grocery', json.grocery);
        if (json.grocery_checked) localStorage.setItem('nutrilens_grocery_checked', json.grocery_checked);
        if (json.chat_history) localStorage.setItem('nutrilens_chat_history', json.chat_history);
        alert('Данные успешно импортированы!');
        window.location.reload();
      } catch (err) {
        alert('Ошибка при импорте данных. Проверьте формат файла.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900">Настройки</h2>
      </div>

      <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            API Ключ Gemini
          </label>
          <input
            type="password"
            value={localSettings.apiKey}
            onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            placeholder="AIzaSy..."
          />
          <p className="text-[10px] text-gray-400 mt-1.5">Хранится только на вашем устройстве. Нужен для бесплатного режима.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Ключ NanoGPT
          </label>
          <input
            type="password"
            value={localSettings.nanoApiKey || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, nanoApiKey: e.target.value })}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            placeholder="sk-nano-..."
          />
          <p className="text-[10px] text-gray-400 mt-1.5">Нужен для режимов «Простой» и «Продвинутый». Хранится только на вашем устройстве.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Дневная норма калорий
          </label>
          <input
             type="number"
             value={localSettings.dailyGoal}
             onChange={(e) => setLocalSettings({ ...localSettings, dailyGoal: Number(e.target.value) })}
             className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all mb-3"
          />
          
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Цели по макронутриентам (г)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-gray-500 ml-1">Белки</span>
              <input
                 type="number"
                 value={localSettings.proteinGoal || ''}
                 placeholder="Например, 150"
                 onChange={(e) => setLocalSettings({ ...localSettings, proteinGoal: Number(e.target.value) || undefined })}
                 className="w-full px-2 py-2 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-center"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 ml-1">Жиры</span>
              <input
                 type="number"
                 value={localSettings.fatGoal || ''}
                 placeholder="Например, 70"
                 onChange={(e) => setLocalSettings({ ...localSettings, fatGoal: Number(e.target.value) || undefined })}
                 className="w-full px-2 py-2 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-center"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 ml-1">Углеводы</span>
              <input
                 type="number"
                 value={localSettings.carbsGoal || ''}
                 placeholder="Например, 200"
                 onChange={(e) => setLocalSettings({ ...localSettings, carbsGoal: Number(e.target.value) || undefined })}
                 className="w-full px-2 py-2 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-center"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Мой контекст
          </label>
          <textarea
            value={localSettings.userContext}
            onChange={(e) => setLocalSettings({ ...localSettings, userContext: e.target.value })}
            rows={3}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
            placeholder="Опишите себя и типичные порции (например: мужчина, 85 кг, жарю на 5г масла). Размер посуды указывать не нужно — ИИ оценит её по фото."
          />
          <p className="text-[10px] text-gray-400 mt-1.5">ИИ сам оценивает размер порции по предметам на фото — описывать посуду не обязательно.</p>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Режим работы нейросети
          </label>
          <select
            value={localSettings.apiMode || 'free'}
            onChange={(e) => setLocalSettings({ ...localSettings, apiMode: e.target.value as any })}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          >
            <option value="free">Бесплатно (свой API ключ)</option>
            <option value="simple">Простой (быстрый анализ через Nano)</option>
            <option value="advanced">Продвинутый (глубокий анализ через Nano)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Прокси / обход блокировок</h3>
          <p className="text-[10px] text-gray-400 mb-4">
            Если прямой доступ к API заблокирован (например, в РФ), укажите адрес своего прокси.
            Оставьте поля пустыми для прямого подключения. Шаблон прокси — в папке <code className="text-gray-500">proxy/</code>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            URL прокси для Gemini
          </label>
          <input
            type="url"
            value={localSettings.geminiApiEndpoint || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, geminiApiEndpoint: e.target.value })}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            placeholder="https://my-worker.workers.dev"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">Базовый адрес для запросов @google/genai SDK. Пусто = generativelanguage.googleapis.com.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            URL прокси для NanoGPT
          </label>
          <input
            type="url"
            value={localSettings.nanoApiEndpoint || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, nanoApiEndpoint: e.target.value })}
            className="w-full px-3 py-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            placeholder="https://nano-gpt.com"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">Базовый адрес для запросов к NanoGPT. Пусто = nano-gpt.com.</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-emerald-500 text-white text-sm font-medium py-3 rounded-[12px] hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm"
      >
        Сохранить настройки
      </button>

      <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Управление данными</h3>
        
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleImport} 
        />
        
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 bg-gray-50 text-gray-700 text-xs font-medium py-2.5 rounded-[10px] shadow-sm flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-gray-50 text-gray-700 text-xs font-medium py-2.5 rounded-[10px] shadow-sm flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Импорт
          </button>
        </div>

        <div className="pt-2">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-red-50 text-red-600 text-xs font-medium py-2.5 rounded-[10px] hover:bg-red-100 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистить дневник (освободить память)
            </button>
          ) : (
            <div className="bg-red-50 p-3.5 rounded-[16px] space-y-3">
              <p className="text-[10px] text-red-800 text-center font-medium">Точно удалить все записи? Это нельзя отменить.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-white text-gray-700 text-[10px] font-medium py-2 rounded-[8px] shadow-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={handleClearData}
                  className="flex-1 bg-red-600 text-white text-[10px] font-medium py-2 rounded-[8px] shadow-sm"
                >
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
