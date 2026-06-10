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
import { useProjectStore } from '../../../store';
import { DEFAULT_ESTIMATE_METHOD, normalizeEstimateMethod } from '../domain/estimateMethods';
import type { EstimateSelectedDivision, EstimateType } from '../domain/estimateTypes';
import {
  buildDomainTasksFromDraftLines,
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
import { useDefinitionsHelpStore } from '../../help/definitionsHelpStore';
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
import type { PositiveIntegerInputHandle } from './components/PositiveIntegerInput';
import { commitPositiveIntegerInput } from './estimateFormDefaults';
import { useEstimateSettings } from './hooks/useEstimateSettings';
import {
  shouldShowAddDivisionAction,
  shouldShowBidImportExportActions,
  shouldShowBucketSaveAction,
  shouldShowCollapseAllAction,
  shouldShowQuickSaveAction,
  shouldShowResetFormAction,
  type EstimateBuilderToolbarHandlers,
} from './estimateWorkspaceToolbar';
import EstimateImportModal from './EstimateImportModal';
import ConstructionActivityBuilderPanel from './components/ConstructionActivityBuilderPanel';
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
import { runCpmCalculation } from '../scheduling/cpm/calculateCpm';
import type {
  CpmLogicLink,
  LogicNetworkLayout,
  LogicNetworkViewMode,
  ScheduleSettings,
} from '../scheduling/cpmTypes';
import { validateCpmReadiness } from '../scheduling/logic/validateCpmReadiness';
import type { LogicBatchSnapshot } from '../scheduling/logic/logicTypes';
import {
  buildPrecedenceDiagramRunState,
  currentPrecedenceDiagramSignaturesMatch,
  markPrecedenceDiagramStale,
} from '../scheduling/precedenceDiagram';
import {
  buildScheduleActivitySignature,
  mergeScheduleAssumptions,
  mergeScheduleAssumptionsForAddImport,
  resetScheduleAssumptionsForReplacement,
  sanitizeLogicLinksForActivities,
} from '../scheduling/scheduleAssumptions';
import { useScheduleSettings } from './hooks/useScheduleSettings';
import LogicNetworkWorkspace from './components/scheduling/LogicNetworkWorkspace';
import LevelThreeGanttWorkspace from './components/scheduling/LevelThreeGanttWorkspace';
import ResourceLevelingModal from './components/scheduling/ResourceLevelingModal';
import { calculateResourceHistogram } from '../scheduling/resources/resourceHistogramCalculator';
import { resourceLevelSchedule } from '../scheduling/resources/resourceLevelSchedule';
import { resolveProjectAvailableCrewSize } from '../scheduling/resources/projectAvailableCrewSize';
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

// Stable empty fallback — avoids creating a new array reference on every render
// which would destabilise selectedDivisionCodes → workBreakdown → handleCollapseAll.
const EMPTY_SELECTED_DIVISIONS: EstimateSelectedDivision[] = [];

export default function EstimateWorkspacePage() {
  const { projectId: routeProjectId, estimateTab } = useParams<{
    projectId: string;
    estimateTab?: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    projectId,
    project,
    loading: plannerLoading,
    accessDenied,
    reload: reloadPlannerProject,
  } = usePlannerProject();
  const updateProject = useProjectStore((state) => state.updateProject);
  const [projectCrewSizeSaving, setProjectCrewSizeSaving] = useState(false);
  const [optimisticProjectCrewSize, setOptimisticProjectCrewSize] = useState<number | null>(null);
  const [projectCrewSizeDraftDirty, setProjectCrewSizeDraftDirty] = useState(false);
  const projectCrewSizeInputRef = useRef<PositiveIntegerInputHandle>(null);
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
  const estimateSettings = useEstimateSettings();
  const lineItemDraft = useEstimateLineItemDraft(estimateAdapter, estimateSettings.settings);
  const rehydrateDraftFromVersion = lineItemDraft.rehydrateFromVersion;
  const scheduleSettingsHook = useScheduleSettings();
  const currentEstimateRef = useRef(currentEstimate);
  useEffect(() => {
    currentEstimateRef.current = currentEstimate;
  }, [currentEstimate]);
  const ganttExportRef = useRef<HTMLDivElement>(null);
  const [levelingModalResult, setLevelingModalResult] = useState<import('../scheduling/cpmTypes').ResourceLevelingResult | null>(null);
  const [levelingAllowProjectExtension, setLevelingAllowProjectExtension] = useState(false);

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

  const cpmResult = scheduleSettingsHook.committedCpmResult;

  const cpmReadiness = useMemo(
    () =>
      validateCpmReadiness({
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
      }),
    [scheduleActivitiesResult.activities, scheduleSettingsHook.logicLinks],
  );

  const scheduleActivitySignature = useMemo(
    () =>
      estimateAdapter
        ? buildScheduleActivitySignature(estimateAdapter.lineItems)
        : '',
    [estimateAdapter],
  );

  const projectAvailableCrewSize = useMemo(
    () =>
      resolveProjectAvailableCrewSize({
        projectCrewSize: optimisticProjectCrewSize ?? project?.projectCrewSize,
        legacyAvailableCrewSize: scheduleSettingsHook.scheduleSettings.availableCrewSize,
      }),
    [
      optimisticProjectCrewSize,
      project?.projectCrewSize,
      scheduleSettingsHook.scheduleSettings.availableCrewSize,
    ],
  );

  useEffect(() => {
    if (
      optimisticProjectCrewSize != null &&
      project?.projectCrewSize === optimisticProjectCrewSize
    ) {
      setOptimisticProjectCrewSize(null);
    }
  }, [optimisticProjectCrewSize, project?.projectCrewSize]);

  const handleProjectCrewSizeChange = useCallback(
    async (nextValue: number) => {
      if (!project?.id || !estimate || !estimateAdapter) {
        return;
      }
      const normalized = Math.max(1, Math.min(999, Math.round(nextValue)));
      setOptimisticProjectCrewSize(normalized);
      setProjectCrewSizeSaving(true);
      try {
        await updateProject(project.id, { projectCrewSize: normalized });
        await reloadPlannerProject();
        setProjectCrewSizeDraftDirty(false);
        setSaveToastMessage('Project crew size saved');
      } catch {
        setOptimisticProjectCrewSize(null);
        setSaveToastMessage('Could not save project crew size');
      } finally {
        setProjectCrewSizeSaving(false);
      }
    },
    [project?.id, estimate, estimateAdapter, updateProject, reloadPlannerProject],
  );

  const handleProjectCrewSizeDraftChange = useCallback(
    (raw: string) => {
      const { committed } = commitPositiveIntegerInput(raw, projectAvailableCrewSize, {
        min: 1,
        max: 999,
      });
      setProjectCrewSizeDraftDirty(committed !== null);
    },
    [projectAvailableCrewSize],
  );

  const resourceHistogram = useMemo(() => {
    if (!cpmResult || scheduleActivitiesResult.activities.length === 0) return [];
    return calculateResourceHistogram({
      activities: scheduleActivitiesResult.activities,
      cpmActivities: cpmResult.activities,
      projectStartDate:
        scheduleSettingsHook.scheduleSettings.projectStartDate ||
        getTodayScheduleDateYmd(),
      availableCrewSize: projectAvailableCrewSize,
      leveledOffsets: scheduleSettingsHook.leveledOffsets,
    });
  }, [
    cpmResult,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook.scheduleSettings.projectStartDate,
    scheduleSettingsHook.leveledOffsets,
    projectAvailableCrewSize,
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

      const settingsPatch: Partial<ScheduleSettings> = {};
      if (patch.projectStartDate !== undefined) {
        settingsPatch.projectStartDate = patch.projectStartDate;
      }
      if (patch.includeWeekends !== undefined) {
        settingsPatch.includeWeekends = patch.includeWeekends;
      }
      if (Object.keys(settingsPatch).length > 0) {
        scheduleSettingsHook.updateScheduleSettings(settingsPatch);
      }
    },
    [scheduleSettingsHook],
  );

  useEffect(() => {
    const loaded = scheduleSettingsHook.scheduleSettings.projectStartDate;
    if (!loaded) return;
    setSchedulePlanControls((current) =>
      current.projectStartDate === loaded
        ? current
        : { ...current, projectStartDate: loaded },
    );
  }, [scheduleSettingsHook.scheduleSettings.projectStartDate]);

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
    scheduleSettingsRef.current.rehydrateFromEstimate(null, []);

    try {
      const loadedEstimate = await loadCurrentEstimateForProject(projectId);
      if (token !== loadTokenRef.current) return;

      setCurrentEstimate(loadedEstimate);
      estimateSettingsRef.current.rehydrateFromEstimate(loadedEstimate);
      scheduleSettingsRef.current.rehydrateFromEstimate(
        loadedEstimate,
        (loadedEstimate?.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
      );
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
      scheduleSettingsHook.rehydrateFromEstimate(
        result.data,
        (result.data.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
      );
      setLevelingModalResult(null);
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
    scheduleSettingsHook,
    navigate,
  ]);

  const canSave =
    estimate != null &&
    estimateAdapter != null &&
    (lineItemDraft.dirty ||
      estimateSettings.dirty ||
      estimateSetup.session.selectedDivisions.length > 0 ||
      (currentEstimate?.selectedDivisions.length ?? 0) > 0 ||
      projectCrewSizeDraftDirty) &&
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

    const pendingCrewCommit = projectCrewSizeInputRef.current?.flushCommit() ?? null;
    if (pendingCrewCommit !== null) {
      setProjectCrewSizeDraftDirty(false);
      await handleProjectCrewSizeChange(pendingCrewCommit);
    }

    const hasEstimateChanges =
      lineItemDraft.dirty ||
      estimateSettings.dirty ||
      estimateSetup.session.selectedDivisions.length > 0 ||
      (currentEstimate?.selectedDivisions.length ?? 0) > 0;

    if (!hasEstimateChanges) {
      setSaving(false);
      return;
    }

    const precedenceDiagramForSave = scheduleSettingsHook.precedenceDiagram.hasRunCpm
      ? currentPrecedenceDiagramSignaturesMatch({
          saved: scheduleSettingsHook.precedenceDiagram,
          activities: scheduleActivitiesResult.activities,
          logicLinks: scheduleSettingsHook.logicLinks,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
        })
        ? scheduleSettingsHook.precedenceDiagram
        : markPrecedenceDiagramStale(scheduleSettingsHook.precedenceDiagram)
      : scheduleSettingsHook.precedenceDiagram;

    if (
      precedenceDiagramForSave.hasRunCpm !== scheduleSettingsHook.precedenceDiagram.hasRunCpm
    ) {
      scheduleSettingsHook.setPrecedenceDiagram(precedenceDiagramForSave);
      scheduleSettingsHook.setCommittedCpmResult(null);
      scheduleSettingsHook.setCpmWarningMessage(
        'Logic or activity data changed since CPM was last run. Run CPM again.',
      );
    }

    const saveAssumptions = mergeScheduleAssumptions(
      {
        scheduleSettings: scheduleSettingsHook.scheduleSettings,
        logicLinks: scheduleSettingsHook.logicLinks,
        logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
        leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
        logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
        logicNetworkInitialized: scheduleSettingsHook.logicNetworkInitialized,
        logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode,
        precedenceDiagram: precedenceDiagramForSave,
      },
      (currentEstimateRef.current?.assumptions as Record<string, unknown>) ?? {},
    );

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
      existingAssumptions: saveAssumptions,
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
    scheduleSettingsHook.rehydrateFromEstimate(
      result.data,
      (result.data.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
    );

    setSaving(false);
  }, [
    estimate,
    estimateAdapter,
    canSave,
    saving,
    lineItemDraft,
    estimateSettings,
    scheduleSettingsHook,
    currentEstimate?.assumptions,
    currentEstimate?.selectedDivisions,
    estimateSetup.session.selectedDivisions,
    user?.id,
    projectCrewSizeDraftDirty,
    handleProjectCrewSizeChange,
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
      rehydrateDraftFromVersion(currentEstimateToDomainVersion(result.data));
      setSaving(false);
    },
    [estimate, rehydrateDraftFromVersion, saving, user?.id],
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
    scheduleSettingsHook.rehydrateFromEstimate(null, []);
    estimateSetup.resetSetup(selectedEstimateMethod);
    setLevelingModalResult(null);
    setCurrentEstimate(null);
    setActiveEstimateType(null);
    setSaveToastMessage('Estimate reset');
    setSaving(false);
    return true;
  }, [
    estimate,
    estimateSetup,
    estimateSettings,
    lineItemDraft,
    saving,
    scheduleSettingsHook,
    selectedEstimateMethod,
  ]);

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

      const mergedLineItems = buildDomainTasksFromDraftLines({
        draftLines: applied.draftLines,
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        selectedDivisions: applied.selectedDivisions,
        estimateSettings: importedData.estimateSettings ?? estimateSettings.settings,
      });
      const importedLineItems = buildDomainTasksFromDraftLines({
        draftLines: importedData.draftLines,
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        selectedDivisions: importedData.selectedDivisions,
        estimateSettings: importedData.estimateSettings ?? estimateSettings.settings,
      });

      const importAssumptions =
        mode === 'replace'
          ? resetScheduleAssumptionsForReplacement(
              currentEstimate?.assumptions as Record<string, unknown> | undefined,
              mergedLineItems,
            )
          : mergeScheduleAssumptionsForAddImport(
              currentEstimate?.assumptions as Record<string, unknown> | undefined,
              mergedLineItems,
              importedLineItems,
            );

      const result = await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: applied.draftLines,
        selectedDivisions: applied.selectedDivisions,
        estimateSettings: importedData.estimateSettings ?? estimateSettings.settings,
        existingAssumptions: importAssumptions,
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
      scheduleSettingsHook.rehydrateFromEstimate(
        result.data,
        (result.data.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
      );
      setLevelingModalResult(null);
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
      scheduleSettingsHook,
      user?.id,
    ],
  );

  const handleExportEstimate = useCallback(() => {
    if (!currentEstimate) return;
    downloadEstimateWorkbook(currentEstimate, project?.name ?? 'project');
  }, [currentEstimate, project?.name]);

  // ── Schedule save helpers ──────────────────────────────────────────────────

  const saveLogicLinksSafely = useCallback(
    async (
      nextLinks: CpmLogicLink[],
      options: {
        batchSnapshot?: LogicBatchSnapshot | null;
        clearLevelingState?: boolean;
        allowEmpty?: boolean;
      } = {},
    ) => {
      const estimate = currentEstimateRef.current;
      if (!estimate || !estimateAdapter) return;

      const activityCodes = new Set(
        scheduleActivitiesResult.activities.map((activity) => activity.activityCode),
      );
      const sanitized = sanitizeLogicLinksForActivities(nextLinks, activityCodes);

      scheduleSettingsHook.setLogicLinks(sanitized);
      scheduleSettingsHook.setLogicNetworkInitialized(true);
      scheduleSettingsHook.setCommittedCpmResult(null);
      const stalePrecedenceDiagram = markPrecedenceDiagramStale(
        scheduleSettingsHook.precedenceDiagram,
      );
      scheduleSettingsHook.setPrecedenceDiagram(stalePrecedenceDiagram);
      scheduleSettingsHook.setCpmWarningMessage(
        'Logic or activity data changed since CPM was last run. Run CPM again.',
      );

      if (options.clearLevelingState) {
        scheduleSettingsHook.setLeveledOffsets({});
      }

      const leveledOffsets = options.clearLevelingState
        ? {}
        : scheduleSettingsHook.leveledOffsets;

      let updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: sanitized,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: true,
          precedenceDiagram: stalePrecedenceDiagram,
          cpmResultCache: null,
          ...(options.batchSnapshot !== undefined
            ? { lastLogicSuggestionBatch: options.batchSnapshot }
            : {}),
        },
        estimate.assumptions as Record<string, unknown>,
      );

      if (options.clearLevelingState) {
        const {
          resourceLevelingResults: _resourceLevelingResults,
          logicReviewAiSuggestions: _logicReviewAiSuggestions,
          ...withoutLevelingExtras
        } = updatedAssumptions;
        updatedAssumptions = withoutLevelingExtras;
      }

      if (import.meta.env.DEV && options.allowEmpty && sanitized.length === 0) {
        console.info('[Logic Network]', {
          action: 'clear',
          activityCount: scheduleActivitiesResult.activities.length,
          linkCount: 0,
          initialized: true,
          hasValidCriticalPath: cpmResult?.hasValidCriticalPath ?? false,
          criticalPathStatus: cpmResult?.criticalPathStatus ?? 'unknown',
        });
      }

      const result = await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: estimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        setSaveToastMessage(result.error ?? 'Failed to save logic links');
      } else {
        setCurrentEstimate(result.data);
      }
    },
    [
      cpmResult?.criticalPathStatus,
      cpmResult?.hasValidCriticalPath,
      estimateAdapter,
      estimateSettings.settings,
      lineItemDraft.draftLines,
      scheduleActivitiesResult.activities,
      scheduleSettingsHook,
      user?.id,
    ],
  );

  const handleLogicLinksChange = useCallback(
    async (links: CpmLogicLink[], batchSnapshot?: LogicBatchSnapshot | null) => {
      await saveLogicLinksSafely(links, {
        ...(batchSnapshot !== undefined ? { batchSnapshot } : {}),
      });
    },
    [saveLogicLinksSafely],
  );

  const [runCpmBusy, setRunCpmBusy] = useState(false);

  const handleRunCpm = useCallback(async () => {
    const estimate = currentEstimateRef.current;
    if (!estimate || !estimateAdapter) return;
    if (!cpmReadiness.canRunCpm) return;

    setRunCpmBusy(true);
    try {
      const result = runCpmCalculation({
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
      });
      const precedenceDiagram = buildPrecedenceDiagramRunState({
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
        scheduleSettings: scheduleSettingsHook.scheduleSettings,
      });
      scheduleSettingsHook.setCommittedCpmResult(result);
      scheduleSettingsHook.setPrecedenceDiagram(precedenceDiagram);
      scheduleSettingsHook.setCpmWarningMessage(null);

      const updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: true,
          logicNetworkViewMode: 'precedence-diagram',
          precedenceDiagram,
        },
        estimate.assumptions as Record<string, unknown>,
      );

      scheduleSettingsHook.setLogicNetworkViewMode('precedence-diagram');

      const saveResult = await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: estimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });

      if (saveResult.error || !saveResult.data) {
        setSaveToastMessage(saveResult.error ?? 'Failed to save CPM results');
      } else {
        setCurrentEstimate(saveResult.data);
      }
    } finally {
      setRunCpmBusy(false);
    }
  }, [
    cpmReadiness.canRunCpm,
    estimateAdapter,
    estimateSettings.settings,
    lineItemDraft.draftLines,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook,
    user?.id,
  ]);

  const handleLogicNetworkViewModeChange = useCallback(
    async (mode: LogicNetworkViewMode) => {
      const estimate = currentEstimateRef.current;
      if (!estimate || !estimateAdapter) return;
      scheduleSettingsHook.setLogicNetworkViewMode(mode);
      const updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: true,
          logicNetworkViewMode: mode,
        },
        estimate.assumptions as Record<string, unknown>,
      );
      await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: estimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });
    },
    [
      estimateAdapter,
      estimateSettings.settings,
      lineItemDraft.draftLines,
      scheduleSettingsHook,
      user?.id,
    ],
  );

  const persistLogicNetworkLayout = useCallback(
    async (layout: LogicNetworkLayout[]) => {
      const estimate = currentEstimateRef.current;
      if (!estimate || !estimateAdapter) {
        throw new Error('No estimate available');
      }
      scheduleSettingsHook.setLogicNetworkLayout(layout);
      const updatedAssumptions = mergeScheduleAssumptions(
        {
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: layout,
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: true,
          logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode,
          precedenceDiagram: scheduleSettingsHook.precedenceDiagram,
        },
        estimate.assumptions as Record<string, unknown>,
      );

      const result = await saveCurrentEstimateWithLineItems({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        estimateType: estimateAdapter.estimateType,
        draftLines: lineItemDraft.draftLines,
        selectedDivisions: estimate.selectedDivisions,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });
      if (result.error || !result.data) {
        throw new Error(result.error ?? 'Failed to save logic layout');
      }
      setCurrentEstimate(result.data);
    },
    [
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
    const estimate = currentEstimateRef.current;
    if (!levelingModalResult || !estimate || !estimateAdapter) return;
    if (levelingModalResult.movedActivities.length === 0) return;
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
        logicNetworkInitialized: true,
      },
      estimate.assumptions as Record<string, unknown>,
    );
    await saveCurrentEstimateWithLineItems({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      estimateType: estimateAdapter.estimateType,
      draftLines: lineItemDraft.draftLines,
      selectedDivisions: estimate.selectedDivisions,
      estimateSettings: estimateSettings.settings,
      existingAssumptions: updatedAssumptions,
      createdBy: user?.id ?? null,
    });
    setLevelingModalResult(null);
  }, [
    levelingModalResult,
    estimateAdapter,
    lineItemDraft.draftLines,
    estimateSettings.settings,
    scheduleSettingsHook,
    user?.id,
  ]);

  const runResourceLevelingPreview = useCallback(
    (allowProjectExtension: boolean) => {
      if (!cpmResult || !scheduleActivitiesResult.activities.length) return;
      const result = resourceLevelSchedule({
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
        availableCrewSize: projectAvailableCrewSize,
        projectStartDate:
          scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
        allowProjectExtension,
      });
      setLevelingModalResult(result);
    },
    [
      cpmResult,
      scheduleActivitiesResult.activities,
      scheduleSettingsHook,
      projectAvailableCrewSize,
    ],
  );

  const handleRunResourceLeveling = useCallback(() => {
    setLevelingAllowProjectExtension(false);
    runResourceLevelingPreview(false);
  }, [runResourceLevelingPreview]);

  const handleLevelingAllowProjectExtensionChange = useCallback(
    (allowProjectExtension: boolean) => {
      setLevelingAllowProjectExtension(allowProjectExtension);
      runResourceLevelingPreview(allowProjectExtension);
    },
    [runResourceLevelingPreview],
  );

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

  const handleOpenHelp = useCallback(() => {
    useDefinitionsHelpStore.getState().open();
  }, []);

  const runGanttExport = useCallback(
    async (format: 'pdf' | 'excel') => {
      if (!estimateAdapter) return;

      setSaveToastMessage('Preparing Gantt export...');

      try {
        const prepared = prepareGanttExport({
          lineItems: estimateAdapter.lineItems,
          projectStartDate:
            scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
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
      scheduleSettingsHook.scheduleSettings.projectStartDate,
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
  const showAddDivision = shouldShowAddDivisionAction(
    activeTab,
    hasEstimate,
    builderToolbarHandlers?.showAddDivision ?? false,
    resolvedEstimateType,
    canEditEstimate || activeEstimateType != null,
  );
  const showImportExport = shouldShowBidImportExportActions(
    activeTab,
    hasEstimate,
    resolvedEstimateType,
  );

  // Stable callbacks for props passed to EstimateLineItemsBuilderPanel.
  // Inline arrow functions here would create new refs on every parent render,
  // triggering child effects that include them in their dependency arrays.
  const handleAutoOpenScopeModalConsumed = useCallback(
    () => setAutoOpenScopeModalKey(null),
    [],
  );
  const handleFocusActivityConsumed = useCallback(
    () => setFocusActivityCode(null),
    [],
  );
  const handleDivisionsAdded = useCallback(() => {
    setSaveToastMessage('Divisions added');
  }, []);
  const handleNoNewDivisionsSelected = useCallback(() => {
    setSaveToastMessage('Select at least one new division');
  }, []);

  return (
    <>
      <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <EstimateWorkspaceTabBar
          activeTabId={activeTab}
          onTabChange={handleTabChange}
          rightActions={
            <EstimateWorkspaceToolbarActions
              showAddDivision={showAddDivision}
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
              onOpenHelp={handleOpenHelp}
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
            projectCrewSize={projectAvailableCrewSize}
            onProjectCrewSizeChange={(value) => void handleProjectCrewSizeChange(value)}
            onProjectCrewSizeDraftChange={handleProjectCrewSizeDraftChange}
            projectCrewSizeInputRef={projectCrewSizeInputRef}
            projectCrewSizeSaving={projectCrewSizeSaving}
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
            onAutoOpenScopeModalConsumed={handleAutoOpenScopeModalConsumed}
            onSaveQuick={handleSaveQuickEstimate}
            persistedSelectedDivisions={currentEstimate?.selectedDivisions ?? EMPTY_SELECTED_DIVISIONS}
            onSaveSelectedDivisions={handleSaveSelectedDivisions}
            onDivisionsAdded={handleDivisionsAdded}
            onNoNewDivisionsSelected={handleNoNewDivisionsSelected}
            onToolbarHandlersChange={setBuilderToolbarHandlers}
            importCollapseDivisionCodesKey={importCollapseDivisionCodesKey}
            focusActivityCode={focusActivityCode}
            onFocusActivityConsumed={handleFocusActivityConsumed}
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
              cpmResult={cpmResult}
              projectStartDate={scheduleSettingsHook.scheduleSettings.projectStartDate}
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
              {scheduleActivitiesResult.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {scheduleActivitiesResult.warnings.map((w, i) => (
                    <div key={`schedule-${i}`}>{w}</div>
                  ))}
                </div>
              ) : null}
              {scheduleSettingsHook.cpmWarningMessage ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                  {scheduleSettingsHook.cpmWarningMessage}
                </div>
              ) : null}
              <LogicNetworkWorkspace
                canvasKey={resolvedProjectId ?? 'no-project'}
                activitySignature={scheduleActivitySignature}
                activities={scheduleActivitiesResult.activities}
                logicLinks={scheduleSettingsHook.logicLinks}
                cpmResult={cpmResult}
                layout={scheduleSettingsHook.logicNetworkLayout}
                viewMode={scheduleSettingsHook.logicNetworkViewMode}
                onViewModeChange={handleLogicNetworkViewModeChange}
                cpmReadiness={cpmReadiness}
                onRunCpm={handleRunCpm}
                runCpmBusy={runCpmBusy}
                onLinksChange={handleLogicLinksChange}
                onLayoutChange={handleLogicNetworkLayoutChange}
                onSaveLayout={handleSaveLogicNetworkLayout}
                logicNetworkInitialized={scheduleSettingsHook.logicNetworkInitialized}
                scheduleSettings={scheduleSettingsHook.scheduleSettings}
                projectAvailableCrewSize={projectAvailableCrewSize}
                projectName={project?.name}
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
              {!cpmResult?.hasRunCpm ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                  Draft schedule only. Critical path is unavailable until you run CPM from a valid
                  precedence diagram in Logic Network.
                </div>
              ) : cpmResult && !cpmResult.hasValidCriticalPath ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                  No valid critical path yet. Complete the logic network from project start to
                  project finish.
                </div>
              ) : null}
              {scheduleActivitiesResult.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {scheduleActivitiesResult.warnings.map((w, i) => (
                    <div key={`schedule-${i}`}>{w}</div>
                  ))}
                </div>
              ) : null}
              <LevelThreeGanttWorkspace
                chartExportRef={ganttExportRef}
                activities={scheduleActivitiesResult.activities}
                cpmResult={cpmResult}
                scheduleSettings={scheduleSettingsHook.scheduleSettings}
                leveledOffsets={scheduleSettingsHook.leveledOffsets}
                logicLinks={scheduleSettingsHook.logicLinks}
                lineItems={estimateAdapter?.lineItems ?? []}
                onEditActivity={handleEditActivityFromGantt}
                exportReady={Boolean(cpmResult?.hasRunCpm && cpmResult.hasValidPrecedenceDiagram)}
                onExportPdf={() => void runCpmGanttExport('pdf')}
                onExportExcel={() => void runCpmGanttExport('excel')}
                resourceHistogram={resourceHistogram}
              />
              {cpmResult?.hasRunCpm && scheduleActivitiesResult.activities.length > 0 && (
                <div className="flex">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={handleRunResourceLeveling}
                  >
                    Resource level schedule
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

        {/* ── Construction Activities tab (Milestone 4) ─────────────────────── */}
        {!loadError && !dataLoading && activeTab === 'activities' ? (
          resolvedProjectId ? (
            <ConstructionActivityBuilderPanel
              projectId={resolvedProjectId}
              estimateId={estimate?.id}
            />
          ) : (
            <EstimateWorkspaceEmptyState
              title="No project"
              body="Open a project to manage construction activities."
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
          allowProjectExtension={levelingAllowProjectExtension}
          onAllowProjectExtensionChange={handleLevelingAllowProjectExtensionChange}
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
