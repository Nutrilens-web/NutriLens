/**
 * Тактильная отдача (Vibration API). На смартфонах даёт лёгкий «клик» на
 * ключевых действиях — ощущается премиально. На десктопе/без поддержки
 * просто no-op. Все вызовы обёрнуты в try/catch: некоторые браузеры кидают
 * исключение при navigator.vibrate в отдельных контекстах.
 */

type HapticKind = 'light' | 'medium' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,          // переключатели, вкладки
  medium: 16,        // кнопки-CTA, FAB
  success: [12, 40, 24], // успешное сохранение/добавление
  error: [30, 50, 30],   // ошибка, деструктивное действие
};

export function haptic(kind: HapticKind = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    /* no-op */
  }
}
