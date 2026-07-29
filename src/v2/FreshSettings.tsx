import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { ArrowLeft, Trash2, Download, Upload, Palette, Sparkles, KeyRound, Target, User, Cpu, Globe } from 'lucide-react';
import { getLocalDateString } from '../utils/date';
import { cn } from '../utils/cn';
import { SectionLabel, PrimaryButton } from './ui';
import { haptic } from './haptics';

/* ============================================================
   FreshSettings — настройки в новом дизайне. Логика идентична
   классике (localSettings + сохранение по кнопке, экспорт/импорт,
   очистка). Переключатель дизайна применяется мгновенно.
   ============================================================ */

function Card({ icon: Icon, title, children }: { icon?: React.ComponentType<{ className?: string }>; title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-[24px] p-5 shadow-soft border border-line/40 space-y-5">
      {title && (
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="w-7 h-7 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-accent" />
            </span>
          )}
          <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-sm text-ink',
        'focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all placeholder:text-ink-faint',
        props.className,
      )}
    />
  );
}

export function FreshSettings({ onBack }: { onBack: () => void }) {
  const { settings, setSettings } = useStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    setSettings(localSettings);
    haptic('success');
    onBack();
  };

  const design: 'classic' | 'fresh' = settings.design === 'fresh' ? 'fresh' : 'classic';
  const setDesign = (d: 'classic' | 'fresh') => {
    setSettings({ ...settings, design: d });
    setLocalSettings((prev) => ({ ...prev, design: d }));
    haptic('light');
  };

  const handleClearData = () => {
    localStorage.removeItem('nutrilens_settings');
    localStorage.removeItem('nutrilens_meals');
    localStorage.removeItem('nutrilens_favorites');
    localStorage.removeItem('nutrilens_weights');
    localStorage.removeItem('nutrilens_grocery');
    localStorage.removeItem('nutrilens_grocery_checked');
    localStorage.removeItem('nutrilens_chat_history');
    localStorage.removeItem('nutrilens_water');
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
      chat_history: localStorage.getItem('nutrilens_chat_history'),
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
      } catch {
        alert('Ошибка при импорте данных. Проверьте формат файла.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-surface shadow-soft border border-line/40 hover:text-accent transition-colors active:scale-90"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4.5 h-4.5 text-ink" />
        </button>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Настройки</h2>
      </div>

      {/* Оформление */}
      <Card icon={Palette} title="Оформление">
        <p className="text-[10px] text-ink-faint -mt-2">
          Новый дизайн — экспериментальный. Тёмная тема включается автоматически по настройке системы.
        </p>
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 border border-line/50 rounded-2xl">
          <button
            onClick={() => setDesign('classic')}
            className={cn(
              'flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-all',
              design === 'classic' ? 'bg-surface text-ink shadow-soft border border-line/50' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            <span className="text-base">🌿</span>
            Классический
          </button>
          <button
            onClick={() => setDesign('fresh')}
            className={cn(
              'flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-all',
              design === 'fresh' ? 'bg-surface text-accent shadow-soft border border-accent-ring' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            <Sparkles className="w-4 h-4" />
            Новый дизайн
          </button>
        </div>
      </Card>

      {/* Цели */}
      <Card icon={Target} title="Цели">
        <div>
          <SectionLabel className="mb-1.5">Дневная норма калорий</SectionLabel>
          <TextInput
            type="number"
            value={localSettings.dailyGoal}
            onChange={(e) => setLocalSettings({ ...localSettings, dailyGoal: Number(e.target.value) })}
          />
        </div>
        <div>
          <SectionLabel className="mb-1.5">Цели по макронутриентам (г)</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'proteinGoal', label: 'Белки', color: 'var(--f-protein)' },
              { key: 'fatGoal', label: 'Жиры', color: 'var(--f-fat)' },
              { key: 'carbsGoal', label: 'Углеводы', color: 'var(--f-carbs)' },
            ] as const).map((m) => (
              <div key={m.key}>
                <span className="text-[10px] font-medium ml-1 block mb-1" style={{ color: m.color }}>{m.label}</span>
                <TextInput
                  type="number"
                  placeholder="—"
                  value={(localSettings as any)[m.key] || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, [m.key]: Number(e.target.value) || undefined })}
                  className="text-center"
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Профиль */}
      <Card icon={User} title="Мой контекст">
        <textarea
          value={localSettings.userContext}
          onChange={(e) => setLocalSettings({ ...localSettings, userContext: e.target.value })}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all resize-none placeholder:text-ink-faint"
          placeholder="Опишите себя и типичные порции (например: мужчина, 85 кг, жарю на 5г масла)."
        />
        <p className="text-[10px] text-ink-faint -mt-2">ИИ сам оценивает размер порции по предметам на фото — описывать посуду не обязательно.</p>
      </Card>

      {/* Нейросеть */}
      <Card icon={Cpu} title="Нейросеть">
        <div>
          <SectionLabel className="mb-1.5">Режим работы</SectionLabel>
          <select
            value={localSettings.apiMode || 'free'}
            onChange={(e) => setLocalSettings({ ...localSettings, apiMode: e.target.value as any })}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-2 border border-line/60 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
          >
            <option value="free">Бесплатно (свой API ключ)</option>
            <option value="simple">Простой (быстрый анализ через Nano)</option>
            <option value="advanced">Продвинутый (глубокий анализ через Nano)</option>
          </select>
        </div>
        <div>
          <SectionLabel className="mb-1.5 flex items-center gap-1"><KeyRound className="w-3 h-3" /> API Ключ Gemini</SectionLabel>
          <TextInput
            type="password"
            value={localSettings.apiKey}
            placeholder="AIzaSy..."
            onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
          />
          <p className="text-[10px] text-ink-faint mt-1.5">Хранится только на вашем устройстве. Нужен для бесплатного режима.</p>
        </div>
        <div>
          <SectionLabel className="mb-1.5 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Ключ NanoGPT</SectionLabel>
          <TextInput
            type="password"
            value={localSettings.nanoApiKey || ''}
            placeholder="sk-nano-..."
            onChange={(e) => setLocalSettings({ ...localSettings, nanoApiKey: e.target.value })}
          />
          <p className="text-[10px] text-ink-faint mt-1.5">Нужен для режимов «Простой» и «Продвинутый».</p>
        </div>
      </Card>

      {/* Прокси */}
      <Card icon={Globe} title="Прокси / обход блокировок">
        <p className="text-[10px] text-ink-faint -mt-2">
          Если приложение не может связаться с нейросетями — поднимите бесплатный прокси.
          Инструкция — в файле <code className="text-ink-soft">proxy/README.md</code>. Если всё работает — поля оставьте пустыми.
        </p>
        <div>
          <SectionLabel className="mb-1.5">URL прокси для Gemini</SectionLabel>
          <TextInput
            type="url"
            value={localSettings.geminiApiEndpoint || ''}
            placeholder="https://my-worker.workers.dev"
            onChange={(e) => setLocalSettings({ ...localSettings, geminiApiEndpoint: e.target.value })}
          />
        </div>
        <div>
          <SectionLabel className="mb-1.5">URL прокси для NanoGPT</SectionLabel>
          <TextInput
            type="url"
            value={localSettings.nanoApiEndpoint || ''}
            placeholder="https://nano-gpt.com"
            onChange={(e) => setLocalSettings({ ...localSettings, nanoApiEndpoint: e.target.value })}
          />
        </div>
      </Card>

      <PrimaryButton onClick={handleSave}>Сохранить настройки</PrimaryButton>

      {/* Данные */}
      <Card title="Управление данными">
        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 bg-surface-2 border border-line/60 text-ink-soft text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Экспорт
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-surface-2 border border-line/60 text-ink-soft text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Импорт
          </button>
        </div>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full bg-danger/10 text-danger text-xs font-semibold py-2.5 rounded-xl hover:bg-danger/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Очистить дневник (освободить память)
          </button>
        ) : (
          <div className="bg-danger/10 border border-danger/20 p-3.5 rounded-2xl space-y-3">
            <p className="text-[10px] text-danger text-center font-semibold">Точно удалить все записи? Это нельзя отменить.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-surface text-ink-soft text-[10px] font-semibold py-2 rounded-xl shadow-soft">
                Отмена
              </button>
              <button onClick={handleClearData} className="flex-1 bg-danger text-white text-[10px] font-semibold py-2 rounded-xl shadow-soft">
                Удалить
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
