import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Play, RotateCcw, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import DrawerPanel from '../../../../components/ui/DrawerPanel';
import { PLANNER_DRAWER_FOOTER } from '../../../../components/planner/plannerTheme';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { normalizeEstimateMethod } from '../../domain/estimateMethods';
import { computeDraftSummaryTotals } from '../estimateFormDefaults';
import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import {
  filterGroupedEstimateLines,
  groupEstimateTasks,
} from '../../application/estimateLineItemGrouping';
import {
  inferDivisionCodesFromItems,
  mergeDivisionBucketsWithActivities,
  normalizeSelectedDivisionCodes,
} from '../../application/estimateWorkBreakdown';
import {
  canResetEstimateSetup,
  ESTIMATE_SETUP_RESET_SAVED_VERSIONS_NOTE,
  getEstimateTabHelperText,
  shouldOpenBuildScopeModal,
  shouldShowActivityWorkflow,
  shouldShowDivisionBucketPanel,
  shouldShowEstimateTypeSelector,
  shouldShowQuickFeasibilityPanel,
  shouldShowSavedActivities,
} from '../../application/estimateStartFlow';
import type { UseEstimateSetupSessionResult } from '../hooks/useEstimateSetupSession';
import type { UseEstimateLineItemDraftResult } from '../hooks/useEstimateLineItemDraft';
import EstimateManualLineItemForm from './EstimateManualLineItemForm';
import EstimateLineItemPreviewCard from './EstimateLineItemPreviewCard';
import EstimateReadOnlyLineItemsTable from './EstimateReadOnlyLineItemsTable';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateLineItemsFilterBar from './EstimateLineItemsFilterBar';
import EstimateDivisionBucketList from './EstimateDivisionBucketList';
import EstimateStartScopeModal from './EstimateStartScopeModal';
import EstimateResetSetupConfirmModal from './EstimateResetSetupConfirmModal';
import EstimateQuickFeasibilityPanel from './EstimateQuickFeasibilityPanel';
import EstimateMethodSelector from './EstimateMethodSelector';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import { formatDraftSummaryStrip } from '../estimateLineItemDisplay';
import type {
  QuickFeasibilityInputs,
  QuickFeasibilityResult,
} from '../../application/estimateQuickFeasibility';
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
  setup: UseEstimateSetupSessionResult;
  projectLocationLabel?: string;
  onSave: () => void;
  onSaveQuick: (payload: {
    inputs: QuickFeasibilityInputs;
    result: QuickFeasibilityResult;
  }) => void;
}

const EMPTY_FILTER: EstimateLineItemsFilter = { divisionKey: null, scopeKey: null };

