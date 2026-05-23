import React from 'react';
import {
  MitigationOption,
  MITIGATION_CATEGORY_LABELS,
  MitigationCategory,
  MITIGATION_DISCLAIMER,
  MAX_MITIGATION_CREDIT_DEFAULT,
} from '../../utils/pourMitigations';

interface MitigationSelectorProps {
  options: MitigationOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  maxRecovery: number;
  disabled?: boolean;
}

const CATEGORY_ORDER: MitigationCategory[] = [
  'temperature',
  'wind-evaporation',
  'rain-severe',
  'mix-design',
  'operational',
];

const MitigationSelector: React.FC<MitigationSelectorProps> = ({
  options,
  selected,
  onChange,
  maxRecovery,
  disabled = false,
}) => {
  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  };

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: MITIGATION_CATEGORY_LABELS[cat],
    items: options.filter((o) => o.category === cat),
  })).filter((g) => g.items.length > 0);

  if (maxRecovery === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Mitigation credits are not available for this forecast (e.g. lightning or tropical
          storm). Delay placement until conditions improve.
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{MITIGATION_DISCLAIMER}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-gray-600 dark:text-gray-400">
        No additional mitigations are suggested for these forecast conditions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Only mitigations relevant to this day&apos;s forecast are shown. Maximum score recovery:{' '}
        <strong>+{maxRecovery}</strong> points (global cap {MAX_MITIGATION_CREDIT_DEFAULT}).
      </p>

      {byCategory.map(({ category, label, items }) => (
        <div key={category}>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((opt) => {
              const checked = selected.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                    checked
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(opt.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </span>
                    <span className="text-cyan-700 dark:text-cyan-300 ml-1">+{opt.credit}</span>
                    <span className="block text-gray-500 dark:text-gray-400 mt-0.5">
                      {opt.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
        {MITIGATION_DISCLAIMER}
      </p>
    </div>
  );
};

export default MitigationSelector;
