import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import DrawerPanel from '../../../../components/ui/DrawerPanel';
import { PLANNER_DRAWER_FOOTER } from '../../../../components/planner/plannerTheme';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { buildEstimateDraftSnapshot } from '../../application/buildEstimateDraftSnapshot';
import {
  filterGroupedEstimateLines,
  groupEstimateDraftLines,
  groupEstimateTasks,
} from '../../application/estimateLineItemGrouping';
import { rollupEstimateDraftLines, rollupEstimateTasks } from '../../application/estimateGroupRollups';
import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import type { UseEstimateLineItemDraftResult } from '../hooks/useEstimateLineItemDraft';
import EstimateManualLineItemForm from './EstimateManualLineItemForm';
import EstimateLineItemPreviewCard from './EstimateLineItemPreviewCard';
import EstimateReadOnlyLineItemsTable from './EstimateReadOnlyLineItemsTable';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateLineItemsFilterBar from './EstimateLineItemsFilterBar';
import EstimateLineItemsGroupedView from './EstimateLineItemsGroupedView';
import {
  formatRollupStripCounts,
  formatRollupStripTotals,
} from '../estimateLineItemDisplay';
import {
  formatEstimateCurrency,
  formatEstimateHours,
} from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  estimate: EstimateSummary;
  version: EstimateDomainVersion;
  canEdit: boolean;
  canSave: boolean;
  saving: boolean;
  draft: UseEstimateLineItemDraftResult;
  onSave: () => void;
}

const EMPTY_FILTER: EstimateLineItemsFilter = { divisionKey: null, scopeKey: null };

