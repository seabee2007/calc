import React from 'react';
import type { CalculatorFunctionTab } from '../domain/constructionCalculatorTypes';

interface ConstructionFunctionTabsProps {
  activeTab: CalculatorFunctionTab;
  onTabChange: (tab: CalculatorFunctionTab) => void;
  layout: 'desktop' | 'field';
}

const TABS: { id: CalculatorFunctionTab; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'area', label: 'Area' },
  { id: 'volume', label: 'Volume' },
  { id: 'board-feet', label: 'Board Ft' },
  { id: 'concrete', label: 'Concrete' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'drywall', label: 'Drywall' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'conversions', label: 'Convert' },
];

export default function ConstructionFunctionTabs({
  activeTab,
  onTabChange,
  layout,
}: ConstructionFunctionTabsProps) {
  const isField = layout === 'field';

  return (
    <div
      className={`mb-4 flex gap-1 overflow-x-auto pb-1 ${isField ? '' : ''}`}
      role="tablist"
      data-testid="function-tabs"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
            activeTab === tab.id
              ? 'bg-cyan-600 text-white'
              : isField
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
