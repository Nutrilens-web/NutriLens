import React from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  Settings as SettingsIcon,
  Home,
  BarChart3,
  Sparkles,
  LayoutGrid,
  Leaf,
} from 'lucide-react';
import { cn } from '../utils/cn';
import type { Screen } from '../App';

/**
 * FreshShell — оболочка нового дизайна: амбиентный фон, «прозрачная» шапка
 * с вордмарком и плавающий док-навигация со скользящим индикатором.
 *
 * Логика навигации и экраны — те же, что в классике (App.tsx передаёт их
 * сюда), отличается только отрисовка. Это позволяет переключать дизайн
 * в настройках без дублирования бизнес-логики.
 */

interface NavItem {
  key: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Порядок как в классике: Дневник · Отчёт · [FAB] · Ассистент · Настройки.
const LEFT: NavItem[] = [
  { key: 'dashboard', label: 'Дневник', icon: Home },
  { key: 'stats', label: 'Отчёт', icon: BarChart3 },
];
const RIGHT: NavItem[] = [
  { key: 'assistant', label: 'Ассистент', icon: Sparkles },
  { key: 'settings', label: 'Настройки', icon: SettingsIcon },
];

// Экраны без дока (полноэкранные режимы) — совпадает с FULLSCREEN_SCREENS в App.
const isFullscreen = (s: Screen) => s === 'add';

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-2xl transition-colors',
        active ? 'text-accent' : 'text-ink-faint hover:text-ink-soft',
      )}
    >
      {/* Скользящая подложка активного пункта (layoutId — общий на весь док,
          поэтому пилюля «перелетает» между вкладками со spring-физикой). */}
      {active && (
        <motion.span
          layoutId="fresh-nav-pill"
          className="absolute inset-0 rounded-2xl bg-accent-soft"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      )}
      <Icon className="w-5 h-5 relative z-10" />
      <span
        className={cn(
          'text-[10px] relative z-10 transition-all',
          active ? 'font-semibold' : 'font-medium',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

export function FreshShell({
  currentScreen,
  onNavigate,
  shouldPulseFAB,
  children,
}: {
  currentScreen: Screen;
  onNavigate: (s: Screen) => void;
  shouldPulseFAB: boolean;
  children: React.ReactNode;
}) {
  const fullscreen = isFullscreen(currentScreen);
  const onMore = currentScreen === 'more';

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden fresh-ambient text-ink font-body relative">
      {/* Живой амбиентный фон: два мягких свечения медленно дрейфуют
          (keyframes drift-*), создавая глубину и «дыхание» вместо статики. */}
      <div
        className="fresh-glow fresh-glow-a"
        style={{ top: '-130px', right: '-90px', width: '440px', height: '440px' }}
      />
      <div
        className="fresh-glow fresh-glow-b"
        style={{ top: '40%', left: '-130px', width: '380px', height: '380px' }}
      />

      {/* Шапка — прозрачная, сквозь неё просвечивает амбиентный фон.
          Вордмарк в Manrope, дата в Golos. Кнопка «Ещё» — как в классике. */}
      <header className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-strong flex items-center justify-center shadow-glow">
            <Leaf className="w-4.5 h-4.5 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-display text-[17px] font-extrabold tracking-tight leading-none">
              NutriLens
            </h1>
            <p className="text-[11px] text-ink-faint mt-1 capitalize">
              {new Date().toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('more')}
          aria-label="Ещё инструменты"
          className={cn(
            'p-2.5 rounded-full transition-all active:scale-90',
            onMore
              ? 'bg-accent text-white shadow-glow'
              : 'bg-surface text-ink-soft shadow-soft hover:text-accent',
          )}
        >
          <LayoutGrid className="w-4.5 h-4.5" />
        </button>
      </header>

      {/* Контент — собственный скролл. pb-36 освобождает место под плавающий
          док; на полноэкранных (add) док скрыт и отступ не нужен. */}
      <main className="flex-1 overflow-y-auto hide-scrollbar relative z-10">
        <div
          className={cn(
            'max-w-md mx-auto w-full px-5 pt-1',
            fullscreen ? 'pb-8' : 'pb-36',
          )}
        >
          {children}
        </div>
      </main>

      {/* Плавающий док: парит над низом экрана, скруглён, с lift-тенью.
          FAB по центру приподнят и залит градиентом акцента. */}
      {!fullscreen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
          className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none"
        >
          <nav className="pointer-events-auto w-[calc(100%-2.5rem)] max-w-[26rem] mb-5 rounded-[26px] bg-surface/95 backdrop-blur-md shadow-lift border border-line/60 px-2 pt-1.5 pb-2 flex items-end justify-between relative">
            {LEFT.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={currentScreen === item.key}
                onClick={() => onNavigate(item.key)}
              />
            ))}

            {/* FAB — камера. Приподнят над доком, градиент + glow-тень.
                Пульсирует, пока за сегодня нет ни одной записи. */}
            <button
              onClick={() => onNavigate('add')}
              aria-label="Добавить еду"
              className={cn(
                'relative -top-7 mx-1 w-16 h-16 rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-accent to-accent-strong text-white shadow-glow',
                'transition-transform active:scale-90 hover:brightness-105',
                shouldPulseFAB && 'animate-[pulse-glow_2.2s_ease-in-out_infinite]',
              )}
            >
              <Camera className="w-6 h-6" />
            </button>

            {RIGHT.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={currentScreen === item.key}
                onClick={() => onNavigate(item.key)}
              />
            ))}
          </nav>
        </motion.div>
      )}
    </div>
  );
}
