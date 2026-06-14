import React from 'react';
import type { FractionPrecision } from '../domain/constructionCalculatorTypes';
import { FRACTION_PRECISIONS } from '../domain/constructionCalculatorTypes';
import { TEXT_MUTED } from '../../../../theme/appTheme';

interface ConstructionDisplayProps {
  display: string;
  expression?: string;
  error?: string | null;
  precision: FractionPrecision;
  onPrecisionChange: (precision: FractionPrecision) => void;
  layout: 'desktop' | 'field';
}

export default function ConstructionDisplay({
  display,
  expression,
  error,
  precision,
  onPrecisionChange,
  layout,
}: ConstructionDisplayProps) {
  const isField = layout === 'field';

  return (
    <div
      className={
        isField
          ? 'sticky top-0 z-10 -mx-4 border-b border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur-sm'
          : 'mb-4'
      }
    >
      {expression && (
        <p className={`truncate text-right text-sm ${TEXT_MUTED} ${isField ? 'text-slate-400' : ''}`}>
          {expression}
        </p>
      )}
      <p
        className={`truncate text-right font-mono font-semibold tracking-tight ${
          isField ? 'text-3xl text-white' : 'text-2xl sm:text-3xl text-slate-900 dark:text-white'
        }`}
        data-testid="calculator-display"
      >
        {display}
      </p>
      {error && (
        <p className="mt-1 text-right text-sm text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className={`mt-2 flex flex-wrap items-center gap-2 ${isField ? 'justify-end' : ''}`}>
        <span className={`text-xs ${TEXT_MUTED} ${isField ? 'text-slate-500' : ''}`}>Precision:</span>
        {FRACTION_PRECISIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrecisionChange(p)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              precision === p
                ? 'bg-cyan-600 text-white'
                : isField
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            1/{p}
          </button>
        ))}
      </div>
    </div>
  );
}
