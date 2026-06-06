import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import DrawerPanel from '../../../../components/ui/DrawerPanel';
import { PLANNER_DRAWER_FOOTER } from '../../../../components/planner/plannerTheme';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { normalizeEstimateMethod } from '../../domain/estimateMethods';
import type { EstimateLineItemsFilter } from '../../domain/estimateLineItemTree';
import {
  buildBuilderFilterGroups,
  buildCollapsedDivisionCodes,
  getVisibleBreakdownDivisions,
} from '../../application/estimateBuilderFilters';
import {
  buildSelectedDivisionsFromCodes,
  inferDivisionCodesFromItems,
  mergeDivisionBucketsWithActivities,
  normalizeSelectedDivisions,
  selectedDivisionsFromSnapshot,
} from '../../application/estimateWorkBreakdown';
import {
  ESTIMATE_SETUP_RESET_SAVED_VERSIONS_NOTE,
  getEstimateTabHelperText,
  shouldOpenBuildScopeModal,
  shouldShowActivityWorkflow,
  shouldShowQuickFeasibilityPanel,
  supportsActivityWorkflow,
} from '../../application/estimateStartFlow';
import { shouldShowEstimateBuilderHelperText } from '../estimateBuilderUi';
import {
  mergePersistedAndSessionDivisionCodes,
  shouldShowBuilderDivisionBuckets,
} from '../estimateWorkspaceRenderRules';
import type { UseEstimateSetupSessionResult } from '../hooks/useEstimateSetupSession';
import type { UseEstimateLineItemDraftResult } from '../hooks/useEstimateLineItemDraft';
import EstimateManualLineItemForm from './EstimateManualLineItemForm';
import EstimateLineItemPreviewCard from './EstimateLineItemPreviewCard';
import EstimateLineItemsFilterBar from './EstimateLineItemsFilterBar';
import EstimateDivisionBucketList from './EstimateDivisionBucketList';
import EstimateStartScopeModal, {
  type EstimateStartScopeProjectContext,
} from './EstimateStartScopeModal';
import EstimateQuickFeasibilityPanel from './EstimateQuickFeasibilityPanel';
import type { EstimateBuilderToolbarHandlers } from '../estimateWorkspaceToolbar';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import type { EstimateSelectedDivision } from '../../domain/estimateTypes';
import type {
  QuickFeasibilityInputs,
  QuickFeasibilityResult,
} from '../../application/estimateQuickFeasibility';
import { quickFeasibilityInputsFromSnapshot } from '../../application/estimateQuickFeasibility';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  estimate: EstimateSummary;
  version: EstimateDomainVersion;
  canEdit: boolean;
  saving: boolean;
  draft: UseEstimateLineItemDraftResult;
  setup: UseEstimateSetupSessionResult;
  projectLocationLabel?: string;
  projectScopeContext?: EstimateStartScopeProjectContext | null;
  autoOpenScopeModalKey?: string | null;
  onAutoOpenScopeModalConsumed?: () => void;
  onSaveQuick: (payload: {
    inputs: QuickFeasibilityInputs;
    result: QuickFeasibilityResult;
  }) => void;
  persistedSelectedDivisions?: readonly EstimateSelectedDivision[];
  onSaveSelectedDivisions?: (divisions: EstimateSelectedDivision[]) => Promise<void>;
  onToolbarHandlersChange?: (handlers: EstimateBuilderToolbarHandlers | null) => void;
  importCollapseDivisionCodesKey?: string | null;
  focusActivityCode?: string | null;
  onFocusActivityConsumed?: () => void;
}

const EMPTY_FILTER: EstimateLineItemsFilter = { divisionKey: null, scopeKey: null };

