import { useMemo } from 'react';
import ClearableNumberInput from '../../../../components/pricing/ClearableNumberInput';
import Select from '../../../../components/ui/Select';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectConstructionActivity,
} from '../../domain/constructionActivityTypes';
import type { ConceptualEstimateRollup } from '../../domain/conceptualEstimateTypes';
import {
  isConceptualEstimateType,
  supportsConstructionActivitiesWorkflow,
} from '../../domain/estimateMethods';
import type { EstimateSettings, EstimateType } from '../../domain/estimateTypes';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import type { ScheduleActivity } from '../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult } from '../../scheduling/cpmTypes';
import { formatEstimateCurrency } from '../estimateFormatters';
import {
  resolveEstimateTotalsReview,
  shouldUseConstructionActivitiesTotalsReview,
} from '../estimateTotalsDisplay';
import type { UseEstimateSettingsResult } from '../hooks/useEstimateSettings';
import { PLANNER_FORM_PANEL, PLANNER_MUTED, PLANNER_SECTION_TITLE } from '../estimateWorkspaceTheme';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateCostBreakdownCard from './EstimateCostBreakdownCard';
import EstimateLaborSummaryCard from './EstimateLaborSummaryCard';

export const ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER =
  'estimate-overview-financial-summary';

export const EMPTY_CONSTRUCTION_ACTIVITY_COSTS_TITLE = 'No activity costs yet';

export const EMPTY_CONSTRUCTION_ACTIVITY_COSTS_MESSAGE =
  'No activity costs yet. Add construction activities to build your estimate totals.';

export const LEGACY_EMPTY_TOTALS_MESSAGE =
  'No estimate totals yet. Add activities and save a version to build the totals summary.';

export const COSTS_MARKUP_DESCRIPTION =
  'Estimate pricing, markup, contingency, tax, and final sell price.';

interface Props {
  version: EstimateDomainVersion | null;
  loading?: boolean;
  estimateType?: EstimateType | string | null;
  constructionActivities?: readonly ProjectConstructionActivity[];
  projectMaterialResources?: readonly ActivityMaterialResource[];
  projectEquipmentResources?: readonly ActivityEquipmentResource[];
  markupSettings?: EstimateSettings;
  settingsState?: UseEstimateSettingsResult;
  conceptualRollup?: ConceptualEstimateRollup | null;
  canEdit?: boolean;
  scheduleActivities?: readonly ScheduleActivity[];
  projectDurationDays?: number | null;
  cpmActivities?: readonly CpmActivityResult[];
}

