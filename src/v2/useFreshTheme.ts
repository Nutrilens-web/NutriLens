import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Хук-мост между настройкой design и CSS-токенами (index.css).
 *
 * design === 'fresh':
 *   - ставит data-design="fresh" на <html>;
 *   - включает data-theme="light"|"dark" по системной теме
 *     (prefers-color-scheme) и следит за её сменой в реальном времени —
 *     пользователь переключит тёмную тему в ОС, приложение перекрасится
 *     мгновенно, без перезагрузки.
 *
 * design === 'classic' (или не задан):
 *   - data-theme="light" принудительно: классические экраны используют
 *     дефолтную палитру Tailwind и рассчитаны только на светлый фон.
 *     Токены fresh при этом определены, но никем не используются.
 *
 * Хук вызывается один раз в корне (App.tsx) — до рендера экранов,
 * чтобы первая отрисовка уже была в правильной теме (без вспышки).
 */
export function useFreshTheme(): 'classic' | 'fresh' {
  const { settings } = useStore();
  const design: 'classic' | 'fresh' = settings.design === 'fresh' ? 'fresh' : 'classic';

  useEffect(() => {
    const root = document.documentElement;

    if (design !== 'fresh') {
      root.removeAttribute('data-design');
      root.setAttribute('data-theme', 'light');
      return;
    }

    root.setAttribute('data-design', 'fresh');
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [design]);

  return design;
}
