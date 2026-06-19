// Локальная дата (без сдвига часового пояса).
// Раньше в качестве даты приема пищи использовался
// `new Date().toISOString().split('T')[0]`, что дает UTC-дату. Для поясов
// с положительным смещением (Россия UTC+2..+12) еда после полуночи по
// местному времени помечалась вчерашней датой. Этих функций надо
// придерживаться везде, где дата сравнивается/хранится как YYYY-MM-DD.

/** Возвращает строку YYYY-MM-DD для локальной даты (по умолчанию «сейчас»). */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Парсит строку YYYY-MM-DD как локальную дату (а не как UTC-полночь). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
