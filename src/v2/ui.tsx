import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';
import { cn } from '../utils/cn';

/* ============================================================
   Общие примитивы fresh-дизайна. Живут отдельно от классики,
   чтобы переключатель дизайна ничего не ломал в старых экранах.
   ============================================================ */

/** Плавный «докручивающийся» счётчик (easeOutExpo) для чисел калорий. */
export function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 800;
    const startValue = fromRef.current;
    const endValue = value;
    if (startValue === endValue) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.floor(startValue + (endValue - startValue) * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = endValue;
        setDisplayValue(endValue);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{displayValue}</>;
}

/**
 * Кольцо прогресса fresh: градиентный штрих со скруглёнными краями,
 * мягкое свечение, spring-анимация заполнения. В центре — children.
 */
export function FreshRing({
  progress,
  size = 190,
  stroke = 11,
  tone = 'normal',
  children,
}: {
  progress: number; // 0..100
  size?: number;
  stroke?: number;
  /** 'over' — превышение дневной цели: штрих становится янтарно-красным. */
  tone?: 'normal' | 'over';
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);
  const gradId = tone === 'over' ? 'freshRingGradOver' : 'freshRingGrad';
  // Кольцо «оживает»: при достижении цели (зелёный) или переборе (красный)
  // ореол под ним пульсирует — тактильный визуальный отклик на результат.
  const celebrate = tone !== 'over' && progress >= 100;
  const alive = tone === 'over' || celebrate;
  const glowColor =
    tone === 'over'
      ? 'color-mix(in srgb, var(--f-danger) 26%, transparent)'
      : celebrate
        ? 'color-mix(in srgb, var(--f-accent) 32%, transparent)'
        : 'var(--f-ambient-a)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Свечение под кольцом — пульсирует при цели/переборе, иначе статично. */}
      {alive ? (
        <motion.div
          className="absolute inset-3 rounded-full blur-2xl"
          style={{ background: glowColor }}
          animate={{ opacity: [0.35, 0.72, 0.35], scale: [1, 1.07, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <div className="absolute inset-3 rounded-full blur-2xl opacity-40" style={{ background: glowColor }} />
      )}
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id="freshRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--f-accent)" />
            <stop offset="100%" stopColor="var(--f-accent-strong)" />
          </linearGradient>
          <linearGradient id="freshRingGradOver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--f-warn)" />
            <stop offset="100%" stopColor="var(--f-danger)" />
          </linearGradient>
        </defs>
        {/* Трек */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--f-line)"
          strokeWidth={stroke}
        />
        {/* Прогресс — анимируем strokeDashoffset spring'ом. */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          style={{ filter: 'drop-shadow(0 0 6px var(--f-ambient-a))' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Модалка fresh: центрированная, spring-появление, затемнение с blur.
 * Клик по фону закрывает; контент — stopPropagation внутри.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-5"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]" />
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative bg-surface rounded-[26px] shadow-lift w-full p-6 border border-line/50',
              wide ? 'max-w-md' : 'max-w-sm',
            )}
          >
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-ink text-[15px]">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-surface-2 text-ink-faint hover:text-ink transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Мелкая uppercase-подпись секций — фирменный приём fresh. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Кнопки
   ============================================================ */

/** Главная кнопка — градиент акцента + glow. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full bg-gradient-to-br from-accent to-accent-strong text-white text-sm font-bold py-3.5 rounded-2xl',
        'shadow-glow hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60',
        'flex items-center justify-center gap-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Второстепенная кнопка — поверхность с границей. */
export function GhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full bg-surface text-ink-soft text-sm font-bold py-3.5 rounded-2xl',
        'shadow-soft border border-line/50 hover:bg-surface-2 active:scale-[0.98] transition-all disabled:opacity-60',
        'flex items-center justify-center gap-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Тост с действием (например, «Отменить» после удаления)
   ============================================================ */
export function Toast({
  show,
  message,
  actionLabel,
  onAction,
}: {
  show: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-28 inset-x-0 z-[70] flex justify-center px-5 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-2 bg-ink text-canvas pl-4 pr-1.5 py-2 rounded-2xl shadow-lift max-w-sm">
            <span className="text-xs font-medium">{message}</span>
            {actionLabel && (
              <button
                onClick={onAction}
                className="text-accent font-bold text-xs px-3 py-1.5 rounded-xl hover:bg-canvas/10 transition-colors whitespace-nowrap"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   Каркас экрана-инструмента (вода, холодильник, меню и т.д.)
   ============================================================ */
export function ToolShell({
  onBack,
  icon: Icon,
  accent = 'var(--f-accent)',
  title,
  description,
  children,
}: {
  onBack: () => void;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-surface shadow-soft border border-line/40 hover:text-accent transition-colors active:scale-90 shrink-0"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4.5 h-4.5 text-ink" />
        </button>
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink leading-tight">
            {title}
          </h2>
        </div>
      </div>
      {description && (
        <p className="text-xs text-ink-soft leading-relaxed -mt-1">{description}</p>
      )}
      {children}
    </div>
  );
}

/* ============================================================
   Сегментированный переключатель со скользящей пилюлей
   ============================================================ */
export function Segmented<const T extends string>({
  groupId,
  options,
  value,
  onChange,
}: {
  groupId: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-2 border border-line/50 rounded-2xl">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 py-2 rounded-xl text-xs font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 bg-surface rounded-xl shadow-soft border border-line/40"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Пустое состояние с иконкой и опциональным CTA
   ============================================================ */
export function EmptyState({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="text-center py-10 px-6 bg-surface rounded-[24px] border border-dashed border-line shadow-soft">
      <Icon className="w-7 h-7 text-ink-faint mx-auto mb-2.5" />
      <p className="text-sm text-ink-faint">{text}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl bg-accent-soft text-accent text-xs font-bold hover:brightness-105 active:scale-95 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
