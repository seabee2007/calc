import React from 'react';
import type { CalculatorFunctionTab } from '../domain/constructionCalculatorTypes';
import { CALCULATOR_MODULES } from '../domain/constructionCalculatorModules';

interface ConstructionFunctionTabsProps {
  activeTab: CalculatorFunctionTab;
  onTabChange: (tab: CalculatorFunctionTab) => void;
  layout: 'desktop' | 'field';
}

// Derived from the shared module registry so tabs and help cannot drift apart.
const TABS: { id: CalculatorFunctionTab; label: string }[] = CALCULATOR_MODULES.map((m) => ({
  id: m.tab,
  label: m.label,
}));

export default function ConstructionFunctionTabs({
  activeTab,
  onTabChange,
  layout,
}: ConstructionFunctionTabsProps) {
  const isField = layout === 'field';

  return (
    <div
      className={`mb-4 flex gap-1 overflow-x-auto pb-1 ${isField ? 'no-scrollbar' : ''}`}
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