export default function EstimateLineItemsBuilderPanel({
  estimate: _estimate,
  version,
  canEdit,
  canSave,
  saving,
  draft,
  setup,
  projectLocationLabel,
  onSave,
  onSaveQuick,
}: Props) {
  const [filter, setFilter] = useState<EstimateLineItemsFilter>(EMPTY_FILTER);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [quickPreview, setQuickPreview] = useState<{
    inputs: QuickFeasibilityInputs;
    result: QuickFeasibilityResult;
  } | null>(null);

  const hydratedVersionIdRef = useRef(version.id);
  const { session, quickPanelResetKey } = setup;

  useEffect(() => {
    if (!shouldShowActivityWorkflow(session)) return;

    const inferred = inferDivisionCodesFromItems(draft.draftLines, version.lineItems);

    if (hydratedVersionIdRef.current !== version.id) {
      hydratedVersionIdRef.current = version.id;
      setup.setSelectedDivisionCodes(inferred);
      return;
    }

    setup.mergeDivisionCodes(inferred);
  }, [
    version.id,
    draft.draftLines,
    version.lineItems,
    session,
    setup.setSelectedDivisionCodes,
    setup.mergeDivisionCodes,
  ]);

  const workBreakdown = useMemo(
    () =>
      mergeDivisionBucketsWithActivities(
        [...session.selectedDivisionCodes],
        draft.draftLines,
        version.lineItems,
      ),
    [session.selectedDivisionCodes, draft.draftLines, version.lineItems],
  );

  const savedGroups = useMemo(
    () => groupEstimateTasks(version.lineItems),
    [version.lineItems],
  );

  const filteredSavedGroups = useMemo(
    () => filterGroupedEstimateLines(savedGroups, filter),
    [savedGroups, filter],
  );

  const filterSourceGroups = useMemo(() => [...savedGroups], [savedGroups]);

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
  const hasSavedActivities = version.lineItems.length > 0;
  const hasDraftActivities = draft.draftLines.length > 0;
  const showTypeSelector = shouldShowEstimateTypeSelector(session);
  const showQuickFeasibilityPanel = shouldShowQuickFeasibilityPanel(session);
  const showActivityWorkflow = shouldShowActivityWorkflow(session);
  const showBucketPanel = shouldShowDivisionBucketPanel(session);
  const showSavedActivitiesSection = shouldShowSavedActivities(session) && hasSavedActivities;
  const showResetButton = canEdit && canResetEstimateSetup(session);
  const canSaveQuick = showQuickFeasibilityPanel && quickPreview?.result.isValid && !saving;

  const handleCreateWorkBreakdown = (codes: string[]) => {
    setup.setSelectedDivisionCodes(normalizeSelectedDivisionCodes(codes));
  };

  const handleStartEstimate = () => {
    const type = session.selectedEstimateType;
    setup.startSetup(type);
    if (shouldOpenBuildScopeModal(type)) {
      setScopeModalOpen(true);
    }
  };

  const handleConfirmResetSetup = () => {
    setup.resetSetup(normalizeEstimateMethod(version.estimateType));
    setQuickPreview(null);
    draft.resetDraftSetup();
    setResetModalOpen(false);
  };

  const handleQuickPreviewChange = useCallback(
    (inputs: QuickFeasibilityInputs, result: QuickFeasibilityResult) => {
      setQuickPreview({ inputs, result });
    },
    [],
  );

  return (
    <div className="space-y-4">
      {showActivityWorkflow && draft.dirty ? (
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
          <h2 className={PLANNER_SECTION_TITLE}>Estimate</h2>
          <div className="flex flex-wrap gap-2">
            {showResetButton ? (
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="h-4 w-4" />}
                disabled={!canEdit}
                className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={() => setResetModalOpen(true)}
              >
                Reset estimate setup
              </Button>
            ) : null}
            {showQuickFeasibilityPanel ? (
              <Button
                variant="outline"
                size="sm"
                icon={<Save className="h-4 w-4" />}
                disabled={!canEdit || !canSaveQuick}
                isLoading={saving}
                title={
                  quickPreview?.result.isValid
                    ? 'Save quick feasibility result as a new estimate version'
                    : 'Enter valid quick feasibility inputs before saving'
                }
                onClick={() => {
                  if (!quickPreview) return;
                  onSaveQuick(quickPreview);
                }}
              >
                {saving ? 'Saving...' : 'Save quick estimate'}
              </Button>
            ) : null}
            {showBucketPanel ? (
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
            ) : null}
          </div>
        </div>
        <p className={`text-sm ${PLANNER_MUTED}`}>{getEstimateTabHelperText(session)}</p>
      </div>

      {showTypeSelector ? (
        <div className="space-y-4">
          <div className={`${PLANNER_FORM_PANEL} space-y-2`}>
            <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>Start your estimate</h3>
            <p className={`text-sm ${PLANNER_MUTED}`}>
              Choose the estimate type first. You can start with a quick rough number or build a
              detailed work breakdown for bid-level estimating.
            </p>
            {hasSavedActivities ? (
              <p className={`text-xs ${PLANNER_MUTED}`}>{ESTIMATE_SETUP_RESET_SAVED_VERSIONS_NOTE}</p>
            ) : null}
          </div>

          <EstimateMethodSelector
            value={session.selectedEstimateType}
            onChange={setup.setSelectedEstimateType}
            disabled={!canEdit}
          />

          <Button
            variant="accent"
            size="sm"
            icon={<Play className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={handleStartEstimate}
          >
            Start Estimate
          </Button>
        </div>
      ) : null}

      {showQuickFeasibilityPanel ? (
        <div className="space-y-4">
          <p className={`text-sm ${TEXT_FOREGROUND}`}>
            Estimate type:{' '}
            <span className="font-semibold">
              {formatEstimateMethodLabel(session.selectedEstimateType)}
            </span>
          </p>
          <p className={`text-xs ${PLANNER_MUTED}`}>{ESTIMATE_SETUP_RESET_SAVED_VERSIONS_NOTE}</p>
          <EstimateQuickFeasibilityPanel
            key={quickPanelResetKey}
            disabled={!canEdit}
            projectContext={{ locationLabel: projectLocationLabel }}
            onPreviewChange={handleQuickPreviewChange}
          />
        </div>
      ) : null}

      {showBucketPanel ? (
        <>
          {(hasDraftActivities || hasSavedActivities) && filterSourceGroups.length > 0 ? (
            <EstimateLineItemsFilterBar
              groups={filterSourceGroups}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : null}

          {draft.draftLines.length > 0 ? (
            <div
              className={`rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50 ${TEXT_FOREGROUND}`}
            >
              <p className="font-medium">{formatDraftSummaryStrip(draftSummaryTotals)}</p>
            </div>
          ) : null}

          <EstimateDivisionBucketList
            breakdown={workBreakdown}
            draftLines={draft.draftLines}
            canEdit={canEdit}
            onAddActivity={draft.openAddDrawerForDivision}
            onEditDraft={draft.openEditDrawer}
            onRemoveDraft={draft.removeDraftLine}
            onDuplicateDraft={draft.duplicateDraftLine}
            onMoveDraftUp={draft.moveDraftLineUp}
            onMoveDraftDown={draft.moveDraftLineDown}
          />

          {draft.draftLines.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <EstimateSummaryCard label="Total draft activities" value={draftSummary.lineCount} />
              <EstimateSummaryCard label="Total labor hours" value={draftSummary.laborHours} />
              <EstimateSummaryCard label="Total man-days" value={draftSummary.manDays} />
              <EstimateSummaryCard label="Total crew-days" value={draftSummary.crewDays} />
              <EstimateSummaryCard label="Total sell price" value={draftSummary.sellPrice} />
            </div>
          ) : null}
        </>
      ) : null}

      {showSavedActivitiesSection ? (
        <div className="space-y-3 pt-2">
          <EstimateReadOnlyLineItemsTable
            lineItems={version.lineItems}
            groups={filteredSavedGroups}
            caption="Saved activities"
          />
        </div>
      ) : null}

      <EstimateStartScopeModal
        isOpen={scopeModalOpen}
        estimateType={session.selectedEstimateType}
        onClose={() => setScopeModalOpen(false)}
        onCreate={handleCreateWorkBreakdown}
      />

      <EstimateResetSetupConfirmModal
        isOpen={resetModalOpen}
        hasSavedActivities={hasSavedActivities}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmResetSetup}
      />

      <DrawerPanel
        isOpen={showActivityWorkflow && draft.drawerOpen}
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
