import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import {
  minPlanForFeature,
  PLAN_DISPLAY_NAMES,
} from '../../../../lib/entitlements';
import { getFeatureKeyForEstimateType } from '../../../../lib/estimateEntitlements';

interface Props {
  value?: EstimateType;
  onChange: (value: EstimateType) => void;
  disabled?: boolean;
  readOnly?: boolean;
  isEstimateTypeAllowed?: (type: EstimateType) => boolean;
  defaultEstimateType?: EstimateType;
}

export default function EstimateMethodSelector({
  value = DEFAULT_ESTIMATE_METHOD,
  onChange,
  disabled = false,
  readOnly = false,
  isEstimateTypeAllowed,
  defaultEstimateType = DEFAULT_ESTIMATE_METHOD,
}: Props) {
  const navigate = useNavigate();
  const options = listEstimateMethodOptions();
  const selected = options.find((option) => option.value === value) ?? options[0];

  if (readOnly) {
    return (
      <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
        <p className={PLANNER_SECTION_TITLE}>Estimate type</p>
        <p className={`text-base font-semibold ${TEXT_FOREGROUND}`}>{selected.label}</p>
        <p className={`text-sm ${TEXT_BODY}`}>{selected.workflowNote}</p>
        <p className={`text-xs ${PLANNER_MUTED}`}>{selected.description}</p>
      </div>
    );
  }

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Estimate type</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Choose how deep this estimate should go before you start. Default is{' '}
          {options.find((option) => option.value === defaultEstimateType)?.label ?? 'Quick Estimate'}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          const allowed = isEstimateTypeAllowed ? isEstimateTypeAllowed(option.value) : true;
          const requiredPlan = minPlanForFeature(getFeatureKeyForEstimateType(option.value));
          const planLabel = PLAN_DISPLAY_NAMES[requiredPlan].short;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled || !allowed}
              aria-pressed={isSelected}
              data-testid={`estimate-type-option-${option.value}`}
              data-locked={allowed ? 'false' : 'true'}
              onClick={() => {
                if (!allowed) return;
                onChange(option.value);
              }}
              className={[
                'rounded-lg border px-3 py-3 text-left transition-colors',
                isSelected
                  ? 'border-cyan-600 bg-cyan-50/80 ring-1 ring-cyan-600/30 dark:border-cyan-400 dark:bg-cyan-950/30 dark:ring-cyan-400/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                disabled || !allowed ? 'cursor-not-allowed opacity-70' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{option.label}</p>
                {!allowed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    {planLabel}
                  </span>
                ) : null}
              </div>
              <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>{option.workflowNote}</p>
              {!allowed ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/settings/billing');
                  }}
                >
                  Upgrade to {planLabel}
                </button>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>{selected.description}</p>
    </div>
  );
}
