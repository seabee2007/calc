import React from 'react';
import type { KeypadKey } from '../domain/constructionCalculatorTypes';
import { Delete, RotateCcw } from 'lucide-react';

interface ConstructionKeypadProps {
  onKeyPress: (key: KeypadKey) => void;
  layout: 'desktop' | 'field';
}

const ROWS: { key: KeypadKey; label: string; className?: string }[][] = [
  [
    { key: '7', label: '7' },
    { key: '8', label: '8' },
    { key: '9', label: '9' },
    { key: '÷', label: '÷' },
  ],
  [
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
    { key: '×', label: '×' },
  ],
  [
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
    { key: '-', label: '−' },
  ],
  [
    { key: '0', label: '0' },
    { key: 'ft', label: 'FT' },
    { key: 'in', label: 'IN' },
    { key: '+', label: '+' },
  ],
  [
    { key: 'frac', label: 'FRAC', className: 'col-span-1' },
    { key: 'backspace', label: '⌫' },
    { key: 'clear', label: 'CLR' },
    { key: 'equals', label: '=' },
  ],
];

export default function ConstructionKeypad({ onKeyPress, layout }: ConstructionKeypadProps) {
  const isField = layout === 'field';
  const keyHeight = isField ? 'min-h-[52px]' : 'min-h-[44px]';
  const keyText = isField ? 'text-lg' : 'text-base';

  return (
    <div
      className={`grid grid-cols-4 gap-2 ${isField ? 'pb-2' : ''}`}
      data-testid="construction-keypad"
    >
      {ROWS.flat().map(({ key, label, className }) => (
        <button
          key={key}
          type="button"
          onClick={() => onKeyPress(key)}
          className={`${keyHeight} ${keyText} ${className ?? ''} flex items-center justify-center rounded-lg font-semibold transition-colors ${
            key === 'equals'
              ? 'bg-cyan-600 text-white hover:bg-cyan-500 active:bg-cyan-700'
              : key === 'clear' || key === 'backspace'
                ? isField
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                : isField
                  ? 'border border-slate-600 bg-slate-800 text-white hover:border-cyan-500/50 hover:bg-slate-700'
                  : 'border border-slate-200 bg-white text-slate-800 hover:border-cyan-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-cyan-500/50 dark:hover:bg-slate-700'
          }`}
          aria-label={
            key === 'backspace' ? 'Backspace' : key === 'clear' ? 'Clear' : label
          }
        >
          {key === 'backspace' ? <Delete className="h-5 w-5" /> : null}
          {key === 'clear' ? <RotateCcw className="h-5 w-5" /> : null}
          {key !== 'backspace' && key !== 'clear' ? label : null}
        </button>
      ))}
    </div>
  );
}
