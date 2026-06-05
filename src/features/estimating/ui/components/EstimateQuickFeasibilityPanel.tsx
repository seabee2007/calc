import { useEffect, useMemo, useState } from 'react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import {
  calculateQuickFeasibilityEstimate,
  createInitialQuickFeasibilityInputs,
  createQuickFeasibilityInputsForLocation,
  getDefaultContingencyPercent,
  getSquareFootPricingImportantLimitations,
  getSquareFootPricingLocations,
  QUICK_FEASIBILITY_BUDGET_WARNING,
  QUICK_FEASIBILITY_COMPLEXITY_OPTIONS,
  QUICK_FEASIBILITY_FINISH_OPTIONS,
  QUICK_FEASIBILITY_LOW_CONFIDENCE_WARNING,
  QUICK_FEASIBILITY_MEP_OPTIONS,
  QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS,
  QUICK_FEASIBILITY_SITE_CONDITION_OPTIONS,
  QUICK_FEASIBILITY_TERRITORY_WARNING,
  QUICK_FEASIBILITY_WORK_BREAKDOWN_WARNING,
  type QuickFeasibilityComplexityLevel,
  type QuickFeasibilityFinishLevel,
  type QuickFeasibilityInputs,
  type QuickFeasibilityMepIntensity,
  type QuickFeasibilityProjectContext,
  type QuickFeasibilityProjectType,
  type QuickFeasibilityResult,
  type QuickFeasibilitySiteCondition,
} from '../../application/estimateQuickFeasibility';
import { parseEstimateFormNumber } from '../estimateFormDefaults';
import EstimateSummaryCard from './EstimateSummaryCard';
import { formatEstimateCurrency, formatEstimateNumber } from '../estimateFormatters';
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
  projectContext?: QuickFeasibilityProjectContext | null;
  onPreviewChange?: (input: QuickFeasibilityInputs, result: QuickFeasibilityResult) => void;
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function formatPreviewCurrency(value: number, isValid: boolean): string {
  if (!isValid) return '—';
  return formatEstimateCurrency(value);
}

function formatConfidenceLabel(confidence: string | null): string {
  if (!confidence) return '—';
  if (confidence === 'very_low') return 'Very low';
  if (confidence === 'low') return 'Low';
  if (confidence === 'medium') return 'Medium';
  if (confidence === 'high') return 'High';
  return confidence;
}

function formatLocationOptionLabel(code: string, name: string): string {
  return `${code} - ${name}`;
}

