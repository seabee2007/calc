import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TEXT_MUTED } from '../../../../theme/appTheme';

interface DimensionEntryHelpProps {
  layout: 'desktop' | 'field';
}

const EXAMPLES = [
  '23 FT 2 IN × 3 =',
  '12 FT 6 IN FRACTION 3/4 =',
  '8 IN FRACTION 1/2 =',
  '5 FT + 8 IN =',
];

export default function DimensionEntryHelp({ layout }: DimensionEntryHelpProps) {
  const isField = layout === 'field';
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`mt-3 rounded-lg border text-sm ${
        isField
          ? 'border-slate-700 bg-slate-800/60'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
      }`}
      data-testid="dimension-entry-help"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left font-medium ${
          isField ? 'text-slate-200' : 'text-slate-800 dark:text-slate-200'
        }`}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        How to enter dimensions
      </button>
      {open && (
        <div className={`border-t px-3 py-2 ${isField ? 'border-slate-700' : 'border-slate-200 dark:border-slate-700'}`}>
          <p className={`mb-2 text-xs ${isField ? 'text-slate-400' : TEXT_MUTED}`}>Examples:</p>
          <ul className={`space-y-1 font-mono text-xs ${isField ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'}`}>
            {EXAMPLES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
