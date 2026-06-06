import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import {
  planEstimateScheduleDates,
  type EstimateScheduleDependencyMode,
} from '../application/estimateScheduleDatePlanner';
import { useNavigate, useParams } from 'react-router-dom';
import {
  estimateWorkspaceHref,
  parseEstimateWorkspaceTabParam,
} from '../utils/estimateRoutes';
import { useAuth } from '../../../hooks/useAuth';
import { usePlannerProject } from '../../../contexts/PlannerProjectContext';
import { DEFAULT_ESTIMATE_METHOD, normalizeEstimateMethod } from '../domain/estimateMethods';
import type { EstimateSelectedDivision, EstimateType } from '../domain/estimateTypes';
import {
  createCurrentEstimate,
  currentEstimateToDomainVersion,
  currentEstimateToSummary,
  resetCurrentEstimate,
  saveCurrentEstimate,
  saveCurrentEstimateWithLineItems,
  saveCurrentQuickFeasibilityEstimate,
  type CurrentEstimate,
} from '../application/currentEstimateService';
import { normalizeSelectedDivisions } from '../application/estimateWorkBreakdown';
import {
  buildOptimisticEstimateWithDivisions,
  loadCurrentEstimateForProject,
} from './estimateWorkspaceLoad';
import type {
  QuickFeasibilityInputs,
  QuickFeasibilityResult,
} from '../application/estimateQuickFeasibility';
import type {
  EstimateDomainVersion,
} from '../infrastructure/estimateDbTypes';
import { Play } from 'lucide-react';
import Button from '../../../components/ui/Button';
import EstimateWorkspaceTabBar, {
  type EstimateWorkspaceTabId,
} from './components/EstimateWorkspaceTabBar';
import EstimateWorkspaceLoading from './components/EstimateWorkspaceLoading';
import EstimateWorkspaceEmptyState from './components/EstimateWorkspaceEmptyState';
import EstimateWorkspaceToast from './components/EstimateWorkspaceToast';
import { createEstimateSaveSuccessToast } from './estimateBuilderUi';
import EstimateLineItemsBuilderPanel from './components/EstimateLineItemsBuilderPanel';
import EstimateResetSetupConfirmModal from './components/EstimateResetSetupConfirmModal';
import EstimateWorkspaceToolbarActions from './components/EstimateWorkspaceToolbarActions';
import EstimateTotalsReviewPanel from './components/EstimateTotalsReviewPanel';
import EstimateSchedulePreviewPanel from './components/EstimateSchedulePreviewPanel';
import EstimateGanttPreview from './components/EstimateGanttPreview';
import EstimateMethodSelector from './components/EstimateMethodSelector';
import type { EstimateSchedulePlanControlValues } from './components/EstimateSchedulePlanControls';
import {
  ROUGH_SCHEDULE_PREVIEW_NOTE,
  shouldShowRoughSchedulePreviewNote,
} from './estimateMethodDisplay';
import { useEstimateLineItemDraft } from './hooks/useEstimateLineItemDraft';
import { useEstimateSetupSession } from './hooks/useEstimateSetupSession';
import {
  shouldShowEstimateBuilderPanel,
  shouldShowEstimateSettingsPanel,
  shouldShowEstimateTypeSelectionOnTab,
  shouldShowOverviewFinancialSummary,
  shouldShowOverviewNoEstimateMessage,
} from './estimateWorkspaceRenderRules';
import EstimateSettingsPanel from './components/EstimateSettingsPanel';
import { useEstimateSettings } from './hooks/useEstimateSettings';
import {
  shouldShowBidImportExportActions,
  shouldShowBucketSaveAction,
  shouldShowCollapseAllAction,
  shouldShowQuickSaveAction,
  shouldShowResetFormAction,
  type EstimateBuilderToolbarHandlers,
} from './estimateWorkspaceToolbar';
import EstimateImportModal from './EstimateImportModal';
import { applyImportedEstimate } from '../importExport/estimateImportApply';
import type { ImportedEstimateData } from '../importExport/estimateImportParser';
import type { EstimateImportApplyMode } from '../importExport/estimateImportApply';
import {
  downloadBlankEstimateTemplateWorkbook,
  downloadEstimateWorkbook,
} from '../importExport/estimateExportBuilder';
import { downloadGanttExcel } from '../export/ganttExcelExport';
import { downloadGanttPdf } from '../export/ganttPdfExport';
import { downloadLevelThreeGanttPdfFromElement } from '../export/levelThreeGanttPdfExport';
import {
  isGanttExportReady,
  prepareGanttExport,
} from '../schedule/ganttExportValidation';
import type { BuildGanttScheduleResult } from '../schedule/buildGanttSchedule';
import { estimateLineItemsToScheduleActivities } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import { calculateCpm } from '../scheduling/cpm/calculateCpm';
import type { CpmLogicLink, LogicNetworkLayout } from '../scheduling/cpmTypes';
import { mergeScheduleAssumptions } from '../scheduling/scheduleAssumptions';
import { useScheduleSettings } from './hooks/useScheduleSettings';
import LogicNetworkWorkspace from './components/scheduling/LogicNetworkWorkspace';
import LevelThreeGantt from './components/scheduling/LevelThreeGantt';
import ResourceHistogram from './components/scheduling/ResourceHistogram';
import ResourceLevelingModal from './components/scheduling/ResourceLevelingModal';
import { calculateResourceHistogram } from '../scheduling/resources/resourceHistogramCalculator';
import { resourceLevelSchedule } from '../scheduling/resources/resourceLevelSchedule';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  TEXT_BODY,
} from './estimateWorkspaceTheme';

