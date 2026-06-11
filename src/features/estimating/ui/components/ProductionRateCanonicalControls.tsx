import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';
import { applyVariantFromEntry } from '../../data/productionRates/mapCanonicalToLibraryEntry';
import {
  formatVariantDisplayLabel,
} from '../../data/productionRates/productionRateDisplayFormatters';

export { getProductionRateDisplayTitle } from '../../data/productionRates/productionRateDisplayFormatters';

interface ProductionRateVariantSelectorProps {
  entry: ProductionRateLibraryEntry;
  onVariantChange: (nextEntry: ProductionRateLibraryEntry) => void;
  className?: string;
}

export function ProductionRateVariantSelector({
  entry,
  onVariantChange,
  className = '',
}: ProductionRateVariantSelectorProps) {
  const variants = entry.allVariants ?? [];
  if (variants.length <= 1) return null;

  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Variant
      </label>
      <select
        value={entry.id}
        onChange={(event) => {
          const next = applyVariantFromEntry(entry, event.target.value);
          if (next) onVariantChange(next);
        }}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {variants.map((variant) => (
          <option key={variant.sourceProductionRateKey} value={variant.sourceProductionRateKey}>
            {formatVariantDisplayLabel(variant.label)} · {variant.manHoursPerUnit.toFixed(3)} MH/
            {variant.unitOfMeasure}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ProductionRateSourceDetailsProps {
  entry: ProductionRateLibraryEntry;
  className?: string;
  /** Dark modal styling vs light picker styling */
  variant?: 'light' | 'dark';
  /** Dev-only explicit opt-in; never shown in production builds */
  enabled?: boolean;
}

export function ProductionRateSourceDetails({
  entry,
  className = '',
  variant = 'light',
  enabled = false,
}: ProductionRateSourceDetailsProps) {
  const refs = entry.sourceReferences ?? [];
  const [open, setOpen] = useState(false);
  if (!import.meta.env.DEV || !enabled || refs.length === 0) return null;

  const isDark = variant === 'dark';
  const buttonClass = isDark
    ? 'text-xs text-cyan-300/90 hover:text-cyan-200'
    : 'text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1 ${buttonClass}`}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Source details ({refs.length})
      </button>
      {open && (
        <ul
          className={`mt-2 space-y-1 rounded border p-2 text-[11px] ${
            isDark
              ? 'border-white/10 bg-slate-950/60 text-slate-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400'
          }`}
        >
          {refs.map((ref) => (
            <li key={ref.sourceProductionRateKey}>
              <span className="font-mono text-[10px]">{ref.sourceProductionRateKey}</span>
              {' · '}
              {ref.figure} · p.{ref.sourcePage}
              {ref.workElementNumber ? ` · ${ref.workElementNumber}` : ''}
              {' · '}
              {ref.originalManHoursPerUnit.toFixed(3)} MH/{ref.originalUnitOfMeasure}
              <p className="mt-0.5 italic">{ref.originalDescription}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
