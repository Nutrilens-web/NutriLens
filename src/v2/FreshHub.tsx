import React from 'react';
import {
  Droplets,
  ChefHat,
  ShoppingCart,
  Activity,
  Utensils,
  Lightbulb,
  Bot,
  BarChart3,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Screen } from '../App';
import { SectionLabel } from './ui';
import { haptic } from './haptics';

/* ============================================================
   FreshHub — единый хаб инструментов (заменяет и «Ассистент», и
   «Ещё» в новом дизайне: они дублировали друг друга). Категоризованная
   сетка карточек, навигация через onNavigate (App роутит на fresh-
   инструменты). Акценты — на дизайн-токенах.
   ============================================================ */

interface ToolLink {
  screen: Screen;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string; // CSS-цвет из токенов
}

const FOOD: ToolLink[] = [
  { screen: 'chat', label: 'Чат с диетологом', description: 'Вопросы и советы', icon: Bot, accent: 'var(--f-accent)' },
  { screen: 'recommendations', label: 'Идеи для еды', description: 'Подбор блюд и рецептов', icon: Lightbulb, accent: 'var(--f-fat)' },
  { screen: 'fridge', label: 'Разбор холодильника', description: 'Фото продуктов → рецепт', icon: ChefHat, accent: 'var(--f-protein)' },
];

const TRACK: ToolLink[] = [
  { screen: 'water', label: 'Водный баланс', description: 'Трекер и норма воды', icon: Droplets, accent: 'var(--f-protein)' },
  { screen: 'menu', label: 'Выбор в ресторане', description: 'Подбор блюд из меню', icon: Utensils, accent: 'var(--f-carbs)' },
  { screen: 'habits', label: 'Разбор привычек', description: 'Причины и решения', icon: Activity, accent: 'var(--f-danger)' },
];

const ORG: ToolLink[] = [
  { screen: 'grocery', label: 'Список покупок', description: 'ИИ-меню и корзина на неделю', icon: ShoppingCart, accent: 'var(--f-accent)' },
  { screen: 'stats', label: 'Статистика', description: 'Отчёты и графики', icon: BarChart3, accent: 'var(--f-accent)' },
];

function ToolCard({ tool, onNavigate, wide = false }: { tool: ToolLink; onNavigate: (s: Screen) => void; wide?: boolean }) {
  const Icon = tool.icon;
  return (
    <button
      onClick={() => {
        haptic('light');
        onNavigate(tool.screen);
      }}
      className={
        'group bg-surface rounded-[20px] p-4 shadow-soft border border-line/40 flex items-center gap-3.5 text-left ' +
        'hover:shadow-card hover:border-accent-ring active:scale-[0.98] transition-all ' +
        (wide ? 'w-full' : 'flex-col items-start gap-2.5')
      }
    >
      <div
        className="p-2.5 rounded-2xl shrink-0 transition-transform group-hover:scale-105"
        style={{ background: `color-mix(in srgb, ${tool.accent} 15%, transparent)` }}
      >
        <Icon className="w-5 h-5" style={{ color: tool.accent }} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold text-ink leading-tight">{tool.label}</h3>
        <p className="text-[11px] text-ink-faint mt-0.5 leading-snug">{tool.description}</p>
      </div>
    </button>
  );
}

export function FreshHub({
  onNavigate,
  title,
  icon: Icon = Sparkles,
}: {
  onNavigate: (s: Screen) => void;
  title: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6 pb-6">
      <h2 className="font-display text-[26px] font-extrabold tracking-tight text-ink px-0.5 flex items-center gap-2">
        <Icon className="w-6 h-6 text-accent" />
        {title}
      </h2>

      <div>
        <SectionLabel className="mb-3 px-0.5">Еда и рецепты</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {FOOD.slice(0, 2).map((t) => (
            <ToolCard key={t.screen} tool={t} onNavigate={onNavigate} />
          ))}
          <div className="col-span-2">
            <ToolCard tool={FOOD[2]} onNavigate={onNavigate} wide />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel className="mb-3 px-0.5">Анализ и трекинг</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {TRACK.slice(0, 2).map((t) => (
            <ToolCard key={t.screen} tool={t} onNavigate={onNavigate} />
          ))}
          <div className="col-span-2">
            <ToolCard tool={TRACK[2]} onNavigate={onNavigate} wide />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel className="mb-3 px-0.5">Организация</SectionLabel>
        <div className="space-y-3">
          {ORG.map((t) => (
            <ToolCard key={t.screen} tool={t} onNavigate={onNavigate} wide />
          ))}
        </div>
      </div>
    </div>
  );
}