export default function EstimateLineItemsBuilderPanel({
  estimate,
  version,
  canEdit,
  canSave,
  saving,
  draft,
  onSave,
}: Props) {
  const [filter, setFilter] = useState<EstimateLineItemsFilter>(EMPTY_FILTER);

  const draftGroups = useMemo(
    () => groupEstimateDraftLines(draft.draftLines),
    [draft.draftLines],
  );
  const savedGroups = useMemo(
    () => groupEstimateTasks(version.lineItems),
    [version.lineItems],
  );

  const filteredDraftGroups = useMemo(
    () => filterGroupedEstimateLines(draftGroups, filter),
    [draftGroups, filter],
  );
  const filteredSavedGroups = useMemo(
    () => filterGroupedEstimateLines(savedGroups, filter),
    [savedGroups, filter],
  );

  const filterSourceGroups = useMemo(
    () => [...draftGroups, ...savedGroups],
    [draftGroups, savedGroups],
  );

  const rollupStrip = useMemo(() => {
    const draftTasks = filteredDraftGroups.flatMap((division) =>
      division.scopes.flatMap((scope) => scope.items),
    );
    const savedTasks = filteredSavedGroups.flatMap((division) =>
      division.scopes.flatMap((scope) => scope.items),
    );

    const draftRollup = rollupEstimateDraftLines(draftTasks);
    const savedRollup = rollupEstimateTasks(savedTasks);

    const divisionKeys = new Set<string>();
    const scopeKeys = new Set<string>();
    for (const division of [...filteredDraftGroups, ...filteredSavedGroups]) {
      divisionKeys.add(division.key);
      for (const scope of division.scopes) {
        scopeKeys.add(`${division.key}::${scope.key}`);
      }
    }

    return {
      counts: {
        divisionCount: divisionKeys.size,
        scopeCount: scopeKeys.size,
        taskCount: draftRollup.itemCount + savedRollup.itemCount,
      },
      totals: {
        directCost: draftRollup.directCost + savedRollup.directCost,
        sellPrice: draftRollup.sellPrice + savedRollup.sellPrice,
        laborHours: draftRollup.laborHours + savedRollup.laborHours,
      },
    };
  }, [filteredDraftGroups, filteredSavedGroups]);

  const draftSnapshot = useMemo(() => {
    if (draft.draftLines.length === 0) return null;
    return buildEstimateDraftSnapshot({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      versionNumber: version.versionNumber,
      estimateType: version.estimateType,
      status: version.status,
      draftLines: draft.draftLines,
      pricing: version.snapshot.pricing,
    });
  }, [draft.draftLines, estimate.id, estimate.projectId, version]);

  const draftSummary = useMemo(() => {
    if (!draftSnapshot) {
      return {
        laborHours: '—',
        directCost: '—',
        sellPrice: '—',
      };
    }

    let laborHours = 0;
    for (const line of draftSnapshot.lineItems) {
      laborHours += line.metrics.adjustedLaborHours;
    }

    return {
      laborHours: laborHours > 0 ? formatEstimateHours(laborHours) : '—',
      directCost: formatEstimateCurrency(draftSnapshot.totals.directCost),
      sellPrice: formatEstimateCurrency(draftSnapshot.totals.finalSellPrice),
    };
  }, [draftSnapshot]);

  const drawerTitle = draft.editingClientId ? 'Edit line item' : 'Add line item';
  const hasAnyLineItems = draft.draftLines.length > 0 || version.lineItems.length > 0;

  return (
    <div className="space-y-4">
      {draft.dirty ? (
        <div
          className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${TEXT_BODY}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Unsaved changes — save to create a new estimate version without changing prior versions.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={PLANNER_SECTION_TITLE}>Line items</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={draft.openAddDrawer}
          >
            Add line item
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            disabled={!canSave || saving}
            isLoading={saving}
            title={
              canSave
                ? 'Save draft line items as a new estimate version'
                : 'Add draft line items and make changes to enable save'
            }
            onClick={onSave}
          >
            {saving ? 'Saving...' : 'Save estimate'}
          </Button>
        </div>
      </div>

      {hasAnyLineItems ? (
        <>
          <EstimateLineItemsFilterBar
            groups={filterSourceGroups}
            filter={filter}
            onFilterChange={setFilter}
          />
          <div
            className={`rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50 ${TEXT_FOREGROUND}`}
          >
            <p className="font-medium">{formatRollupStripCounts(rollupStrip.counts)}</p>
            <p className={`text-xs tabular-nums ${PLANNER_MUTED}`}>
              {formatRollupStripTotals({
                directCost: rollupStrip.totals.directCost,
                sellPrice: rollupStrip.totals.sellPrice,
                itemCount: rollupStrip.counts.taskCount,
                laborHours: rollupStrip.totals.laborHours,
                manDays: 0,
                crewDays: 0,
                durationDays: 0,
                materialCost: 0,
                equipmentCost: 0,
                subcontractorCost: 0,
                indirectCost: 0,
                scheduleEnabledCount: 0,
                weatherSensitiveCount: 0,
                inspectionRequiredCount: 0,
              })}
            </p>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Draft line items</h3>
        {draft.draftLines.length === 0 ? (
          <div className={`${PLANNER_FORM_PANEL} text-sm ${PLANNER_MUTED}`}>
            No draft line items yet. Add a line item to build your estimate locally.
          </div>
        ) : (
          <EstimateLineItemsGroupedView
            mode="draft"
            groups={filteredDraftGroups}
            emptyMessage="No draft line items match the current filters."
            onEditDraft={draft.openEditDrawer}
            onRemoveDraft={draft.removeDraftLine}
          />
        )}
      </div>

      {draft.draftLines.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EstimateSummaryCard label="Draft labor hours" value={draftSummary.laborHours} />
          <EstimateSummaryCard label="Draft direct cost" value={draftSummary.directCost} />
          <EstimateSummaryCard label="Draft sell price" value={draftSummary.sellPrice} />
        </div>
      ) : null}

      <div className="space-y-2 pt-2">
        <h3 className={PLANNER_SECTION_TITLE}>Current saved version</h3>
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Read-only snapshot from version {version.versionNumber}. Draft edits above do not change
          saved data until you save a new version.
        </p>
        <EstimateReadOnlyLineItemsTable
          lineItems={version.lineItems}
          groups={filteredSavedGroups}
          caption="Saved line items"
        />
      </div>

      <DrawerPanel
        isOpen={draft.drawerOpen}
        onClose={draft.closeDrawer}
        title={drawerTitle}
        className="max-w-2xl"
      >
        {draft.formDraft ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <EstimateManualLineItemForm
                draft={draft.formDraft}
                onChange={draft.updateFormDraft}
              />
              <EstimateLineItemPreviewCard draft={draft.formDraft} />
            </div>
            <div className={PLANNER_DRAWER_FOOTER}>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={draft.closeDrawer}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" onClick={draft.commitFormDraft}>
                  {draft.editingClientId ? 'Update draft line' : 'Add to draft'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DrawerPanel>
    </div>
  );
}