export default function EstimateLineItemsBuilderPanel({
  estimate: _estimate,
  version,
  canEdit,
  saving,
  draft,
  setup,
  projectLocationLabel,
  projectScopeContext = null,
  autoOpenScopeModalKey = null,
  onAutoOpenScopeModalConsumed,
  onSaveQuick,
  persistedSelectedDivisions = [],
  onSaveSelectedDivisions,
  onToolbarHandlersChange,
  importCollapseDivisionCodesKey = null,
  focusActivityCode = null,
  onFocusActivityConsumed,
}: Props) {
  const [filter, setFilter] = useState<EstimateLineItemsFilter>(EMPTY_FILTER);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [collapsedDivisionCodes, setCollapsedDivisionCodes] = useState<Set<string>>(
    () => new Set(),
  );
  const [quickPreview, setQuickPreview] = useState<{
    inputs: QuickFeasibilityInputs;
    result: QuickFeasibilityResult;
  } | null>(null);

  const hydratedVersionIdRef = useRef<string | null>(null);
  const consumedAutoOpenScopeKeyRef = useRef<string | null>(null);
  const consumedImportCollapseKeyRef = useRef<string | null>(null);
  const { session, quickPanelResetKey } = setup;

  useEffect(() => {
    if (
      importCollapseDivisionCodesKey &&
      consumedImportCollapseKeyRef.current !== importCollapseDivisionCodesKey
    ) {
      consumedImportCollapseKeyRef.current = importCollapseDivisionCodesKey;
      const importedCodes = importCollapseDivisionCodesKey
        .replace(/^import-\d+-/, '')
        .split(',')
        .filter(Boolean);
      if (importedCodes.length > 0) {
        setCollapsedDivisionCodes(new Set(importedCodes));
      }
    }
  }, [importCollapseDivisionCodesKey]);

  useEffect(() => {
    const inferred = inferDivisionCodesFromItems(draft.draftLines, version.lineItems);
    const selectedFromSnapshot = selectedDivisionsFromSnapshot(version.snapshot);
    const selectedForVersion = normalizeSelectedDivisions([
      ...selectedFromSnapshot,
      ...buildSelectedDivisionsFromCodes(inferred, { source: 'inferred' }),
    ]);
    const savedType = normalizeEstimateMethod(version.estimateType);

    if (hydratedVersionIdRef.current !== version.id) {
      hydratedVersionIdRef.current = version.id;
      setup.restoreSavedSetup(savedType, selectedForVersion);
      setCollapsedDivisionCodes(new Set(selectedForVersion.map((division) => division.code)));
      setFilter(EMPTY_FILTER);
      return;
    }

    const sessionSupportsActivityWorkflow =
      session.estimateSetupStarted &&
      session.activeStartMode !== 'quick' &&
      supportsActivityWorkflow(session.selectedEstimateType);
    if (!sessionSupportsActivityWorkflow) return;
    const missingInferredCodes = inferred.filter(
      (code) => !session.selectedDivisionCodes.includes(code),
    );
    if (missingInferredCodes.length > 0) {
      setup.mergeDivisionCodes(missingInferredCodes);
    }
  }, [
    version.id,
    draft.draftLines,
    version.lineItems,
    version.snapshot,
    version.estimateType,
    version.totals.quickFeasibility,
    session.estimateSetupStarted,
    session.activeStartMode,
    session.selectedEstimateType,
    session.selectedDivisionCodes,
    setup.restoreSavedSetup,
    setup.setSelectedDivisions,
    setup.mergeDivisionCodes,
  ]);

  const selectedDivisionCodes = useMemo(
    () =>
      mergePersistedAndSessionDivisionCodes(
        persistedSelectedDivisions,
        session.selectedDivisionCodes,
      ),
    [persistedSelectedDivisions, session.selectedDivisionCodes],
  );

  const workBreakdown = useMemo(
    () =>
      mergeDivisionBucketsWithActivities(
        selectedDivisionCodes,
        draft.draftLines,
        version.lineItems,
      ),
    [selectedDivisionCodes, draft.draftLines, version.lineItems],
  );

  const filterSourceGroups = useMemo(
    () => buildBuilderFilterGroups(workBreakdown, draft.draftLines),
    [workBreakdown, draft.draftLines],
  );

  const visibleBreakdownDivisions = useMemo(
    () => getVisibleBreakdownDivisions(workBreakdown, draft.draftLines, filter),
    [workBreakdown, draft.draftLines, filter],
  );

  const savedQuickInputs = useMemo(
    () =>
      version.estimateType === 'quick_feasibility'
        ? quickFeasibilityInputsFromSnapshot(version.snapshot)
        : null,
    [version.estimateType, version.snapshot],
  );

  const drawerTitle = draft.editingClientId ? 'Edit activity' : 'Add activity';
  const showQuickFeasibilityPanel = shouldShowQuickFeasibilityPanel(session);
  const showActivityWorkflow = shouldShowActivityWorkflow(session);
  const showBucketPanel = shouldShowBuilderDivisionBuckets(
    showActivityWorkflow,
    persistedSelectedDivisions,
    session.selectedDivisionCodes,
  );
  const canSaveQuick = showQuickFeasibilityPanel && quickPreview?.result.isValid && !saving;
  const showBuildScopePrompt =
    showActivityWorkflow &&
    !showBucketPanel &&
    shouldOpenBuildScopeModal(session.selectedEstimateType);

  useEffect(() => {
    if (!autoOpenScopeModalKey) return;
    if (consumedAutoOpenScopeKeyRef.current === autoOpenScopeModalKey) return;
    if (!showBuildScopePrompt) return;

    consumedAutoOpenScopeKeyRef.current = autoOpenScopeModalKey;
    setScopeModalOpen(true);
    onAutoOpenScopeModalConsumed?.();
  }, [autoOpenScopeModalKey, onAutoOpenScopeModalConsumed, showBuildScopePrompt]);

  const handleCreateWorkBreakdown = async (divisions: EstimateSelectedDivision[]) => {
    const selectedDivisions = normalizeSelectedDivisions(divisions);
    setup.setSelectedDivisions(selectedDivisions);
    setCollapsedDivisionCodes(new Set(selectedDivisions.map((division) => division.code)));
    setScopeModalOpen(false);
    if (onSaveSelectedDivisions) {
      await onSaveSelectedDivisions(selectedDivisions);
    }
  };

  const handleDivisionCollapsedChange = useCallback((code: string, collapsed: boolean) => {
    setCollapsedDivisionCodes((current) => {
      const next = new Set(current);
      if (collapsed) {
        next.add(code);
      } else {
        next.delete(code);
      }
      return next;
    });
  }, []);

  const handleAddActivityForDivision = useCallback(
    (divisionCode: string) => {
      handleDivisionCollapsedChange(divisionCode, false);
      draft.openAddDrawerForDivision(divisionCode);
    },
    [draft, handleDivisionCollapsedChange],
  );

  const handleEditDraft = useCallback(
    (clientId: string) => {
      const line = draft.draftLines.find((draftLine) => draftLine.clientId === clientId);
      const divisionCode = line?.task.lineItem.csiDivision;
      if (divisionCode) {
        handleDivisionCollapsedChange(divisionCode, false);
      }
      draft.openEditDrawer(clientId);
    },
    [draft, handleDivisionCollapsedChange],
  );

  useEffect(() => {
    if (!focusActivityCode) return;
    const match = draft.draftLines.find(
      (line) => line.task.activityCode?.trim() === focusActivityCode,
    );
    if (match) {
      handleEditDraft(match.clientId);
    }
    onFocusActivityConsumed?.();
  }, [focusActivityCode, draft.draftLines, handleEditDraft, onFocusActivityConsumed]);

  const handleQuickPreviewChange = useCallback(
    (inputs: QuickFeasibilityInputs, result: QuickFeasibilityResult) => {
      setQuickPreview({ inputs, result });
    },
    [],
  );

  const handleCollapseAll = useCallback(() => {
    setCollapsedDivisionCodes(
      buildCollapsedDivisionCodes(workBreakdown.divisions.map((division) => division.code)),
    );
  }, [workBreakdown.divisions]);

  const handleSaveQuickFromToolbar = useCallback(() => {
    if (!quickPreview) return;
    onSaveQuick(quickPreview);
  }, [onSaveQuick, quickPreview]);

  useEffect(() => {
    if (!onToolbarHandlersChange) return;

    onToolbarHandlersChange({
      showCollapseAll: showBucketPanel,
      showSaveQuick: showQuickFeasibilityPanel,
      canSaveQuick,
      collapseAll: handleCollapseAll,
      saveQuick: handleSaveQuickFromToolbar,
    });

    return () => onToolbarHandlersChange(null);
  }, [
    onToolbarHandlersChange,
    showBucketPanel,
    showQuickFeasibilityPanel,
    canSaveQuick,
    handleCollapseAll,
    handleSaveQuickFromToolbar,
  ]);

  return (
    <div className="space-y-4">
      {showActivityWorkflow && draft.dirty ? (
        <div
          className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${TEXT_BODY}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Unsaved changes. Save to update the current project estimate.</p>
        </div>
      ) : null}

      {shouldShowEstimateBuilderHelperText({
        showQuickFeasibilityPanel,
        showBucketPanel,
      }) ? (
        <p className={`text-sm ${PLANNER_MUTED}`}>{getEstimateTabHelperText(session)}</p>
      ) : null}

      {showBuildScopePrompt ? (
        <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
          <div>
            <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>Build project scope</h3>
            <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
              Choose the divisions of work for this estimate. Empty selected divisions will be saved
              even before activities are added.
            </p>
          </div>
          <Button
            variant="accent"
            size="sm"
            icon={<Play className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={() => setScopeModalOpen(true)}
          >
            Build Project Scope
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
            initialInputs={savedQuickInputs}
            initialInputsKey={savedQuickInputs ? version.id : null}
            onPreviewChange={handleQuickPreviewChange}
          />
        </div>
      ) : null}

      {showBucketPanel ? (
        <>
          {filterSourceGroups.length > 0 ? (
            <EstimateLineItemsFilterBar
              groups={filterSourceGroups}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : null}

          <EstimateDivisionBucketList
            divisions={visibleBreakdownDivisions}
            draftLines={draft.draftLines}
            collapsedDivisionCodes={collapsedDivisionCodes}
            canEdit={canEdit}
            onDivisionCollapsedChange={handleDivisionCollapsedChange}
            onAddActivity={handleAddActivityForDivision}
            onEditDraft={handleEditDraft}
            onRemoveDraft={draft.removeDraftLine}
            onDuplicateDraft={draft.duplicateDraftLine}
            onMoveDraftUp={draft.moveDraftLineUp}
            onMoveDraftDown={draft.moveDraftLineDown}
          />
        </>
      ) : null}

      <EstimateStartScopeModal
        isOpen={scopeModalOpen}
        estimateType={session.selectedEstimateType}
        projectContext={projectScopeContext}
        onClose={() => setScopeModalOpen(false)}
        onCreate={handleCreateWorkBreakdown}
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
                formError={draft.formError}
                predecessorOptions={draft.draftLines
                  .filter((line) => line.clientId !== draft.editingClientId)
                  .map((line) => ({
                    value: line.task.activityCode ?? '',
                    label: `${line.task.activityCode ?? '—'} ${line.task.title}`.trim(),
                  }))
                  .filter((option) => option.value)}
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
