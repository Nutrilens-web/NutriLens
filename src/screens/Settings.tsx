import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { ArrowLeft, Trash2, Download, Upload } from 'lucide-react';

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
    localStorage.removeItem('nutrilens_meals');
    localStorage.removeItem('nutrilens_weights');
    window.location.reload();
  };

  const handleExport = () => {
    const data = {
      settings: localStorage.getItem('nutrilens_settings'),
      meals: localStorage.getItem('nutrilens_meals'),
      favorites: localStorage.getItem('nutrilens_favorites'),
      weights: localStorage.getItem('nutrilens_weights')
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrilens_backup_${new Date().toISOString().split('T')[0]}.json`;
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
          <p className="text-[10px] text-gray-400 mt-1.5">Хранится только на вашем устройстве.</p>
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
            placeholder="Опишите себя, свою посуду, типичные порции..."
          />
          <p className="text-[10px] text-gray-400 mt-1.5">Это поможет ИИ точнее оценивать порции.</p>
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