const OVERVIEW_NO_ESTIMATE_MESSAGE =
  'No estimate started yet. Go to the Estimate tab to start one.';
const TAB_NO_ESTIMATE_MESSAGE = 'This project does not have a saved estimate yet.';
const LOADING_ESTIMATE_MESSAGE = 'Loading estimate...';

function getTodayScheduleDateYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EstimateWorkspacePage() {
  const { projectId: routeProjectId, estimateTab } = useParams<{
    projectId: string;
    estimateTab?: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, project, loading: plannerLoading, accessDenied } = usePlannerProject();
  const parsedTab = parseEstimateWorkspaceTabParam(estimateTab);
  const activeTab: EstimateWorkspaceTabId = parsedTab ?? 'overview';
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<CurrentEstimate | null>(null);
  const [autoOpenScopeModalKey, setAutoOpenScopeModalKey] = useState<string | null>(null);
  const [selectedEstimateMethod, setSelectedEstimateMethod] = useState<EstimateType>(
    DEFAULT_ESTIMATE_METHOD,
  );
  const [activeEstimateType, setActiveEstimateType] = useState<EstimateType | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCollapseDivisionCodesKey, setImportCollapseDivisionCodesKey] = useState<
    string | null
  >(null);
  const [focusActivityCode, setFocusActivityCode] = useState<string | null>(null);
  const [builderToolbarHandlers, setBuilderToolbarHandlers] =
    useState<EstimateBuilderToolbarHandlers | null>(null);
  const [schedulePlanControls, setSchedulePlanControls] = useState<EstimateSchedulePlanControlValues>(
    () => ({
      projectStartDate: getTodayScheduleDateYmd(),
      dependencyMode: 'sequential_by_project' satisfies EstimateScheduleDependencyMode,
      includeWeekends: false,
    }),
  );
  const loadTokenRef = useRef(0);
  const estimate = useMemo(
    () => (currentEstimate ? currentEstimateToSummary(currentEstimate) : null),
    [currentEstimate],
  );
  const estimateAdapter = useMemo(
    () => (currentEstimate ? currentEstimateToDomainVersion(currentEstimate) : null),
    [currentEstimate],
  );
  const lineItemDraft = useEstimateLineItemDraft(estimateAdapter);
  const estimateSettings = useEstimateSettings();
  const scheduleSettingsHook = useScheduleSettings();
  const ganttExportRef = useRef<HTMLDivElement>(null);
  const [levelingModalResult, setLevelingModalResult] = useState<import('../scheduling/cpmTypes').ResourceLevelingResult | null>(null);

  const schedulePlan = useMemo(() => {
    if (!estimateAdapter || !estimate) return null;
    return buildEstimateSchedulePlan({
      version: estimateAdapter,
      estimateId: estimate.id,
      projectId: estimate.projectId,
    });
  }, [estimateAdapter, estimate]);

  const scheduleDatePlanResult = useMemo(() => {
    if (!schedulePlan) return null;
    return planEstimateScheduleDates(schedulePlan, {
      projectStartDate: schedulePlanControls.projectStartDate,
      dependencyMode: schedulePlanControls.dependencyMode,
      includeWeekends: schedulePlanControls.includeWeekends,
    });
  }, [schedulePlan, schedulePlanControls]);

  // Schedule activities and CPM — derived from line items + logic links
  const scheduleActivitiesResult = useMemo(
    () =>
      estimateAdapter
        ? estimateLineItemsToScheduleActivities(
            estimateAdapter.lineItems,
            estimateSettings.settings,
          )
        : { activities: [], warnings: [] },
    [estimateAdapter, estimateSettings.settings],
  );

  const cpmResult = useMemo(
    () =>
      scheduleActivitiesResult.activities.length > 0
        ? calculateCpm({
            activities: scheduleActivitiesResult.activities,
            logicLinks: scheduleSettingsHook.logicLinks,
          })
        : null,
    [scheduleActivitiesResult.activities, scheduleSettingsHook.logicLinks],
  );

  const resourceHistogram = useMemo(() => {
    if (!cpmResult || scheduleActivitiesResult.activities.length === 0) return [];
    return calculateResourceHistogram({
      activities: scheduleActivitiesResult.activities,
      cpmActivities: cpmResult.activities,
      projectStartDate:
        scheduleSettingsHook.scheduleSettings.projectStartDate ||
        getTodayScheduleDateYmd(),
      availableCrewSize: scheduleSettingsHook.scheduleSettings.availableCrewSize,
      leveledOffsets: scheduleSettingsHook.leveledOffsets,
    });
  }, [
    cpmResult,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook.scheduleSettings,
    scheduleSettingsHook.leveledOffsets,
  ]);

  const ganttExportReady = useMemo(
    () =>
      isGanttExportReady({
        lineItems: estimateAdapter?.lineItems ?? [],
        plannedPlan: scheduleDatePlanResult?.plan ?? null,
      }),
    [estimateAdapter?.lineItems, scheduleDatePlanResult?.plan],
  );

  const projectScopeContext = useMemo(
    () =>
      project
        ? {
            projectId: project.id,
            projectName: project.name,
            projectDescription: project.description,
            locationLabel: project.locationLabel,
          }
        : null,
    [project],
  );

  const handleSchedulePlanControlsChange = useCallback(
    (patch: Partial<EstimateSchedulePlanControlValues>) => {
      setSchedulePlanControls((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const resolvedProjectId = projectId ?? routeProjectId ?? '';
  const estimateSetup = useEstimateSetupSession(
    resolvedProjectId,
    estimateAdapter?.id,
    estimateAdapter?.estimateType,
  );
  const estimateSetupRef = useRef(estimateSetup);
  const lineItemDraftRef = useRef(lineItemDraft);
  const estimateSettingsRef = useRef(estimateSettings);
  const scheduleSettingsRef = useRef(scheduleSettingsHook);
  estimateSetupRef.current = estimateSetup;
  lineItemDraftRef.current = lineItemDraft;
  estimateSettingsRef.current = estimateSettings;
  scheduleSettingsRef.current = scheduleSettingsHook;

  useEffect(() => {
    if (!resolvedProjectId) return;
    if (estimateTab === 'totals') {
      navigate(estimateWorkspaceHref(resolvedProjectId, 'overview'), { replace: true });
      return;
    }
    if (estimateTab && parsedTab == null) {
      navigate(estimateWorkspaceHref(resolvedProjectId, 'overview'), { replace: true });
    }
  }, [estimateTab, parsedTab, resolvedProjectId, navigate]);

  const handleTabChange = useCallback(
    (tabId: EstimateWorkspaceTabId) => {
      if (!resolvedProjectId) return;
      navigate(estimateWorkspaceHref(resolvedProjectId, tabId));
    },
    [navigate, resolvedProjectId],
  );

  const handleEditActivityFromGantt = useCallback(
    (activityCode: string) => {
      if (!resolvedProjectId) return;
      setFocusActivityCode(activityCode);
      navigate(estimateWorkspaceHref(resolvedProjectId, 'line-items'));
    },
    [navigate, resolvedProjectId],
  );

  useEffect(() => {
    if (!resolvedProjectId) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const projectId = resolvedProjectId;
    const token = ++loadTokenRef.current;
    const isStale = () => cancelled || token !== loadTokenRef.current;

    if (import.meta.env.DEV) {
      console.log('[Estimate Page] load start', { projectId, token });
    }

    setDataLoading(true);
    setLoadError(null);
    setCreateError(null);
    setSaveError(null);
    setSaveToastMessage(null);
    setCurrentEstimate(null);
    setActiveEstimateType(null);
    setAutoOpenScopeModalKey(null);
    setSelectedEstimateMethod(DEFAULT_ESTIMATE_METHOD);
    estimateSetupRef.current.resetSetup(DEFAULT_ESTIMATE_METHOD);
    lineItemDraftRef.current.resetDraftSetup();
    estimateSettingsRef.current.rehydrateFromEstimate(null);
    scheduleSettingsRef.current.rehydrateFromEstimate(null, []);

    void (async () => {
      try {
        const loadedEstimate = await loadCurrentEstimateForProject(projectId);

        if (isStale()) return;

        if (import.meta.env.DEV) {
          console.log('[Estimate Load] complete', {
            projectId,
            token,
            hasEstimate: Boolean(loadedEstimate?.id),
            selectedDivisionCount: loadedEstimate?.selectedDivisions.length ?? 0,
          });
        }

        if (loadedEstimate) {
          setCurrentEstimate(loadedEstimate);
          estimateSettingsRef.current.rehydrateFromEstimate(loadedEstimate);
          scheduleSettingsRef.current.rehydrateFromEstimate(
            loadedEstimate,
            (loadedEstimate.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
          );
          const loadedType = loadedEstimate.estimateType
            ? normalizeEstimateMethod(loadedEstimate.estimateType)
            : DEFAULT_ESTIMATE_METHOD;
          setActiveEstimateType(loadedEstimate.estimateType);
          setSelectedEstimateMethod(loadedType);
          if (loadedEstimate.estimateType) {
            estimateSetupRef.current.restoreSavedSetup(
              loadedType,
              loadedEstimate.selectedDivisions,
            );
            lineItemDraftRef.current.rehydrateFromVersion(
              currentEstimateToDomainVersion(loadedEstimate),
            );
          }
        } else {
          setActiveEstimateType(null);
          estimateSettingsRef.current.rehydrateFromEstimate(null);
          scheduleSettingsRef.current.rehydrateFromEstimate(null, []);
        }
      } catch (error) {
        if (!isStale()) {
          setLoadError(error instanceof Error ? error.message : 'Could not load estimate');
        }
      } finally {
        if (!isStale()) {
          setDataLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId]);

  const handleRetryLoadEstimate = useCallback(async () => {
    if (!resolvedProjectId) return;

    const projectId = resolvedProjectId;
    const token = ++loadTokenRef.current;

    setDataLoading(true);
    setLoadError(null);
    setCreateError(null);
    setSaveError(null);
    setCurrentEstimate(null);
    setActiveEstimateType(null);
    setSelectedEstimateMethod(DEFAULT_ESTIMATE_METHOD);
    estimateSetupRef.current.resetSetup(DEFAULT_ESTIMATE_METHOD);
    lineItemDraftRef.current.resetDraftSetup();
    estimateSettingsRef.current.rehydrateFromEstimate(null);

    try {
      const loadedEstimate = await loadCurrentEstimateForProject(projectId);
      if (token !== loadTokenRef.current) return;

      setCurrentEstimate(loadedEstimate);
      estimateSettingsRef.current.rehydrateFromEstimate(loadedEstimate);
      if (loadedEstimate) {
        const loadedType = loadedEstimate.estimateType
          ? normalizeEstimateMethod(loadedEstimate.estimateType)
          : DEFAULT_ESTIMATE_METHOD;
        setActiveEstimateType(loadedEstimate.estimateType);
        setSelectedEstimateMethod(loadedType);
        if (loadedEstimate.estimateType) {
          estimateSetupRef.current.restoreSavedSetup(loadedType, loadedEstimate.selectedDivisions);
          lineItemDraftRef.current.rehydrateFromVersion(
            currentEstimateToDomainVersion(loadedEstimate),
          );
        }
      } else {
        setActiveEstimateType(null);
      }
    } catch (error) {
      if (token === loadTokenRef.current) {
        setLoadError(error instanceof Error ? error.message : 'Could not load estimate');
      }
    } finally {
      if (token === loadTokenRef.current) {
        setDataLoading(false);
      }
    }
  }, [resolvedProjectId]);

  const handleStartEstimate = useCallback(async () => {
    if (!resolvedProjectId || creating || estimate != null) return;

    setCreating(true);
    setCreateError(null);
    setSaveError(null);
    setSaveToastMessage(null);
    const result = await createCurrentEstimate({
      projectId: resolvedProjectId,
      createdBy: user?.id ?? null,
      estimateType: selectedEstimateMethod,
    });

    if (result.error) {
      setCreateError(result.error);
      setCreating(false);
      return;
    }

    if (result.data) {
      const nextVersion = currentEstimateToDomainVersion(result.data);
      setCurrentEstimate(result.data);
      setActiveEstimateType(result.data.estimateType);
      estimateSetup.startSetup(selectedEstimateMethod);
      setAutoOpenScopeModalKey(result.data.id);
      lineItemDraft.rehydrateFromVersion(nextVersion);
    }
    setSaveToastMessage('Estimate started');
    navigate(estimateWorkspaceHref(resolvedProjectId, 'line-items'));
    setCreating(false);
  }, [
    resolvedProjectId,
    creating,
    estimate,
    user?.id,
    selectedEstimateMethod,
    estimateSetup,
    lineItemDraft,
    navigate,
  ]);

  const canSave =
    estimate != null &&
    estimateAdapter != null &&
    (lineItemDraft.dirty ||
      estimateSettings.dirty ||
      estimateSetup.session.selectedDivisions.length > 0 ||
      (currentEstimate?.selectedDivisions.length ?? 0) > 0) &&
    !saving;

  const handleSaveSelectedDivisions = useCallback(
    async (divisions: EstimateSelectedDivision[]) => {
      if (!currentEstimate || !estimateAdapter) return;

      const optimisticEstimate = buildOptimisticEstimateWithDivisions(currentEstimate, divisions);
      const optimisticType = normalizeEstimateMethod(estimateAdapter.estimateType);

      setCurrentEstimate(optimisticEstimate);
      setActiveEstimateType(optimisticEstimate.estimateType);
      estimateSetup.restoreSavedSetup(optimisticType, divisions);
      lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(optimisticEstimate));
      setSaveError(null);

      setSaving(true);

      const result = await saveCurrentEstimate({
        estimateId: currentEstimate.id,
        projectId: currentEstimate.projectId,
        estimateType: estimateAdapter.estimateType,
        selectedDivisions: divisions,
        lineItems: currentEstimate.lineItems,
        totals: currentEstimate.totals,
        summary: currentEstimate.summary,
        assumptions: currentEstimate.assumptions,
        status: currentEstimate.status,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        setSaveError(result.error ?? 'Failed to save selected divisions.');
        setSaving(false);
        return;
      }

      setCurrentEstimate(result.data);
      setActiveEstimateType(result.data.estimateType);
      const adapter = currentEstimateToDomainVersion(result.data);
      estimateSetup.restoreSavedSetup(
        normalizeEstimateMethod(result.data.estimateType ?? estimateAdapter.estimateType),
        result.data.selectedDivisions,
      );
      lineItemDraft.rehydrateFromVersion(adapter);
      setSaving(false);
    },
    [currentEstimate, estimateAdapter, user?.id, estimateSetup, lineItemDraft],
  );

  const handleSaveEstimate = useCallback(async () => {
    if (!estimate || !estimateAdapter || !canSave || saving) return;

    setSaving(true);
    setSaveError(null);
    setSaveToastMessage(null);

    const result = await saveCurrentEstimateWithLineItems({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      estimateType: estimateAdapter.estimateType,
      draftLines: lineItemDraft.draftLines,
      selectedDivisions: [
        ...(currentEstimate?.selectedDivisions ?? []),
        ...estimateSetup.session.selectedDivisions,
      ],
      estimateSettings: estimateSettings.settings,
      existingAssumptions: currentEstimate?.assumptions,
      createdBy: user?.id ?? null,
    });

    if (result.error || !result.data) {
      setSaveError(result.error ?? 'Failed to save estimate.');
      setSaving(false);
      return;
    }

    setSaveToastMessage(createEstimateSaveSuccessToast().message);
    setCurrentEstimate(result.data);
    lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
    estimateSettings.rehydrateFromEstimate(result.data);

    setSaving(false);
  }, [
    estimate,
    estimateAdapter,
    canSave,
    saving,
    lineItemDraft,
    estimateSettings,
    currentEstimate?.assumptions,
    currentEstimate?.selectedDivisions,
    estimateSetup.session.selectedDivisions,
    user?.id,
  ]);

  const handleSaveQuickEstimate = useCallback(
    async (payload: { inputs: QuickFeasibilityInputs; result: QuickFeasibilityResult }) => {
      if (!estimate || saving) return;

      setSaving(true);
      setSaveError(null);
      setSaveToastMessage(null);

      const result = await saveCurrentQuickFeasibilityEstimate({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        inputs: payload.inputs,
        result: payload.result,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        setSaveError(result.error ?? 'Failed to save quick feasibility estimate.');
        setSaving(false);
        return;
      }

      setSaveToastMessage(createEstimateSaveSuccessToast().message);
      setCurrentEstimate(result.data);
      lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
      setSaving(false);
    },
    [estimate, lineItemDraft, saving, user?.id],
  );

  const handleResetEstimate = useCallback(async (): Promise<boolean> => {
    if (!estimate || saving) return false;

    setSaving(true);
    setSaveError(null);
    setSaveToastMessage(null);

    const result = await resetCurrentEstimate(estimate.projectId);

    if (result.error) {
      setSaveError(result.error ?? 'Failed to reset estimate.');
      setSaving(false);
      return false;
    }

    lineItemDraft.resetDraftSetup();
    estimateSettings.rehydrateFromEstimate(null);
    estimateSetup.resetSetup(selectedEstimateMethod);
    setCurrentEstimate(null);
    setActiveEstimateType(null);
    setSaveToastMessage('Estimate reset');
    setSaving(false);
    return true;
  }, [estimate, estimateSetup, estimateSettings, lineItemDraft, saving, selectedEstimateMethod]);

  const handleConfirmResetSetup = useCallback(async () => {
    const didReset = await handleResetEstimate();
    if (!didReset) return;
    setResetModalOpen(false);
  }, [handleResetEstimate]);

  const handleApplyImportedEstimate = useCallback(
    async ({
      mode,
      importedData,
    }: {
      mode: EstimateImportApplyMode;
      importedData: ImportedEstimateData;
    }) => {
      if (!estimate || !estimateAdapter || saving) return;

      const currentSelectedDivisions = normalizeSelectedDivisions([
        ...(currentEstimate?.selectedDivisions ?? []),
        ...estimateSetup.session.selectedDivisions,
      ]);

      const applied = applyImportedEstimate({
        mode,
        currentDraftLines: lineItemDraft.draftLines,
        currentSelectedDivisions,
        imported: importedData,
      });

      setSaving(true);
      setSaveError(null);
      setSaveToastMessage(null);

      if (importedData.estimateSettings) {
        estimateSettings.replaceSettings(importedData.estimateSettings);
      }

      const result = await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: applied.draftLines,
        selectedDivisions: applied.selectedDivisions,
        estimateSettings: importedData.estimateSettings ?? estimateSettings.settings,
        existingAssumptions: currentEstimate?.assumptions,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        setSaveError(result.error ?? 'Failed to import estimate.');
        setSaving(false);
        return;
      }

      setCurrentEstimate(result.data);
      setActiveEstimateType(result.data.estimateType);
      estimateSetup.restoreSavedSetup(
        normalizeEstimateMethod(result.data.estimateType ?? estimateAdapter.estimateType),
        result.data.selectedDivisions,
      );
      lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
      estimateSettings.rehydrateFromEstimate(result.data);
      setImportCollapseDivisionCodesKey(
        `import-${Date.now()}-${applied.importedDivisionCodes.join(',')}`,
      );
      setSaveToastMessage('Estimate imported');
      setImportModalOpen(false);
      setSaving(false);
    },
    [
      estimate,
      estimateAdapter,
      saving,
      currentEstimate?.selectedDivisions,
      estimateSetup,
      estimateSettings,
      lineItemDraft,
      currentEstimate?.assumptions,
      user?.id,
    ],
  );

  const handleExportEstimate = useCallback(() => {
    if (!currentEstimate) return;
    downloadEstimateWorkbook(currentEstimate, project?.name ?? 'project');
  }, [currentEstimate, project?.name]);

  // ── Schedule save helpers ──────────────────────────────────────────────────

  const handleLogicLinksChange = useCallback(
    async (links: CpmLogicLink[]) => {
      if (!currentEstimate || !estimateAdapter) return;
      scheduleSettingsHook.setLogicLinks(links);
      const updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: links,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
        },
        currentEstimate.assumptions as Record<string, unknown>,
      );
      await saveCurrentEstimateWithLineItems({
        estimateId: currentEstimate.id,
        projectId: currentEstimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: currentEstimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });
    },
    [
      currentEstimate,
      estimateAdapter,
      lineItemDraft.draftLines,
      estimateSettings.settings,
      scheduleSettingsHook,
      user?.id,
    ],
  );

  const persistLogicNetworkLayout = useCallback(
    async (layout: LogicNetworkLayout[]) => {
      if (!currentEstimate || !estimateAdapter) {
        throw new Error('No estimate available');
      }
      scheduleSettingsHook.setLogicNetworkLayout(layout);
      const updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: layout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
        },
        currentEstimate.assumptions as Record<string, unknown>,
      );
      const result = await saveCurrentEstimateWithLineItems({
        estimateId: currentEstimate.id,
        projectId: currentEstimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: currentEstimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });
      if (result.error || !result.data) {
        throw new Error(result.error ?? 'Failed to save logic layout');
      }
    },
    [
      currentEstimate,
      estimateAdapter,
      lineItemDraft.draftLines,
      estimateSettings.settings,
      scheduleSettingsHook,
      user?.id,
    ],
  );

  const handleLogicNetworkLayoutChange = useCallback(
    async (layout: LogicNetworkLayout[]) => {
      try {
        await persistLogicNetworkLayout(layout);
      } catch (error) {
        console.error('[Logic Network] Layout auto-save failed', error);
      }
    },
    [persistLogicNetworkLayout],
  );

  const handleSaveLogicNetworkLayout = useCallback(
    async (layout: LogicNetworkLayout[]) => {
      await persistLogicNetworkLayout(layout);
    },
    [persistLogicNetworkLayout],
  );

  const handleApplyResourceLeveling = useCallback(async () => {
    if (!levelingModalResult || !currentEstimate || !estimateAdapter) return;
    const newOffsets: Record<string, number> = {};
    for (const moved of levelingModalResult.movedActivities) {
      newOffsets[moved.activityCode] = moved.daysMoved;
    }
    scheduleSettingsHook.setLeveledOffsets(newOffsets);
    const updatedAssumptions = mergeScheduleAssumptions(
      {
        logicLinks: scheduleSettingsHook.logicLinks,
        logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
        scheduleSettings: scheduleSettingsHook.scheduleSettings,
        leveledActivityOffsets: newOffsets,
      },
      currentEstimate.assumptions as Record<string, unknown>,
    );
    await saveCurrentEstimateWithLineItems({
      estimateId: currentEstimate.id,
      projectId: currentEstimate.projectId,
      estimateType: estimateAdapter.estimateType,
      draftLines: lineItemDraft.draftLines,
      selectedDivisions: currentEstimate.selectedDivisions,
      estimateSettings: estimateSettings.settings,
      existingAssumptions: updatedAssumptions,
      createdBy: user?.id ?? null,
    });
    setLevelingModalResult(null);
  }, [
    levelingModalResult,
    currentEstimate,
    estimateAdapter,
    lineItemDraft.draftLines,
    estimateSettings.settings,
    scheduleSettingsHook,
    user?.id,
  ]);

  const handleRunResourceLeveling = useCallback(() => {
    if (!cpmResult || !scheduleActivitiesResult.activities.length) return;
    const result = resourceLevelSchedule({
      activities: scheduleActivitiesResult.activities,
      logicLinks: scheduleSettingsHook.logicLinks,
      availableCrewSize: scheduleSettingsHook.scheduleSettings.availableCrewSize,
      projectStartDate:
        scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
    });
    setLevelingModalResult(result);
  }, [cpmResult, scheduleActivitiesResult.activities, scheduleSettingsHook]);

  const runCpmGanttExport = useCallback(
    async (format: 'pdf' | 'excel') => {
      if (!estimateAdapter || !cpmResult) return;
      setSaveToastMessage('Preparing CPM export…');
      try {
        const exportParams = {
          schedule: null as BuildGanttScheduleResult | null,
          projectName: project?.name ?? 'project',
          estimateType: estimateAdapter.estimateType,
          cpmResult,
          activities: scheduleActivitiesResult.activities,
          logicLinks: scheduleSettingsHook.logicLinks,
          projectStartDate:
            scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledOffsets: scheduleSettingsHook.leveledOffsets,
          resourceHistogram,
        };
        if (format === 'pdf') {
          const chartElement = ganttExportRef.current;
          if (!chartElement) {
            setSaveToastMessage('Gantt chart is not ready for export.');
            return;
          }
          await downloadLevelThreeGanttPdfFromElement({
            chartElement,
            projectName: project?.name ?? 'project',
          });
          setSaveToastMessage('Gantt PDF exported');
        } else {
          await downloadGanttExcel(exportParams as Parameters<typeof downloadGanttExcel>[0]);
          setSaveToastMessage('Gantt Excel exported');
        }
      } catch {
        setSaveToastMessage('Could not export Gantt');
      }
    },
    [
      estimateAdapter,
      cpmResult,
      project?.name,
      scheduleActivitiesResult.activities,
      scheduleSettingsHook,
      resourceHistogram,
    ],
  );

  const handleDownloadImportTemplate = useCallback(() => {
    downloadBlankEstimateTemplateWorkbook();
  }, []);

  const runGanttExport = useCallback(
    async (format: 'pdf' | 'excel') => {
      if (!estimateAdapter) return;

      setSaveToastMessage('Preparing Gantt export...');

      try {
        const prepared = prepareGanttExport({
          lineItems: estimateAdapter.lineItems,
          projectStartDate: schedulePlanControls.projectStartDate,
          includeWeekends: schedulePlanControls.includeWeekends,
          estimateSettings: estimateSettings.settings,
        });

        if (!prepared.ok) {
          setSaveToastMessage(prepared.message);
          return;
        }

        const exportParams = {
          schedule: prepared.schedule,
          projectName: project?.name ?? 'project',
          estimateType: estimateAdapter.estimateType,
        };

        if (format === 'pdf') {
          await downloadGanttPdf(exportParams);
          setSaveToastMessage('Gantt PDF exported');
          return;
        }

        await downloadGanttExcel(exportParams);
        setSaveToastMessage('Gantt Excel exported');
      } catch {
        setSaveToastMessage('Could not export Gantt');
      }
    },
    [
      estimateAdapter,
      estimateSettings.settings,
      project?.name,
      schedulePlanControls.includeWeekends,
      schedulePlanControls.projectStartDate,
    ],
  );

  const handleExportGanttPdf = useCallback(() => {
    void runGanttExport('pdf');
  }, [runGanttExport]);

  const handleExportGanttExcel = useCallback(() => {
    void runGanttExport('excel');
  }, [runGanttExport]);

  if (plannerLoading) {
    return (
      <div className={PLANNER_PAGE_BG}>
        <EstimateWorkspaceLoading />
      </div>
    );
  }

  if (accessDenied || !resolvedProjectId) {
    return null;
  }

  const hasEstimate = estimate != null;
  const hasEstimateAdapter = estimateAdapter != null;
  const selectedDivisionCount = currentEstimate?.selectedDivisions.length ?? 0;
  const lineItemCount = currentEstimate?.lineItems.length ?? 0;
  const tabRenderOptions = { isLoading: dataLoading, hasEstimate };
  const showOverviewLoading = activeTab === 'overview' && dataLoading;
  const showEstimateTabLoading = activeTab === 'line-items' && dataLoading;
  const showEstimateTypeSelection = shouldShowEstimateTypeSelectionOnTab(activeTab, tabRenderOptions);
  const showOverviewNoEstimate = shouldShowOverviewNoEstimateMessage(activeTab, tabRenderOptions);
  const showOverviewFinancialSummary = shouldShowOverviewFinancialSummary(
    activeTab,
    tabRenderOptions,
  );
  const showEstimateBuilder = shouldShowEstimateBuilderPanel(activeTab, tabRenderOptions);
  const isQuickFeasibilityEstimate =
    estimateAdapter?.estimateType === 'quick_feasibility' ||
    activeEstimateType === 'quick_feasibility';
  const canEditEstimate = hasEstimate && hasEstimateAdapter;
  const showCollapseAll = shouldShowCollapseAllAction(
    activeTab,
    builderToolbarHandlers?.showCollapseAll ?? false,
  );
  const showResetForm = shouldShowResetFormAction(
    activeTab,
    hasEstimate,
    activeEstimateType,
    estimateSetup,
    canEditEstimate || activeEstimateType != null,
  );
  const showEstimateSettings = shouldShowEstimateSettingsPanel(activeTab, tabRenderOptions);
  const showSaveBucket = shouldShowBucketSaveAction(
    activeTab,
    hasEstimate,
    activeEstimateType,
    isQuickFeasibilityEstimate,
    builderToolbarHandlers?.showCollapseAll ?? false,
  );
  const showSaveQuick = shouldShowQuickSaveAction(
    activeTab,
    builderToolbarHandlers?.showSaveQuick ?? false,
  );
  const resolvedEstimateType = currentEstimate?.estimateType ?? activeEstimateType;
  const showImportExport = shouldShowBidImportExportActions(
    activeTab,
    hasEstimate,
    resolvedEstimateType,
  );

  console.log('[Estimate Render]', {
    projectId: resolvedProjectId,
    isLoadingEstimate: dataLoading,
    hasCurrentEstimate: Boolean(currentEstimate?.id),
    activeEstimateType: currentEstimate?.estimateType ?? activeEstimateType,
    selectedDivisionCount,
    lineItemCount,
  });

  return (
    <>
      <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <EstimateWorkspaceTabBar
          activeTabId={activeTab}
          onTabChange={handleTabChange}
          rightActions={
            <EstimateWorkspaceToolbarActions
              showCollapseAll={showCollapseAll}
              showReset={showResetForm}
              showSaveBucket={showSaveBucket}
              showSaveQuick={showSaveQuick}
              showImportExport={showImportExport}
              canEdit={canEditEstimate || activeEstimateType != null}
              canSave={canSave}
              canSaveQuick={builderToolbarHandlers?.canSaveQuick ?? false}
              saving={saving}
              handlers={builderToolbarHandlers}
              onReset={() => {
                if (activeTab === 'settings') {
                  estimateSettings.resetSettings();
                  return;
                }
                setResetModalOpen(true);
              }}
              onSave={handleSaveEstimate}
              onImportEstimate={() => setImportModalOpen(true)}
              onExportEstimate={handleExportEstimate}
              onDownloadImportTemplate={handleDownloadImportTemplate}
            />
          }
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loadError ? (
          <div className="mb-4 space-y-3">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not load estimate data"
              body={loadError}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dataLoading}
              isLoading={dataLoading}
              onClick={handleRetryLoadEstimate}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {createError ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not start estimate"
              body={createError}
            />
          </div>
        ) : null}

        {saveError ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not save estimate"
              body={saveError}
            />
          </div>
        ) : null}

        {!loadError && showOverviewLoading ? (
          <p className={`py-12 text-center text-sm ${PLANNER_MUTED}`}>{LOADING_ESTIMATE_MESSAGE}</p>
        ) : null}

        {!loadError && showEstimateTabLoading ? (
          <p className={`py-12 text-center text-sm ${PLANNER_MUTED}`}>{LOADING_ESTIMATE_MESSAGE}</p>
        ) : null}

        {!loadError && showOverviewNoEstimate ? (
          <EstimateWorkspaceEmptyState
            title="No estimate started"
            body={OVERVIEW_NO_ESTIMATE_MESSAGE}
          />
        ) : null}

        {!loadError && showOverviewFinancialSummary && hasEstimateAdapter ? (
          <EstimateTotalsReviewPanel version={estimateAdapter} loading={dataLoading} />
        ) : null}

        {!loadError && showEstimateTypeSelection ? (
          <div className="space-y-4">
            <EstimateMethodSelector
              value={selectedEstimateMethod}
              onChange={setSelectedEstimateMethod}
              disabled={creating}
            />
            <EstimateWorkspaceEmptyState
              title="No estimate has been started for this project yet"
              body="Choose an estimate type and click Start Estimate."
            />
            <Button
              variant="accent"
              size="sm"
              icon={<Play className="h-4 w-4" />}
              disabled={creating}
              isLoading={creating}
              className="w-full sm:w-auto"
              onClick={handleStartEstimate}
            >
              {creating ? 'Starting...' : 'Start Estimate'}
            </Button>
          </div>
        ) : null}

        {!loadError && showEstimateSettings && hasEstimate ? (
          <EstimateSettingsPanel
            settingsState={estimateSettings}
            canEdit={canEditEstimate}
          />
        ) : null}

        {!loadError && !dataLoading && activeTab === 'settings' && !hasEstimate ? (
          <EstimateWorkspaceEmptyState
            title="No estimate started"
            body={TAB_NO_ESTIMATE_MESSAGE}
          />
        ) : null}

        {!loadError && showEstimateBuilder && estimate && hasEstimateAdapter ? (
          <EstimateLineItemsBuilderPanel
            estimate={estimate}
            version={estimateAdapter}
            canEdit={hasEstimate && hasEstimateAdapter}
            saving={saving}
            draft={lineItemDraft}
            setup={estimateSetup}
            projectLocationLabel={project?.locationLabel}
            projectScopeContext={projectScopeContext}
            autoOpenScopeModalKey={autoOpenScopeModalKey}
            onAutoOpenScopeModalConsumed={() => setAutoOpenScopeModalKey(null)}
            onSaveQuick={handleSaveQuickEstimate}
            persistedSelectedDivisions={currentEstimate?.selectedDivisions ?? []}
            onSaveSelectedDivisions={handleSaveSelectedDivisions}
            onToolbarHandlersChange={setBuilderToolbarHandlers}
            importCollapseDivisionCodesKey={importCollapseDivisionCodesKey}
            focusActivityCode={focusActivityCode}
            onFocusActivityConsumed={() => setFocusActivityCode(null)}
          />
        ) : null}

        {!loadError && !dataLoading && activeTab === 'schedule-preview' ? (
          hasEstimate && estimate ? (
            <div className="space-y-4">
              {estimateAdapter && shouldShowRoughSchedulePreviewNote(estimateAdapter.estimateType) ? (
                <div className={`${PLANNER_FORM_PANEL} text-sm ${TEXT_BODY}`}>
                  <p className={PLANNER_MUTED}>{ROUGH_SCHEDULE_PREVIEW_NOTE}</p>
                </div>
              ) : null}
              <EstimateSchedulePreviewPanel
                version={hasEstimateAdapter ? estimateAdapter : null}
                plan={schedulePlan}
                datePlanResult={scheduleDatePlanResult}
                planControls={schedulePlanControls}
                onPlanControlsChange={handleSchedulePlanControlsChange}
                loading={dataLoading}
              />
            </div>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {!loadError && !dataLoading && activeTab === 'gantt-preview' ? (
          hasEstimate ? (
            <EstimateGanttPreview
              datePlanResult={scheduleDatePlanResult}
              loading={dataLoading}
              exportReady={ganttExportReady}
              onExportPdf={handleExportGanttPdf}
              onExportExcel={handleExportGanttExcel}
            />
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {!loadError && !dataLoading && activeTab === 'logic-network' ? (
          hasEstimate ? (
            <div className="space-y-4">
              {scheduleActivitiesResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {scheduleActivitiesResult.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
              <LogicNetworkWorkspace
                canvasKey={resolvedProjectId ?? 'no-project'}
                activities={scheduleActivitiesResult.activities}
                logicLinks={scheduleSettingsHook.logicLinks}
                cpmResult={cpmResult}
                layout={scheduleSettingsHook.logicNetworkLayout}
                onLinksChange={handleLogicLinksChange}
                onLayoutChange={handleLogicNetworkLayoutChange}
                onSaveLayout={handleSaveLogicNetworkLayout}
              />
            </div>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {!loadError && !dataLoading && activeTab === 'level-iii-gantt' ? (
          hasEstimate ? (
            <div className="space-y-6">
              <div ref={ganttExportRef} className="space-y-6">
                <LevelThreeGantt
                  activities={scheduleActivitiesResult.activities}
                  cpmResult={cpmResult}
                  scheduleSettings={scheduleSettingsHook.scheduleSettings}
                  leveledOffsets={scheduleSettingsHook.leveledOffsets}
                  logicLinks={scheduleSettingsHook.logicLinks}
                  lineItems={estimateAdapter?.lineItems ?? []}
                  onEditActivity={handleEditActivityFromGantt}
                  exportReady={Boolean(cpmResult)}
                  onExportPdf={() => void runCpmGanttExport('pdf')}
                  onExportExcel={() => void runCpmGanttExport('excel')}
                />
                <ResourceHistogram
                  histogram={resourceHistogram}
                  projectDurationDays={cpmResult?.projectDurationDays ?? 0}
                />
              </div>
              {cpmResult && scheduleActivitiesResult.activities.length > 0 && (
                <div className="flex">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={handleRunResourceLeveling}
                  >
                    Run resource leveling
                  </button>
                  {Object.keys(scheduleSettingsHook.leveledOffsets).length > 0 && (
                    <button
                      type="button"
                      className="ml-2 rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={() => {
                        scheduleSettingsHook.setLeveledOffsets({});
                        void handleApplyResourceLeveling();
                      }}
                    >
                      Clear leveling
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        </div>
      </div>
      <EstimateResetSetupConfirmModal
        isOpen={resetModalOpen}
        hasSavedActivities={(estimateAdapter?.lineItems.length ?? 0) > 0}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmResetSetup}
      />
      <EstimateImportModal
        isOpen={importModalOpen}
        saving={saving}
        onClose={() => setImportModalOpen(false)}
        onApply={handleApplyImportedEstimate}
      />
      {levelingModalResult && (
        <ResourceLevelingModal
          result={levelingModalResult}
          onApply={() => void handleApplyResourceLeveling()}
          onCancel={() => setLevelingModalResult(null)}
        />
      )}
      <EstimateWorkspaceToast
        message={saveToastMessage}
        onDismiss={() => setSaveToastMessage(null)}
      />
    </>
  );
}
