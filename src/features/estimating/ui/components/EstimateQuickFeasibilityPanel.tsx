import { useMemo, useState } from 'react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import {
  computeQuickFeasibility,
  DEFAULT_QUICK_FEASIBILITY_INPUTS,
  QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS,
  QUICK_FEASIBILITY_QUALITY_OPTIONS,
  type QuickFeasibilityInputs,
  type QuickFeasibilityQualityLevel,
} from '../../application/estimateQuickFeasibility';
import { parseEstimateFormNumber } from '../estimateFormDefaults';
import EstimateSummaryCard from './EstimateSummaryCard';
import { formatEstimateCurrency } from '../estimateFormatters';
import {
  PLANNER_FORM_LABEL,
  PLANNER_INPUT,
} from '../../../../components/planner/plannerTheme';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  disabled?: boolean;
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function confidenceLabel(level: string): string {
  if (level === 'high') return 'High';
  if (level === 'medium') return 'Medium';
  return 'Low';
}

function formatPreviewCurrency(value: number, isValid: boolean): string {
  if (!isValid) return '—';
  return formatEstimateCurrency(value);
}

export default function EstimateQuickFeasibilityPanel({ disabled = false }: Props) {
  const [inputs, setInputs] = useState<QuickFeasibilityInputs>(DEFAULT_QUICK_FEASIBILITY_INPUTS);

  const result = useMemo(() => computeQuickFeasibility(inputs), [inputs]);

  const patchInputs = (patch: Partial<QuickFeasibilityInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-4">
      <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
        <div>
          <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>Quick Feasibility</h3>
          <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
            Enter rough project parameters for a local SF-based feasibility preview. Results are not
            saved to estimate versions.
          </p>
        </div>

        <FieldGrid>
          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-project-type">
              Project type
            </label>
            <Select
              id="quick-project-type"
              className={PLANNER_INPUT}
              value={inputs.projectType}
              disabled={disabled}
              options={QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) => patchInputs({ projectType: value })}
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-location">
              Location
            </label>
            <Input
              id="quick-location"
              className={PLANNER_INPUT}
              value={inputs.location}
              disabled={disabled}
              placeholder="City, state or region"
              onChange={(event) => patchInputs({ location: event.target.value })}
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-area-sf">
              Building area (SF)
            </label>
            <Input
              id="quick-area-sf"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.areaSF || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({ areaSF: parseEstimateFormNumber(event.target.value) })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-cost-per-sf">
              Cost per SF ($)
            </label>
            <Input
              id="quick-cost-per-sf"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.costPerSF || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({ costPerSF: parseEstimateFormNumber(event.target.value) })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-quality-level">
              Quality level
            </label>
            <Select
              id="quick-quality-level"
              className={PLANNER_INPUT}
              value={inputs.qualityLevel}
              disabled={disabled}
              options={QUICK_FEASIBILITY_QUALITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                patchInputs({
                  qualityLevel: value as QuickFeasibilityQualityLevel,
                })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-contingency">
              Contingency (%)
            </label>
            <Input
              id="quick-contingency"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              max={100}
              step="any"
              value={inputs.contingencyPercent || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({
                  contingencyPercent: parseEstimateFormNumber(event.target.value),
                })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-location-factor">
              Location factor
            </label>
            <Input
              id="quick-location-factor"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.locationFactor || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({
                  locationFactor: parseEstimateFormNumber(event.target.value) || 1,
                })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-complexity-factor">
              Complexity factor
            </label>
            <Input
              id="quick-complexity-factor"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.complexityFactor || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({
                  complexityFactor: parseEstimateFormNumber(event.target.value) || 1,
                })
              }
            />
          </div>
        </FieldGrid>
      </div>

      <div className="space-y-3">
        <h4 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Preview</h4>

        {!result.isValid ? (
          <div
            className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${TEXT_BODY}`}
            role="status"
          >
            <p>{result.validationMessages[0]}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EstimateSummaryCard
            label="Likely total"
            value={formatPreviewCurrency(result.likelyTotal, result.isValid)}
            emphasis
          />
          <EstimateSummaryCard
            label="Low range"
            value={formatPreviewCurrency(result.lowTotal, result.isValid)}
          />
          <EstimateSummaryCard
            label="High range"
            value={formatPreviewCurrency(result.highTotal, result.isValid)}
          />
          <EstimateSummaryCard
            label="Effective cost / SF"
            value={formatPreviewCurrency(result.effectiveCostPerSF, result.isValid)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EstimateSummaryCard
            label="Base cost (before contingency)"
            value={formatPreviewCurrency(result.baseCost, result.isValid)}
          />
          <EstimateSummaryCard
            label="Confidence level"
            value={confidenceLabel(result.confidenceLevel)}
          />
        </div>

        <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
          <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Assumptions</p>
          <ul className={`list-disc space-y-1 pl-5 text-sm ${PLANNER_MUTED}`}>
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