function MarkupSettingsSection({
  settings,
  canEdit,
  onChange,
}: {
  settings: EstimateSettings;
  canEdit: boolean;
  onChange: (patch: Partial<EstimateSettings>) => void;
}) {
  const patch = (next: Partial<EstimateSettings>) => {
    if (!canEdit) return;
    onChange(next);
  };

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-4`}>
      <div>
        <h3 className={PLANNER_SECTION_TITLE}>Markup settings</h3>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Adjust markup and pricing rules to recalculate the estimate total immediately.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ClearableNumberInput
          label="Indirect cost %"
          min={0}
          max={100}
          step="any"
          value={settings.indirectCostPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ indirectCostPercent: value })}
          fullWidth
          data-testid="markup-indirect-cost-percent"
        />
        <ClearableNumberInput
          label="Contingency %"
          min={0}
          max={100}
          step="any"
          value={settings.contingencyPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ contingencyPercent: value })}
          fullWidth
          data-testid="markup-contingency-percent"
        />
        <ClearableNumberInput
          label="Overhead %"
          min={0}
          max={100}
          step="any"
          value={settings.overheadPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ overheadPercent: value })}
          fullWidth
          data-testid="markup-overhead-percent"
        />
        <ClearableNumberInput
          label="Profit %"
          min={0}
          max={100}
          step="any"
          value={settings.profitPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ profitPercent: value })}
          fullWidth
          data-testid="markup-profit-percent"
        />
        <ClearableNumberInput
          label="Tax %"
          min={0}
          max={100}
          step="any"
          value={settings.taxPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ taxPercent: value })}
          fullWidth
          data-testid="markup-tax-percent"
        />
        <Select
          label="Apply overhead to"
          value={settings.overheadBase}
          disabled={!canEdit}
          options={[
            { value: 'direct_cost', label: 'Direct cost' },
            { value: 'labor_only', label: 'Labor only' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(value) =>
            patch({
              overheadBase: value as EstimateSettings['overheadBase'],
            })
          }
          fullWidth
        />
        <Select
          label="Apply profit to"
          value={settings.profitBase}
          disabled={!canEdit}
          options={[
            { value: 'direct_plus_overhead', label: 'Direct + overhead' },
            { value: 'direct_only', label: 'Direct only' },
          ]}
          onChange={(value) =>
            patch({
              profitBase: value as EstimateSettings['profitBase'],
            })
          }
          fullWidth
        />
        <Select
          label="Tax applies to"
          value={settings.taxBase}
          disabled={!canEdit}
          options={[
            { value: 'materials_only', label: 'Materials only' },
            { value: 'total_estimate', label: 'Total estimate' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(value) =>
            patch({
              taxBase: value as EstimateSettings['taxBase'],
            })
          }
          fullWidth
        />
      </div>
    </div>
  );
}

export default function EstimateTotalsReviewPanel({
  version,
  loading = false,
  estimateType = null,
  constructionActivities = [],
  projectMaterialResources,
  projectEquipmentResources,
  markupSettings,
  settingsState,
  conceptualRollup = null,
  canEdit = false,
  scheduleActivities,
  projectDurationDays,
  cpmActivities,
}: Props) {
  const resolvedEstimateType = estimateType ?? version?.estimateType ?? null;
  const usesConstructionActivities = supportsConstructionActivitiesWorkflow(resolvedEstimateType);
  const hasConstructionActivities = constructionActivities.length > 0;

  const review = useMemo(
    () =>
      resolveEstimateTotalsReview({
        version,
        estimateType: resolvedEstimateType,
        constructionActivities,
        markupSettings: markupSettings ?? settingsState?.settings,
        conceptualRollup,
        projectMaterialResources,
        projectEquipmentResources,
        scheduleActivities,
        projectDurationDays,
        cpmActivities,
      }),
    [
      version,
      resolvedEstimateType,
      constructionActivities,
      markupSettings,
      settingsState?.settings,
      conceptualRollup,
      projectMaterialResources,
      projectEquipmentResources,
      scheduleActivities,
      projectDurationDays,
      cpmActivities,
    ],
  );

  const showConstructionActivityEmptyState =
    !loading && usesConstructionActivities && !hasConstructionActivities;

  if (showConstructionActivityEmptyState) {
    return (
      <EstimateWorkspaceEmptyState
        title={EMPTY_CONSTRUCTION_ACTIVITY_COSTS_TITLE}
        body={EMPTY_CONSTRUCTION_ACTIVITY_COSTS_MESSAGE}
      />
    );
  }

  if (!loading && !review.hasTotals) {
    const emptyTitle = isConceptualEstimateType(resolvedEstimateType)
      ? 'No conceptual estimate totals yet'
      : 'No estimate totals yet';
    const emptyBody = isConceptualEstimateType(resolvedEstimateType)
      ? 'Add conceptual budget line items to build your estimate totals.'
      : LEGACY_EMPTY_TOTALS_MESSAGE;

    return (
      <EstimateWorkspaceEmptyState title={emptyTitle} body={emptyBody} />
    );
  }

  const showMarkupSettings = settingsState != null;

  const summarySubtitle = shouldUseConstructionActivitiesTotalsReview(
    resolvedEstimateType,
    constructionActivities,
  )
    ? `${COSTS_MARKUP_DESCRIPTION} Activity costs roll up from construction activities.`
    : isConceptualEstimateType(resolvedEstimateType)
      ? `${COSTS_MARKUP_DESCRIPTION} Totals reflect the current conceptual estimate budget.`
      : COSTS_MARKUP_DESCRIPTION;

  return (
    <div className="space-y-4" data-testid={ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER}>
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>Financial summary</h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>{summarySubtitle}</p>
      </div>

      <EstimateSummaryCard
        label="Final sell price"
        value={formatEstimateCurrency(review.costGroups.finalSellPrice)}
        loading={loading}
        emphasis
      />

      {showMarkupSettings ? (
        <MarkupSettingsSection
          settings={settingsState.settings}
          canEdit={canEdit}
          onChange={settingsState.updateSettings}
        />
      ) : null}

      <EstimateCostBreakdownCard
        costGroups={review.costGroups}
        percentBreakdown={review.percentBreakdown}
      />

      <EstimateLaborSummaryCard metrics={review.laborMetrics} loading={loading} />
    </div>
  );
}
