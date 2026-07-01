import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { usePreferencesStore } from '../../../store';
import {
  displayLengthToMeters,
  displayLengthUnit,
  metersToDisplayLength,
} from '../../../utils/measurementDisplay';

export function NumberField({
  label,
  value,
  suffix,
  measurementKind = 'length',
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step?: number;
  measurementKind?: 'length' | 'small';
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const measurementSystem = usePreferencesStore((state) => state.preferences.measurementSystem);
  const isMeterBacked = suffix === 'm';
  const displaySuffix = isMeterBacked
    ? displayLengthUnit(measurementSystem, measurementKind)
    : suffix;
  const toDisplayValue = (metersOrRaw: number) =>
    isMeterBacked
      ? metersToDisplayLength(metersOrRaw, measurementSystem, measurementKind)
      : metersOrRaw;
  const toStoredValue = (displayOrRaw: number) =>
    isMeterBacked
      ? displayLengthToMeters(displayOrRaw, measurementSystem, measurementKind)
      : displayOrRaw;
  const [draft, setDraft] = useState(() => formatInputNumber(toDisplayValue(value)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.activeElement?.getAttribute('aria-label') === label) return;
    setDraft(formatInputNumber(toDisplayValue(value)));
    setError(null);
  }, [label, measurementKind, measurementSystem, value]);

  const commit = () => {
    const parsed = parseDecimalInput(draft);
    if (!Number.isFinite(parsed)) {
      setError('Enter a valid decimal value.');
      return;
    }
    const storedValue = toStoredValue(parsed);
    if (typeof min === 'number' && storedValue < min) {
      setError(`Minimum ${formatInputNumber(toDisplayValue(min))} ${displaySuffix}.`);
      return;
    }
    if (typeof max === 'number' && storedValue > max) {
      setError(`Maximum ${formatInputNumber(toDisplayValue(max))} ${displaySuffix}.`);
      return;
    }
    setError(null);
    onChange(storedValue);
    setDraft(formatInputNumber(toDisplayValue(storedValue)));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <div
        className={`flex h-10 overflow-hidden rounded-lg border bg-white transition focus-within:ring-2 focus-within:ring-cyan-400/30 dark:bg-slate-950 ${
          error
            ? 'border-red-300 dark:border-red-700'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            if (error) setError(null);
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <span className="flex min-w-12 items-center justify-center border-l border-slate-200 px-3 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {displaySuffix}
        </span>
      </div>
      {error ? <span className="mt-1 block text-xs text-red-600 dark:text-red-300">{error}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(/,/g, '');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}
