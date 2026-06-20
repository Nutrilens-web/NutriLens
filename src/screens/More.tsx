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

interface ToolLink {
  screen: Screen;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const TOOLS: ToolLink[] = [
  {
    screen: 'water',
    label: 'Водный баланс',
    description: 'Норма воды и советы',
    icon: Droplets,
    color: 'text-sky-600',
    bg: 'bg-sky-100',
  },
  {
    screen: 'fridge',
    label: 'Разбор холодильника',
    description: 'Рецепты из того, что есть',
    icon: ChefHat,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    screen: 'grocery',
    label: 'Список покупок',
    description: 'ИИ-список на неделю',
    icon: ShoppingCart,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
  {
    screen: 'habits',
    label: 'Разбор привычек',
    description: 'Причины и решения',
    icon: Activity,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
  },
  {
    screen: 'menu',
    label: 'Выбор в ресторане',
    description: 'Подбор блюд из меню',
    icon: Utensils,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  {
    screen: 'recommendations',
    label: 'Идеи для еды',
    description: 'Подбор блюд и рецептов',
    icon: Lightbulb,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
  },
  {
    screen: 'chat',
    label: 'ИИ-Диетолог',
    description: 'Чат с ассистентом',
    icon: Bot,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
];

const SHORTCUTS: ToolLink[] = [
  {
    screen: 'stats',
    label: 'Статистика',
    description: 'Отчёты и графики',
    icon: BarChart3,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
  {
    screen: 'assistant',
    label: 'Ассистент',
    description: 'Быстрый анализ дня',
    icon: Sparkles,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
];

export function MoreScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const renderCard = (tool: ToolLink) => {
    const Icon = tool.icon;
    return (
      <button
        key={tool.screen}
        onClick={() => onNavigate(tool.screen)}
        className="flex flex-col items-start gap-2 bg-white rounded-[16px] p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left"
      >
        <div className={`${tool.bg} p-2 rounded-[12px]`}>
          <Icon className={`w-5 h-5 ${tool.color}`} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-gray-900 leading-tight">{tool.label}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{tool.description}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3 px-1">Ещё инструменты</h2>
        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map(renderCard)}
          {TOOLS.map(renderCard)}
        </div>
      </div>
    </div>
  );
}