export default function EstimateQuickFeasibilityPanel({
  disabled = false,
  projectContext = null,
  onPreviewChange,
}: Props) {
  const [inputs, setInputs] = useState<QuickFeasibilityInputs>(() =>
    createInitialQuickFeasibilityInputs(projectContext),
  );

  const locationOptions = useMemo(
    () =>
      getSquareFootPricingLocations().map((location) => ({
        value: location.code,
        label: formatLocationOptionLabel(location.code, location.name),
      })),
    [],
  );

  const result = useMemo(() => calculateQuickFeasibilityEstimate(inputs), [inputs]);
  const datasetLimitations = useMemo(() => getSquareFootPricingImportantLimitations(), []);

  useEffect(() => {
    onPreviewChange?.(inputs, result);
  }, [inputs, result, onPreviewChange]);

  const patchInputs = (patch: Partial<QuickFeasibilityInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  };

  const handleLocationChange = (locationCode: string) => {
    if (!locationCode) {
      patchInputs({
        locationCode: '',
        basePricePerSf: 0,
        basePricePerSfOverridden: false,
      });
      return;
    }

    setInputs((prev) => {
      const next = createQuickFeasibilityInputsForLocation(locationCode, {
        ...prev,
        locationCode,
        basePricePerSfOverridden: false,
      });
      return next;
    });
  };

  const handleProjectTypeChange = (projectType: QuickFeasibilityProjectType) => {
    patchInputs({
      projectType,
      contingencyPercent: getDefaultContingencyPercent(projectType),
    });
  };

  return (
    <div className="space-y-4">
      <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
        <div>
          <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>Quick Feasibility</h3>
          <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
            Location-based square-foot pricing for early budget planning. Save the quick estimate
            to preserve this high-level preview as a version.
          </p>
        </div>

        <FieldGrid>
          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-location-market">
              Location / Market
            </label>
            <Select
              id="quick-location-market"
              className={PLANNER_INPUT}
              value={inputs.locationCode}
              disabled={disabled}
              options={[
                { value: '', label: 'Select a location' },
                ...locationOptions,
              ]}
              onChange={handleLocationChange}
            />
          </div>

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
              onChange={(value) => handleProjectTypeChange(value as QuickFeasibilityProjectType)}
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
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-base-price-per-sf">
              Base price per SF ($)
            </label>
            <Input
              id="quick-base-price-per-sf"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.basePricePerSf || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({
                  basePricePerSf: parseEstimateFormNumber(event.target.value),
                  basePricePerSfOverridden: true,
                })
              }
            />
            <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
              Auto-filled from selected location but editable.
            </p>
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-finish-level">
              Finish level
            </label>
            <Select
              id="quick-finish-level"
              className={PLANNER_INPUT}
              value={inputs.finishLevel}
              disabled={disabled}
              options={QUICK_FEASIBILITY_FINISH_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                patchInputs({ finishLevel: value as QuickFeasibilityFinishLevel })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-complexity-level">
              Complexity
            </label>
            <Select
              id="quick-complexity-level"
              className={PLANNER_INPUT}
              value={inputs.complexityLevel}
              disabled={disabled}
              options={QUICK_FEASIBILITY_COMPLEXITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                patchInputs({ complexityLevel: value as QuickFeasibilityComplexityLevel })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-site-condition">
              Site condition
            </label>
            <Select
              id="quick-site-condition"
              className={PLANNER_INPUT}
              value={inputs.siteCondition}
              disabled={disabled}
              options={QUICK_FEASIBILITY_SITE_CONDITION_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                patchInputs({ siteCondition: value as QuickFeasibilitySiteCondition })
              }
            />
          </div>

          <div>
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-mep-intensity">
              MEP intensity
            </label>
            <Select
              id="quick-mep-intensity"
              className={PLANNER_INPUT}
              value={inputs.mepIntensity}
              disabled={disabled}
              options={QUICK_FEASIBILITY_MEP_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                patchInputs({ mepIntensity: value as QuickFeasibilityMepIntensity })
              }
            />
            <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>App-level multiplier, not dataset data.</p>
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
            <label className={PLANNER_FORM_LABEL} htmlFor="quick-location-adjustment">
              Manual location adjustment
            </label>
            <Input
              id="quick-location-adjustment"
              className={PLANNER_INPUT}
              type="number"
              min={0}
              step="any"
              value={inputs.manualLocationAdjustmentFactor || ''}
              disabled={disabled}
              onChange={(event) =>
                patchInputs({
                  manualLocationAdjustmentFactor: parseEstimateFormNumber(event.target.value) || 1,
                })
              }
            />
            <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
              The selected market rate already includes location pricing. Use this only for extra local adjustment.
            </p>
          </div>
        </FieldGrid>
      </div>

      {inputs.locationCode ? (
        <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
          <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Location benchmark</p>
          <p className={`text-sm ${PLANNER_MUTED}`}>
            Confidence: {formatConfidenceLabel(result.locationConfidence)}
          </p>
          {result.planningLowPerSf != null && result.planningHighPerSf != null ? (
            <p className={`text-sm ${PLANNER_MUTED}`}>
              Location benchmark range: {formatEstimateCurrency(result.planningLowPerSf)}–
              {formatEstimateCurrency(result.planningHighPerSf)}/SF
            </p>
          ) : null}
          {result.locationFactorVsNational195 != null ? (
            <p className={`text-sm ${PLANNER_MUTED}`}>
              Location factor vs national baseline: {result.locationFactorVsNational195}
            </p>
          ) : null}
          {result.locationNotes ? (
            <p className={`text-sm ${PLANNER_MUTED}`}>{result.locationNotes}</p>
          ) : null}
        </div>
      ) : null}

      <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
        <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Important</p>
        <ul className={`list-disc space-y-1 pl-5 text-sm ${PLANNER_MUTED}`}>
          <li>{QUICK_FEASIBILITY_BUDGET_WARNING}</li>
          <li>{QUICK_FEASIBILITY_WORK_BREAKDOWN_WARNING}</li>
          {datasetLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>

      {result.warnings.some(
        (warning) =>
          warning === QUICK_FEASIBILITY_LOW_CONFIDENCE_WARNING ||
          warning === QUICK_FEASIBILITY_TERRITORY_WARNING,
      ) ? (
        <div
          className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${TEXT_BODY}`}
          role="status"
        >
          <ul className="list-disc space-y-1 pl-4">
            {result.warnings
              .filter(
                (warning) =>
                  warning === QUICK_FEASIBILITY_LOW_CONFIDENCE_WARNING ||
                  warning === QUICK_FEASIBILITY_TERRITORY_WARNING,
              )
              .map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
          </ul>
        </div>
      ) : null}

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
            label="Low budget"
            value={formatPreviewCurrency(result.lowTotal, result.isValid)}
          />
          <EstimateSummaryCard
            label="Likely budget"
            value={formatPreviewCurrency(result.likelyTotal, result.isValid)}
            emphasis
          />
          <EstimateSummaryCard
            label="High budget"
            value={formatPreviewCurrency(result.highTotal, result.isValid)}
          />
          <EstimateSummaryCard
            label="Adjusted cost / SF"
            value={formatPreviewCurrency(result.adjustedCostPerSF, result.isValid)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EstimateSummaryCard
            label="Base cost (area × base/SF)"
            value={formatPreviewCurrency(result.baseCost, result.isValid)}
          />
          <EstimateSummaryCard
            label="Adjusted cost (before contingency)"
            value={formatPreviewCurrency(result.adjustedCost, result.isValid)}
          />
          <EstimateSummaryCard
            label="Contingency"
            value={formatPreviewCurrency(result.contingencyAmount, result.isValid)}
          />
        </div>

        {result.isValid ? (
          <p className={`text-xs ${PLANNER_MUTED}`}>
            Resolved base price: {formatEstimateCurrency(result.resolvedBasePricePerSf)}/SF ·
            Multipliers: project {formatEstimateNumber(result.multipliers.projectType, { decimals: 2 })},
            finish {formatEstimateNumber(result.multipliers.finish, { decimals: 2 })}, complexity{' '}
            {formatEstimateNumber(result.multipliers.complexity, { decimals: 2 })}, site{' '}
            {formatEstimateNumber(result.multipliers.siteCondition, { decimals: 2 })}, MEP{' '}
            {formatEstimateNumber(result.multipliers.mep, { decimals: 2 })}
          </p>
        ) : null}

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
