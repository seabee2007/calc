import React from 'react';
import type { ConvUnit, FractionPrecision } from '../domain/constructionCalculatorTypes';
import { FRACTION_PRECISIONS } from '../domain/constructionCalculatorTypes';
import { TEXT_MUTED } from '../../../../theme/appTheme';

interface ConstructionDisplayProps {
  display: string;
  modeHint?: string | null;
  error?: string | null;
  precision: FractionPrecision;
  onPrecisionChange: (precision: FractionPrecision) => void;
  layout: 'desktop' | 'field';
  activeSlotLabel?: string | null;
  memoryHasValue?: boolean;
  convUnit?: ConvUnit;
  convActive?: boolean;
}

export default function ConstructionDisplay({
  display,
  modeHint,
  error,
  precision,
  onPrecisionChange,
  layout,
  activeSlotLabel,
  memoryHasValue = false,
  convUnit,
  convActive = false,
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
      {activeSlotLabel && (
        <p
          className="truncate text-right text-xs font-semibold uppercase text-cyan-400"
          data-testid="calculator-active-slot-label"
        >
          {activeSlotLabel}
        </p>
      )}
      {(modeHint || memoryHasValue) && (
        <div className="flex items-center justify-end gap-2">
          {memoryHasValue && (
            <span className="text-xs font-bold text-emerald-400" data-testid="display-memory-indicator">
              M
            </span>
          )}
          {modeHint && (
            <p
              className={`truncate text-xs font-medium ${
                isField ? 'text-cyan-400/90' : 'text-cyan-700 dark:text-cyan-400'
              }`}
              data-testid="calculator-mode-hint"
            >
              {modeHint}
            </p>
          )}
        </div>
      )}
      <p
        className={`truncate text-right font-mono font-semibold tracking-tight ${
          isField ? 'text-3xl text-white' : 'text-2xl sm:text-3xl text-slate-900 dark:text-white'
        }`}
        data-testid="calculator-display"
      >
        {display}
        {convActive && convUnit && (
          <span className="ml-2 text-xs font-normal text-amber-400" data-testid="conv-unit-badge">
            {convUnit}
          </span>
        )}
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
