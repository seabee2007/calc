import type { EstimateType } from '../../domain/estimateTypes';
import { DEFAULT_ESTIMATE_METHOD } from '../../domain/estimateMethods';
import { listEstimateMethodOptions } from '../estimateMethodDisplay';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  value?: EstimateType;
  onChange: (value: EstimateType) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export default function EstimateMethodSelector({
  value = DEFAULT_ESTIMATE_METHOD,
  onChange,
  disabled = false,
  readOnly = false,
}: Props) {
  const options = listEstimateMethodOptions();
  const selected = options.find((option) => option.value === value) ?? options[2];

  if (readOnly) {
    return (
      <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
        <p className={PLANNER_SECTION_TITLE}>Estimate method</p>
        <p className={`text-base font-semibold ${TEXT_FOREGROUND}`}>{selected.label}</p>
        <p className={`text-sm ${TEXT_BODY}`}>{selected.workflowNote}</p>
        <p className={`text-xs ${PLANNER_MUTED}`}>{selected.description}</p>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Estimate method</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Choose the workflow before creating the draft estimate. Default is Detailed Estimate.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={[
                'rounded-lg border px-3 py-3 text-left transition-colors',
                isSelected
                  ? 'border-cyan-600 bg-cyan-50/80 ring-1 ring-cyan-600/30 dark:border-cyan-400 dark:bg-cyan-950/30 dark:ring-cyan-400/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{option.label}</p>
              <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>{option.workflowNote}</p>
            </button>
          );
        })}
      </div>

      <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>{selected.description}</p>
    </div>
  );
}
