import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Следит за обновлениями service worker'а и показывает всплывающее
 * уведомление, когда на сервере появилась новая версия оболочки PWA.
 *
 * Раньше SW обновлялся в фоне (registerType: 'autoUpdate'), но приложение
 * об этом не узнавало — пользователь сидел на старой версии, пока не закрыл
 * все вкладки. Теперь при onNeedRefresh показывается тост с кнопкой
 * «Обновить»: один клик → updateSW(true) перезагружает страницу на новом SW.
 */
export function PWAUpdate() {
  const [hidden, setHidden] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration failed:', error);
    },
  });

  // Автоскрытие через 8 секунд для уведомления «готово к оффлайну» —
  // оно информационное, кнопок не требует.
  useEffect(() => {
    if (offlineReady) {
      const t = setTimeout(() => setOfflineReady(false), 8000);
      return () => clearTimeout(t);
    }
  }, [offlineReady, setOfflineReady]);

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
    setHidden(true);
  };

  // Скрываем тост, если приложение в фоне — перерисовка не нужна,
  // обновление всё равно дождётся onNeedRefresh при возврате.
  const visible = !hidden && (needRefresh || offlineReady);
  if (!visible) return null;

  const reload = () => updateServiceWorker(true);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-[slide-up_0.25s_ease-out]">
      <div className="bg-gray-900 text-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            {needRefresh ? 'Доступна новая версия 🎉' : 'Приложение готово к работе офлайн ✓'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
            {needRefresh ? 'Обновите, чтобы получить последние изменения.' : 'Кэш сохранён, можно пользоваться без интернета.'}
          </p>
        </div>

        {needRefresh && (
          <button
            onClick={reload}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-medium px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить
          </button>
        )}

        <button
          onClick={close}
          aria-label="Закрыть"
          className="shrink-0 p-1 -m-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
