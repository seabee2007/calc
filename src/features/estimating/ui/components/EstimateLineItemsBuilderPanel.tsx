import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import DrawerPanel from '../../../../components/ui/DrawerPanel';
import { PLANNER_DRAWER_FOOTER } from '../../../../components/planner/plannerTheme';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { computeDraftSummaryTotals } from '../estimateFormDefaults';
import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import {
  filterGroupedEstimateLines,
  groupEstimateDraftLines,
  groupEstimateTasks,
} from '../../application/estimateLineItemGrouping';
import type { UseEstimateLineItemDraftResult } from '../hooks/useEstimateLineItemDraft';
import EstimateManualLineItemForm from './EstimateManualLineItemForm';
import EstimateLineItemPreviewCard from './EstimateLineItemPreviewCard';
import EstimateReadOnlyLineItemsTable from './EstimateReadOnlyLineItemsTable';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateLineItemsFilterBar from './EstimateLineItemsFilterBar';
import EstimateLineItemsGroupedView from './EstimateLineItemsGroupedView';
import { formatDraftSummaryStrip } from '../estimateLineItemDisplay';
import {
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
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

  const draftSummaryTotals = useMemo(
    () => computeDraftSummaryTotals(draft.draftLines),
    [draft.draftLines],
  );

  const draftSummary = useMemo(() => {
    const totals = draftSummaryTotals;
    return {
      lineCount: String(totals.lineCount),
      laborHours:
        totals.laborHours > 0 ? formatEstimateHours(totals.laborHours) : '—',
      manDays: totals.manDays > 0 ? formatEstimateNumber(totals.manDays, { decimals: 2 }) : '—',
      crewDays: totals.crewDays > 0 ? formatEstimateNumber(totals.crewDays, { decimals: 2 }) : '—',
      sellPrice: totals.sellPrice > 0 ? formatEstimateCurrency(totals.sellPrice) : '—',
    };
  }, [draftSummaryTotals]);

  const drawerTitle = draft.editingClientId ? 'Edit activity' : 'Add activity';
  const hasAnyLineItems = draft.draftLines.length > 0 || version.lineItems.length > 0;
  const showFirstLineEmptyState =
    draft.draftLines.length === 0 && version.lineItems.length === 0;

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

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={PLANNER_SECTION_TITLE}>Activities</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              disabled={!canEdit}
              onClick={draft.openAddDrawer}
            >
              Add activity
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Save className="h-4 w-4" />}
              disabled={!canSave || saving}
              isLoading={saving}
              title={
                canSave
                  ? 'Save draft activities as a new estimate version'
                  : 'Add draft activities and make changes to enable save'
              }
              onClick={onSave}
            >
              {saving ? 'Saving...' : 'Save estimate'}
            </Button>
          </div>
        </div>
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Build your project work breakdown. Each activity can carry cost, labor, materials,
          equipment, and schedule data.
        </p>
      </div>

      {showFirstLineEmptyState ? (
        <div className={`${PLANNER_FORM_PANEL} space-y-3 text-sm ${PLANNER_MUTED}`}>
          <p>
            Start by adding your first work activity. Activities become the foundation for
            estimate totals, schedule preview, and Gantt planning.
          </p>
          <Button
            variant="accent"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={draft.openAddDrawer}
          >
            Add activity
          </Button>
        </div>
      ) : null}

      {hasAnyLineItems ? (
        <>
          <EstimateLineItemsFilterBar
            groups={filterSourceGroups}
            filter={filter}
            onFilterChange={setFilter}
          />
        </>
      ) : null}

      {draft.draftLines.length > 0 ? (
        <div
          className={`rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50 ${TEXT_FOREGROUND}`}
        >
          <p className="font-medium">{formatDraftSummaryStrip(draftSummaryTotals)}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Draft activities</h3>
        {draft.draftLines.length === 0 ? (
          <div className={`${PLANNER_FORM_PANEL} text-sm ${PLANNER_MUTED}`}>
            {showFirstLineEmptyState
              ? 'Draft activities will appear here after you add your first activity.'
              : 'No draft activities yet. Add an activity to build your estimate locally.'}
          </div>
        ) : (
          <EstimateLineItemsGroupedView
            mode="draft"
            groups={filteredDraftGroups}
            allDraftLines={draft.draftLines}
            emptyMessage="No draft activities match the current filters."
            onEditDraft={draft.openEditDrawer}
            onRemoveDraft={draft.removeDraftLine}
            onDuplicateDraft={draft.duplicateDraftLine}
            onMoveDraftUp={draft.moveDraftLineUp}
            onMoveDraftDown={draft.moveDraftLineDown}
          />
        )}
      </div>

      {draft.draftLines.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <EstimateSummaryCard label="Total draft activities" value={draftSummary.lineCount} />
          <EstimateSummaryCard label="Total labor hours" value={draftSummary.laborHours} />
          <EstimateSummaryCard label="Total man-days" value={draftSummary.manDays} />
          <EstimateSummaryCard label="Total crew-days" value={draftSummary.crewDays} />
          <EstimateSummaryCard label="Total sell price" value={draftSummary.sellPrice} />
        </div>
      ) : null}

      <div className="space-y-3 pt-2">
        <EstimateReadOnlyLineItemsTable
          lineItems={version.lineItems}
          groups={filteredSavedGroups}
          caption="Saved activities"
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
                  {draft.editingClientId ? 'Update draft activity' : 'Add to draft'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DrawerPanel>
    </div>
  );
}
