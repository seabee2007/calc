import React from 'react';
import { X } from 'lucide-react';
import { COMMON_FRACTION_PICKER_OPTIONS } from '../domain/calculatorFractions';

interface FractionPickerProps {
  open: boolean;
  layout: 'desktop' | 'field';
  onSelect: (numerator: number, denominator: number) => void;
  onManualEntry: () => void;
  onClose: () => void;
}

export default function FractionPicker({
  open,
  layout,
  onSelect,
  onManualEntry,
  onClose,
}: FractionPickerProps) {
  if (!open) return null;

  const isField = layout === 'field';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Fraction picker"
      data-testid="fraction-picker"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close fraction picker"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-t-2xl p-4 shadow-xl sm:rounded-2xl ${
          isField ? 'border border-slate-600 bg-slate-900' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className={`text-sm font-semibold ${isField ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              Choose fraction
            </h4>
            <p className={`text-xs ${isField ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
              Tap a common fraction to add to your dimension
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 ${isField ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {COMMON_FRACTION_PICKER_OPTIONS.map(({ numerator, denominator, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSelect(numerator, denominator);
                onClose();
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                isField
                  ? 'border border-slate-600 bg-slate-800 text-white hover:border-cyan-500/50 hover:bg-slate-700'
                  : 'border border-slate-200 bg-slate-50 text-slate-800 hover:border-cyan-400 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-cyan-500/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onManualEntry();
            onClose();
          }}
          className={`mt-3 w-full rounded-lg py-2 text-sm font-medium ${
            isField
              ? 'text-cyan-400 hover:bg-slate-800'
              : 'text-cyan-700 hover:bg-slate-50 dark:text-cyan-400 dark:hover:bg-slate-800'
          }`}
        >
          Custom fraction (type numerator, then denominator)
        </button>
      </div>
    </div>
  );
}
