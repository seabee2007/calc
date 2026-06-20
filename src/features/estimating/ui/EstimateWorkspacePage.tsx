import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { buildConstructionActivitySchedulePlan } from '../application/buildConstructionActivitySchedulePlan';
import {
  resolveEstimateWorkspaceScheduleActivities,
} from '../application/estimateWorkspaceScheduleSource';
import {
  planEstimateScheduleDates,
  type EstimateScheduleDependencyMode,
} from '../application/estimateScheduleDatePlanner';
import { useNavigate, useParams } from 'react-router-dom';
import {
  estimateWorkspaceHref,
  parseEstimateWorkspaceTabParam,
  DEFAULT_ESTIMATE_WORKSPACE_TAB,
} from '../utils/estimateRoutes';
import { useAuth } from '../../../hooks/useAuth';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { usePlannerWorkspaceFocus } from '../../../contexts/PlannerWorkspaceFocusContext';
import FeatureGate from '../../../components/subscription/FeatureGate';
import {
  canUseEstimateType,
  getDefaultEstimateTypeForPlan,
} from '../../../lib/estimateEntitlements';
import { usePlannerProject } from '../../../contexts/PlannerProjectContext';
import { useProjectStore } from '../../../store';
import { DEFAULT_ESTIMATE_METHOD, isConceptualEstimateType, isQuickEstimateType, normalizeEstimateMethod, supportsConstructionActivitiesWorkflow } from '../domain/estimateMethods';
import type { EstimateSelectedDivision, EstimateType } from '../domain/estimateTypes';
import {
  getDefaultWorkspaceTabForEstimateType,
  getEstimateTypeChangeWarning,
  getEstimateTypeEmptyState,
  getVisibleWorkspaceTabs,
  isScheduleWorkspaceTab,
  isTabVisibleForEstimateType,
  resolveWorkspaceSchedulingEnabled,
} from '../application/estimateWorkspaceTabPolicy';
import {
  buildDomainTasksFromDraftLines,
  createCurrentEstimate,
  currentEstimateToDomainVersion,
  currentEstimateToSummary,
  resetCurrentEstimateWorkspace,
  saveCurrentEstimate,
  saveCurrentEstimateWithLineItems,
  saveCurrentQuickFeasibilityEstimate,
  saveCurrentConceptualEstimate,
  type CurrentEstimate,
} from '../application/currentEstimateService';
import { shouldOpenBuildScopeModal } from '../application/estimateStartFlow';
import {
  appendSelectedDivisions,
  buildSelectedDivisionsFromCodes,
  normalizeSelectedDivisions,
} from '../application/estimateWorkBreakdown';
import {
  buildOptimisticEstimateWithDivisions,
  cacheCurrentEstimateForProject,
  getCachedCurrentEstimateForProject,
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
import {
  createEstimateSaveSuccessToast,
  QUICK_ESTIMATE_SAVE_ERROR_MESSAGE,
  QUICK_ESTIMATE_SAVE_SUCCESS_MESSAGE,
} from './estimateBuilderUi';
import EstimateLineItemsBuilderPanel from './components/EstimateLineItemsBuilderPanel';
import EstimateResetSetupConfirmModal from './components/EstimateResetSetupConfirmModal';
import { useDefinitionsHelpStore } from '../../help/definitionsHelpStore';
import {
  hasDismissedEstimateGuide,
  markEstimateGuideDismissed,
  shouldShowConceptualEstimateGuideBadge,
} from './conceptualEstimateGuide';
import EstimateWorkspaceToolbarActions from './components/EstimateWorkspaceToolbarActions';
import EstimateTotalsReviewPanel from './components/EstimateTotalsReviewPanel';
import EstimateSchedulePreviewPanel from './components/EstimateSchedulePreviewPanel';
import EstimateGanttPreview from './components/EstimateGanttPreview';
import EstimateMethodSelector from './components/EstimateMethodSelector';
import type { EstimateSchedulePlanControlValues } from './components/EstimateSchedulePlanControls';
import {
  ROUGH_SCHEDULE_PREVIEW_NOTE,
  shouldShowRoughSchedulePreviewNote,
  formatEstimateMethodLabel,
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
  shouldShowConvertToDetailedAction,
  shouldShowQuickSaveAction,
  shouldShowResetFormAction,
  type EstimateBuilderToolbarHandlers,
} from './estimateWorkspaceToolbar';
import EstimateImportModal from './EstimateImportModal';
import ActivityExcelImportModal from './components/ActivityExcelImportModal';
import ConstructionActivityBuilderPanel from './components/ConstructionActivityBuilderPanel';
import ChooseEstimateTypeModal from './components/ChooseEstimateTypeModal';
import ChangeEstimateTypeConfirmModal from './components/ChangeEstimateTypeConfirmModal';
import UnsupportedEstimateTypePanel from './components/UnsupportedEstimateTypePanel';
import EstimateTypeHeaderControl from './components/EstimateTypeHeaderControl';
import EstimateQuickFeasibilityPanel from './components/EstimateQuickFeasibilityPanel';
import ConceptualBudgetPanel from './components/ConceptualBudgetPanel';
import ConceptualAssumptionsExclusionsPanel from './components/ConceptualAssumptionsExclusionsPanel';
import ConceptualScenariosPanel from './components/ConceptualScenariosPanel';
import ConceptualRisksContingencyPanel from './components/ConceptualRisksContingencyPanel';
import ConvertToDetailedEstimateModal from './components/ConvertToDetailedEstimateModal';
import { useConceptualEstimate } from './hooks/useConceptualEstimate';
import {
  EstimateWorkspaceSaveStatusProvider,
  useEstimateWorkspaceSaveStatus,
} from './hooks/useEstimateWorkspaceSaveStatus';
import { friendlyEstimateWorkspaceSaveError, resolveEstimateWorkspaceSaveControl } from './estimateWorkspaceSaveStatus';
import { quickFeasibilityInputsFromSnapshot } from '../application/estimateQuickFeasibility';
import { estimateSettingsToAssumptions } from '../application/estimateSettings';
import { applyImportedEstimate } from '../importExport/estimateImportApply';
import type { ImportedEstimateData } from '../importExport/estimateImportParser';
import type { EstimateImportApplyMode } from '../importExport/estimateImportApply';
import {
  downloadBlankEstimateTemplateWorkbook,
  downloadEstimateWorkbook,
} from '../importExport/estimateExportBuilder';
import {
  applyActivityExcelImport,
  downloadActivityExcelExport,
  downloadEstimateExcelTemplate,
  mapLoadedActivitiesToExportInput,
  type ActivityExcelEstimateType,
  type ActivityExcelImportMode,
  type ParsedActivityGroup,
} from '../excel';
import { loadProjectActivitiesWithLineItems } from '../application/constructionActivityService';
import { useProjectLaborRates } from './hooks/useProjectLaborRates';
import { downloadGanttExcel } from '../export/ganttExcelExport';
import { downloadGanttPdf } from '../export/ganttPdfExport';
import { downloadLevelThreeGanttPdf } from '../export/levelThreeGanttPdfExport';
import type { GanttExportMode } from '../export/ganttExcelExport';
import {
  isGanttExportReady,
  prepareGanttExport,
} from '../schedule/ganttExportValidation';
import type { BuildGanttScheduleResult } from '../schedule/buildGanttSchedule';
import { useProjectConstructionActivitiesForSchedule } from './hooks/useProjectConstructionActivitiesForSchedule';
import {
  ESTIMATE_WORKSPACE_HEADER_PORTAL_ID,
  useEstimateWorkspaceHeaderCollapse,
} from './EstimateWorkspaceHeaderCollapseContext';
import { useProjectActivityResourceTotals } from './hooks/useProjectActivityResourceTotals';
import { runCpmCalculation } from '../scheduling/cpm/calculateCpm';
import type {
  CpmLogicLink,
  LogicNetworkLayout,
  LogicNetworkViewMode,
  MovedActivity,
  ScheduleSettings,
} from '../scheduling/cpmTypes';
import { validateCpmReadiness } from '../scheduling/logic/validateCpmReadiness';
import type { LogicBatchSnapshot } from '../scheduling/logic/logicTypes';
import {
  buildCpmActivitySignature,
  buildPrecedenceDiagramRunState,
  currentPrecedenceDiagramSignaturesMatch,
  markPrecedenceDiagramStale,
  shouldInvalidateCpmOnEstimateSave,
} from '../scheduling/precedenceDiagram';
import {
  logicLinksEqual,
  mergeLogicLayoutAssumptionsOnly,
  mergeScheduleAssumptions,
  mergeScheduleAssumptionsForAddImport,
  reconcileLogicLinksWithScheduleActivities,
  resetScheduleAssumptionsForReplacement,
  sanitizeLogicLinksForActivities,
} from '../scheduling/scheduleAssumptions';
import { useScheduleSettings } from './hooks/useScheduleSettings';
import LogicNetworkWorkspace from './components/scheduling/LogicNetworkWorkspace';
import LevelThreeGanttWorkspace from './components/scheduling/LevelThreeGanttWorkspace';
import BimTakeoffPage from '../../bim/ui/BimTakeoffPage';
import DesignBuilderPage from '../../design-builder/ui/DesignBuilderPage';
import ResourceLevelingModal from './components/scheduling/ResourceLevelingModal';
import { calculateResourceHistogram } from '../scheduling/resources/resourceHistogramCalculator';
import {
  getEffectiveScheduleAnalysis,
  resolveEffectiveSchedule,
} from '../scheduling/effectiveSchedule';
import type { ResourceLeveledDelayRecord } from '../scheduling/effectiveSchedule';
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
const TAB_NO_ESTIMATE_MESSAGE =
  'Start an estimate on the Estimate tab before using this section.';
const WORKFLOW_PLACEHOLDER_TAB_IDS: EstimateWorkspaceTabId[] = [
  'change-order-scope',
  'pricing',
  'unit-price-items',
  'subcontractor-quotes',
  'quote-comparison',
];

function renderScheduleDisabledEmptyState(estimateType: EstimateType) {
  const empty = getEstimateTypeEmptyState(estimateType, 'schedule-preview');
  return <EstimateWorkspaceEmptyState title={empty.title} body={empty.body} />;
}
const LOADING_ESTIMATE_MESSAGE = 'Loading estimate...';

function renderScheduleSourceDevBadge(
  activityCount: number,
  legacyFallbackEnabled: boolean,
) {
  if (!import.meta.env.DEV) return null;
  return (
    <p className={`text-xs ${PLANNER_MUTED}`}>
      Source: Construction Activities · Activity count: {activityCount} · Legacy fallback:{' '}
      {legacyFallbackEnabled ? 'enabled' : 'disabled'}
    </p>
  );
}

function resolveScheduleTabEmptyState(
  totalConstructionActivityCount: number,
  scheduleActivityCount: number,
  tab: 'logic-network' | 'level-iii-gantt',
  hasRunCpm: boolean,
): { title: string; body: string } | null {
  if (tab === 'level-iii-gantt' && scheduleActivityCount > 0 && !hasRunCpm) {
    return {
      title: 'No CPM schedule available yet.',
      body: 'Add scheduled activities, build logic, then run CPM.',
    };
  }

  if (scheduleActivityCount > 0) {
    return null;
  }

  if (totalConstructionActivityCount === 0) {
    return {
      title: 'No construction activities yet.',
      body: 'Add activities first to preview a schedule and build the logic network.',
    };
  }

  if (tab === 'level-iii-gantt') {
    return {
      title: 'No CPM schedule available yet.',
      body: 'Add scheduled activities, build logic, then run CPM.',
    };
  }

  return {
    title: 'No schedule-enabled construction activities yet.',
    body: 'Add scheduled activities before building the logic network.',
  };
}

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

function buildEstimatePersistenceFields(estimate: CurrentEstimate) {
  return {
    estimateId: estimate.id,
    projectId: estimate.projectId,
    estimateType: normalizeEstimateMethod(estimate.estimateType ?? DEFAULT_ESTIMATE_METHOD),
    schedulingEnabled: estimate.schedulingEnabled,
    estimateModeConfig: estimate.estimateModeConfig,
    pricingMode: estimate.pricingMode,
    status: estimate.status,
  };
}

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
  const resolvedProjectId = projectId ?? routeProjectId ?? '';
  const cachedEstimateForProject = getCachedCurrentEstimateForProject(resolvedProjectId);
  const hasCachedEstimateForProject = cachedEstimateForProject !== undefined;
  const [projectCrewSizeSaving, setProjectCrewSizeSaving] = useState(false);
  const [optimisticProjectCrewSize, setOptimisticProjectCrewSize] = useState<number | null>(null);
  const [projectCrewSizeDraftDirty, setProjectCrewSizeDraftDirty] = useState(false);
  const projectCrewSizeInputRef = useRef<PositiveIntegerInputHandle>(null);
  const parsedTab = parseEstimateWorkspaceTabParam(estimateTab);
  const activeTab: EstimateWorkspaceTabId = parsedTab ?? DEFAULT_ESTIMATE_WORKSPACE_TAB;
  const [dataLoading, setDataLoading] = useState(!hasCachedEstimateForProject);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<CurrentEstimate | null>(
    cachedEstimateForProject ?? null,
  );
  const [autoOpenScopeModalKey, setAutoOpenScopeModalKey] = useState<string | null>(null);
  const [selectedEstimateMethod, setSelectedEstimateMethod] = useState<EstimateType>(
    DEFAULT_ESTIMATE_METHOD,
  );
  const [activeEstimateType, setActiveEstimateType] = useState<EstimateType | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [convertToDetailedModalOpen, setConvertToDetailedModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCollapseDivisionCodesKey, setImportCollapseDivisionCodesKey] = useState<
    string | null
  >(null);
  const [activitiesPanelReloadKey, setActivitiesPanelReloadKey] = useState(0);
  const [focusActivityCode, setFocusActivityCode] = useState<string | null>(null);
  const [estimateTypeModalOpen, setEstimateTypeModalOpen] = useState(false);
  const [estimateTypeChangeConfirmOpen, setEstimateTypeChangeConfirmOpen] = useState(false);
  const [pendingEstimateTypeChange, setPendingEstimateTypeChange] = useState<EstimateType | null>(
    null,
  );
  const [changingEstimateType, setChangingEstimateType] = useState(false);
  const [builderToolbarHandlers, setBuilderToolbarHandlers] =
    useState<EstimateBuilderToolbarHandlers | null>(null);
  const [quickFeasibilityPreview, setQuickFeasibilityPreview] = useState<{
    inputs: QuickFeasibilityInputs;
    result: QuickFeasibilityResult;
  } | null>(null);
  const [quickEstimateSavedAt, setQuickEstimateSavedAt] = useState<number | null>(null);
  const quickFeasibilityPreviewRef = useRef(quickFeasibilityPreview);
  quickFeasibilityPreviewRef.current = quickFeasibilityPreview;
  const [schedulePlanControls, setSchedulePlanControls] = useState<EstimateSchedulePlanControlValues>(
    () => ({
      projectStartDate: getTodayScheduleDateYmd(),
      dependencyMode: 'sequential_by_project' satisfies EstimateScheduleDependencyMode,
      includeWeekends: false,
      useLegacyEstimateSchedule: false,
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
  const acceptedDivisionCodes = useMemo(
    () => (currentEstimate?.selectedDivisions ?? []).map((division) => division.code),
    [currentEstimate?.selectedDivisions],
  );
  const { hasFeature, plan, loading: subscriptionLoading } = useSubscription();
  const planDefaultEstimateType = useMemo(
    () => getDefaultEstimateTypeForPlan(plan),
    [plan],
  );
  const isEstimateTypeAllowed = useCallback(
    (type: EstimateType) => canUseEstimateType(plan, type),
    [plan],
  );
  const resolvedEstimateType = normalizeEstimateMethod(
    currentEstimate?.estimateType ?? activeEstimateType ?? selectedEstimateMethod,
  );
  const estimateTypeEntitlementBlocked =
    estimate != null &&
    !subscriptionLoading &&
    !canUseEstimateType(plan, resolvedEstimateType);
  const schedulingEnabled = resolveWorkspaceSchedulingEnabled(
    resolvedEstimateType,
    currentEstimate?.schedulingEnabled,
  );
  const visibleWorkspaceTabs = useMemo(
    () => getVisibleWorkspaceTabs(resolvedEstimateType, schedulingEnabled),
    [resolvedEstimateType, schedulingEnabled],
  );
  const entitlementFilteredTabs = useMemo(
    () =>
      visibleWorkspaceTabs.filter((tab) => {
        if (isScheduleWorkspaceTab(tab.id) && !hasFeature('logic_network')) {
          return false;
        }
        if (tab.id === 'level-iii-gantt' && !hasFeature('level_three_gantt')) {
          return false;
        }
        if (tab.id === '3d-takeoff' && !hasFeature('model_3d_takeoff')) {
          return false;
        }
        if (tab.id === 'design-builder' && !hasFeature('design_builder')) {
          return false;
        }
        return true;
      }),
    [visibleWorkspaceTabs, hasFeature],
  );

  // Construction activities for schedule source (Milestone 5) — must be declared before
  // scheduleActivitiesResult reads constructionActivities.
  const { constructionActivities, constructionActivitiesLoading, reloadConstructionActivities } =
    useProjectConstructionActivitiesForSchedule(resolvedProjectId, estimate?.id);

  const { projectRates, ensureProjectLaborRatesReady } = useProjectLaborRates(resolvedProjectId);

  const overviewResourceTotalsEnabled =
    activeTab === 'overview' &&
    estimate != null &&
    supportsConstructionActivitiesWorkflow(resolvedEstimateType);

  const projectResourceTotals = useProjectActivityResourceTotals(
    resolvedProjectId,
    overviewResourceTotalsEnabled,
  );

  useEffect(() => {
    if (activeTab !== 'overview') return;
    if (!supportsConstructionActivitiesWorkflow(resolvedEstimateType)) return;
    reloadConstructionActivities();
    projectResourceTotals.reload();
  }, [activeTab, resolvedEstimateType, reloadConstructionActivities, projectResourceTotals.reload]);

  const enableLegacyEstimateScheduleFallback =
    schedulePlanControls.useLegacyEstimateSchedule === true;

  const estimateSettings = useEstimateSettings();
  const isConceptualEstimate = isConceptualEstimateType(resolvedEstimateType);
  const conceptualEstimate = useConceptualEstimate({
    estimate: isConceptualEstimate ? currentEstimate : null,
    estimateSettings: estimateSettings.settings,
  });
  const lineItemDraft = useEstimateLineItemDraft(estimateAdapter, estimateSettings.settings);
  const rehydrateDraftFromVersion = lineItemDraft.rehydrateFromVersion;
  const scheduleSettingsHook = useScheduleSettings();

  const resolvedScheduleActivitiesBundle = useMemo(() => {
    if (constructionActivitiesLoading) {
      return { activities: [], warnings: [] as const };
    }
    return resolveEstimateWorkspaceScheduleActivities({
      constructionActivities,
      lineItems: estimateAdapter?.lineItems ?? [],
      estimateSettings: estimateSettings.settings,
      scheduleSettingsHoursPerDay: scheduleSettingsHook.scheduleSettings.hoursPerDay,
      enableLegacyEstimateScheduleFallback,
      schedulingEnabled,
    });
  }, [
    constructionActivities,
    constructionActivitiesLoading,
    enableLegacyEstimateScheduleFallback,
    estimateAdapter?.lineItems,
    estimateSettings.settings,
    scheduleSettingsHook.scheduleSettings.hoursPerDay,
    schedulingEnabled,
  ]);
  const scheduleSourceRehydrateKeyRef = useRef<string | null>(null);
  const currentEstimateRef = useRef(currentEstimate);
  useEffect(() => {
    currentEstimateRef.current = currentEstimate;
  }, [currentEstimate]);

  const rehydrateScheduleFromEstimate = useCallback(
    (estimate: CurrentEstimate | null) => {
      if (!estimate) {
        scheduleSettingsHook.rehydrateFromEstimate(null, []);
        return;
      }
      if (constructionActivitiesLoading) return;
      const lineItems = (estimate.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[];
      scheduleSettingsHook.rehydrateFromEstimate(
        estimate,
        lineItems,
        resolvedScheduleActivitiesBundle.activities,
        { enableLegacyEstimateScheduleFallback },
      );
    },
    [
      constructionActivitiesLoading,
      enableLegacyEstimateScheduleFallback,
      resolvedScheduleActivitiesBundle.activities,
      scheduleSettingsHook.rehydrateFromEstimate,
    ],
  );

  useEffect(() => {
    const estimate = currentEstimateRef.current;
    if (!estimate || constructionActivitiesLoading) return;

    const lineItems = (estimate.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[];
    const scheduleActivities = resolvedScheduleActivitiesBundle.activities;
    const rehydrateKey = enableLegacyEstimateScheduleFallback
      ? `${estimate.id}:legacy:${scheduleActivities.map((activity) => activity.runtimeActivityId ?? activity.activityCode).join('|')}`
      : `${estimate.id}:ca:${constructionActivities.length}:${scheduleActivities.map((activity) => activity.runtimeActivityId ?? activity.activityCode).join('|')}`;

    if (scheduleSourceRehydrateKeyRef.current === rehydrateKey) return;
    scheduleSourceRehydrateKeyRef.current = rehydrateKey;
    scheduleSettingsHook.rehydrateFromEstimate(estimate, lineItems, scheduleActivities, {
      enableLegacyEstimateScheduleFallback,
    });
  }, [
    constructionActivities.length,
    constructionActivitiesLoading,
    currentEstimate?.id,
    enableLegacyEstimateScheduleFallback,
    resolvedScheduleActivitiesBundle.activities,
    scheduleSettingsHook.rehydrateFromEstimate,
  ]);
  const ganttExportRef = useRef<HTMLDivElement>(null);
  const [levelingModalResult, setLevelingModalResult] = useState<import('../scheduling/cpmTypes').ResourceLevelingResult | null>(null);
  const [levelingAllowProjectExtension, setLevelingAllowProjectExtension] = useState(false);

  const legacyScheduleLineItemsAvailable = useMemo(() => {
    if (!estimateAdapter) return false;
    return estimateAdapter.lineItems.some(
      (task) => (task.lineType === 'task' || task.lineType == null) && task.scheduleEnabled,
    );
  }, [estimateAdapter]);

  const schedulePreviewSource = useMemo(() => {
    if (constructionActivities.length > 0) return 'construction_activities' as const;
    if (
      schedulePlanControls.useLegacyEstimateSchedule &&
      legacyScheduleLineItemsAvailable
    ) {
      return 'legacy_line_items' as const;
    }
    return 'construction_activities' as const;
  }, [
    constructionActivities.length,
    legacyScheduleLineItemsAvailable,
    schedulePlanControls.useLegacyEstimateSchedule,
  ]);

  const schedulePlan = useMemo(() => {
    if (!estimateAdapter || !estimate) return null;

    const versionMeta = {
      estimateId: estimate.id,
      projectId: estimate.projectId,
      estimateVersionId: estimateAdapter.id,
      estimateVersionNumber: estimateAdapter.versionNumber,
    };

    if (constructionActivities.length > 0) {
      return buildConstructionActivitySchedulePlan({
        activities: constructionActivities,
        ...versionMeta,
      });
    }

    if (
      schedulePlanControls.useLegacyEstimateSchedule &&
      legacyScheduleLineItemsAvailable
    ) {
      return buildEstimateSchedulePlan({
        version: estimateAdapter,
        estimateId: estimate.id,
        projectId: estimate.projectId,
      });
    }

    return buildConstructionActivitySchedulePlan({
      activities: [],
      ...versionMeta,
    });
  }, [
    constructionActivities,
    estimate,
    estimateAdapter,
    legacyScheduleLineItemsAvailable,
    schedulePlanControls.useLegacyEstimateSchedule,
  ]);

  const scheduleDatePlanResult = useMemo(() => {
    if (!schedulePlan) return null;
    return planEstimateScheduleDates(schedulePlan, {
      projectStartDate: schedulePlanControls.projectStartDate,
      dependencyMode: schedulePlanControls.dependencyMode,
      includeWeekends: schedulePlanControls.includeWeekends,
    });
  }, [schedulePlan, schedulePlanControls]);

  // Schedule activities and CPM — construction activities are the default source of truth.
  const scheduleActivitiesResult = resolvedScheduleActivitiesBundle;

  const cpmResult = scheduleSettingsHook.committedCpmResult;

  const cpmReadiness = useMemo(
    () =>
      validateCpmReadiness({
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
      }),
    [scheduleActivitiesResult.activities, scheduleSettingsHook.logicLinks],
  );

  const scheduleActivitySignature = useMemo(() => {
    if (scheduleActivitiesResult.activities.length > 0) {
      return buildCpmActivitySignature(scheduleActivitiesResult.activities);
    }
    return '';
  }, [scheduleActivitiesResult.activities]);

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

  useEffect(() => {
    if (constructionActivitiesLoading) return;
    if (scheduleActivitiesResult.activities.length === 0) return;

    const { links: reconciled, preservedCount, prunedCount } =
      reconcileLogicLinksWithScheduleActivities(
        scheduleSettingsHook.logicLinks,
        scheduleActivitiesResult.activities,
      );

    if (logicLinksEqual(reconciled, scheduleSettingsHook.logicLinks)) {
      return;
    }

    if (import.meta.env.DEV) {
      console.info('[Logic Network] Reconciled logic links with schedule activities', {
        scheduleActivityIds: scheduleActivitiesResult.activities.map(
          (activity) => activity.runtimeActivityId ?? activity.activityCode,
        ),
        savedLinkCount: scheduleSettingsHook.logicLinks.length,
        preservedCount,
        prunedCount,
      });
    }

    scheduleSettingsHook.setLogicLinks(reconciled);
  }, [
    constructionActivitiesLoading,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook.logicLinks,
    scheduleSettingsHook.setLogicLinks,
  ]);

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

  const ganttExportReady = useMemo(
    () =>
      isGanttExportReady({
        lineItems: estimateAdapter?.lineItems ?? [],
        plannedPlan: scheduleDatePlanResult?.plan ?? null,
      }),
    [estimateAdapter?.lineItems, scheduleDatePlanResult?.plan],
  );

  // Draft Schedule Preview summary (offset-based). Separate surface from the
  // Level III Gantt / Logic Network, which read the leveled CPM via
  // effectiveAnalysis below.
  const effectiveSchedule = useMemo(
    () =>
      resolveEffectiveSchedule({
        activities: scheduleActivitiesResult.activities,
        cpmResult,
        projectStartDate:
          scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
        leveledOffsets: scheduleSettingsHook.leveledOffsets,
      }),
    [
      scheduleActivitiesResult.activities,
      cpmResult,
      scheduleSettingsHook.scheduleSettings.projectStartDate,
      scheduleSettingsHook.leveledOffsets,
    ],
  );

  // Provider/delay records that source the resource-dummy connector lines in the
  // Resource-Leveled Logic Network. Prefer the live leveling result; otherwise
  // fall back to the persisted result so connectors survive reload. This feeds
  // ONLY connector rendering — never CPM/float/duration math.
  const resourceLeveledDelayRecords = useMemo<ResourceLeveledDelayRecord[]>(() => {
    const moved =
      levelingModalResult?.movedActivities ??
      (
        (currentEstimate?.assumptions as Record<string, unknown> | undefined)
          ?.resourceLevelingResults as { movedActivities?: MovedActivity[] } | undefined
      )?.movedActivities;
    if (!moved || moved.length === 0) return [];
    return moved
      .filter((entry) => (entry.resourceProviderActivityCodes?.length ?? 0) > 0)
      .map((entry) => ({
        activityCode: entry.activityCode,
        resourceProviderActivityCodes: entry.resourceProviderActivityCodes ?? [],
      }));
  }, [levelingModalResult, currentEstimate?.assumptions]);

  const effectiveAnalysis = useMemo(
    () =>
      getEffectiveScheduleAnalysis({
        baselineCpmResult: cpmResult,
        activities: scheduleActivitiesResult.activities,
        logicLinks: scheduleSettingsHook.logicLinks,
        leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
        resourceLeveledDelayRecords,
        projectStartDate:
          scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
      }),
    [
      cpmResult,
      scheduleActivitiesResult.activities,
      scheduleSettingsHook.logicLinks,
      scheduleSettingsHook.leveledOffsets,
      resourceLeveledDelayRecords,
      scheduleSettingsHook.scheduleSettings.projectStartDate,
    ],
  );

  // Single source of truth after leveling: the Level III Gantt, histogram, and
  // Logic Network all read the one leveled CPM result (baseline links + provider
  // -derived resource-dummy links). Baseline mode uses the committed CPM.
  const levelingApplied = effectiveAnalysis?.levelingApplied ?? false;
  const activeScheduleCpmResult =
    levelingApplied && effectiveAnalysis?.leveledCpmResult
      ? effectiveAnalysis.leveledCpmResult
      : cpmResult;

  const resourceHistogram = useMemo(() => {
    if (!activeScheduleCpmResult || scheduleActivitiesResult.activities.length === 0) return [];
    return calculateResourceHistogram({
      activities: scheduleActivitiesResult.activities,
      cpmActivities: activeScheduleCpmResult.activities,
      projectStartDate:
        scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd(),
      availableCrewSize: projectAvailableCrewSize,
      // Leveled CPM already encodes the delayed positions, so no offsets are
      // re-applied here; placement and critical shading come from one result.
      leveledOffsets: {},
      cpmResult: activeScheduleCpmResult,
    });
  }, [
    activeScheduleCpmResult,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook.scheduleSettings.projectStartDate,
    projectAvailableCrewSize,
  ]);

  const projectScopeContext = useMemo(
    () =>
      project
        ? {
            projectId: project.id,
            projectName: project.name,
            projectDescription: project.description,
            locationLabel: project.locationLabel,
            estimateType: resolvedEstimateType,
          }
        : null,
    [project, resolvedEstimateType],
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

  const estimateSetup = useEstimateSetupSession(
    resolvedProjectId,
    estimateAdapter?.id,
    estimateAdapter?.estimateType,
  );
  const estimateSetupRef = useRef(estimateSetup);
  const lineItemDraftRef = useRef(lineItemDraft);
  const estimateSettingsRef = useRef(estimateSettings);
  const scheduleSettingsRef = useRef(scheduleSettingsHook);
  const localWorkspaceDirtyRef = useRef(false);
  estimateSetupRef.current = estimateSetup;
  lineItemDraftRef.current = lineItemDraft;
  estimateSettingsRef.current = estimateSettings;
  scheduleSettingsRef.current = scheduleSettingsHook;
  localWorkspaceDirtyRef.current =
    conceptualEstimate.dirty ||
    estimateSettings.dirty ||
    lineItemDraft.dirty ||
    projectCrewSizeDraftDirty;

  useEffect(() => {
    if (!resolvedProjectId || !currentEstimate) return;
    cacheCurrentEstimateForProject(resolvedProjectId, currentEstimate);
  }, [currentEstimate, resolvedProjectId]);

  useEffect(() => {
    if (subscriptionLoading || dataLoading) return;
    if (currentEstimate) return;
    setSelectedEstimateMethod(planDefaultEstimateType);
  }, [subscriptionLoading, dataLoading, currentEstimate, planDefaultEstimateType]);

  useEffect(() => {
    if (!resolvedProjectId || dataLoading || subscriptionLoading) return;
    if (activeTab !== 'activities' || hasFeature('activity_based_estimating')) return;

    const fallbackType =
      estimate != null && !canUseEstimateType(plan, resolvedEstimateType)
        ? planDefaultEstimateType
        : planDefaultEstimateType;
    const fallbackTab = getDefaultWorkspaceTabForEstimateType(fallbackType);
    if (activeTab === fallbackTab) return;

    navigate(estimateWorkspaceHref(resolvedProjectId, fallbackTab), { replace: true });
  }, [
    activeTab,
    dataLoading,
    estimate,
    hasFeature,
    navigate,
    plan,
    planDefaultEstimateType,
    resolvedEstimateType,
    resolvedProjectId,
    subscriptionLoading,
  ]);

  useEffect(() => {
    if (!resolvedProjectId || dataLoading) return;
    if (
      isTabVisibleForEstimateType(activeTab, resolvedEstimateType, schedulingEnabled)
    ) {
      return;
    }
    navigate(
      estimateWorkspaceHref(
        resolvedProjectId,
        getDefaultWorkspaceTabForEstimateType(resolvedEstimateType),
      ),
      { replace: true },
    );
  }, [
    activeTab,
    dataLoading,
    navigate,
    resolvedEstimateType,
    resolvedProjectId,
    schedulingEnabled,
  ]);

  useEffect(() => {
    if (!resolvedProjectId) return;
    if (estimateTab === 'totals') {
      navigate(estimateWorkspaceHref(resolvedProjectId, 'overview'), { replace: true });
      return;
    }
    if (estimateTab === 'line-items') {
      navigate(estimateWorkspaceHref(resolvedProjectId, 'activities'), { replace: true });
      return;
    }
    if (estimateTab && parsedTab == null) {
      navigate(estimateWorkspaceHref(resolvedProjectId, DEFAULT_ESTIMATE_WORKSPACE_TAB), {
        replace: true,
      });
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
      navigate(estimateWorkspaceHref(resolvedProjectId, 'activities'));
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

    const cachedEstimate = getCachedCurrentEstimateForProject(projectId);
    const hasCachedEstimate = cachedEstimate !== undefined;

    setDataLoading(!hasCachedEstimate);
    setBackgroundRefreshing(hasCachedEstimate);
    setLoadError(null);
    setCreateError(null);
    setSaveError(null);
    setSaveToastMessage(null);
    if (hasCachedEstimate) {
      if (cachedEstimate && currentEstimateRef.current?.id !== cachedEstimate.id) {
        setCurrentEstimate(cachedEstimate);
        const cachedType = cachedEstimate.estimateType
          ? normalizeEstimateMethod(cachedEstimate.estimateType)
          : planDefaultEstimateType;
        setActiveEstimateType(cachedEstimate.estimateType);
        setSelectedEstimateMethod(cachedType);
      }
    } else {
      setCurrentEstimate(null);
      setActiveEstimateType(null);
      setAutoOpenScopeModalKey(null);
      setSelectedEstimateMethod(planDefaultEstimateType);
      scheduleSourceRehydrateKeyRef.current = null;
      estimateSetupRef.current.resetSetup(planDefaultEstimateType);
      lineItemDraftRef.current.resetDraftSetup();
      estimateSettingsRef.current.rehydrateFromEstimate(null);
      scheduleSettingsRef.current.rehydrateFromEstimate(null, []);
    }

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
          cacheCurrentEstimateForProject(projectId, loadedEstimate);
          const currentLoadedEstimate = currentEstimateRef.current;
          const hasDirtyLocalState = localWorkspaceDirtyRef.current;
          const shouldApplyLoadedEstimate =
            !hasDirtyLocalState &&
            (!currentLoadedEstimate ||
              currentLoadedEstimate.id !== loadedEstimate.id ||
              loadedEstimate.updatedAt >= currentLoadedEstimate.updatedAt);

          if (!shouldApplyLoadedEstimate) {
            return;
          }

          setCurrentEstimate(loadedEstimate);
          if (!estimateSettingsRef.current.dirty) {
            estimateSettingsRef.current.rehydrateFromEstimate(loadedEstimate);
          }
          scheduleSourceRehydrateKeyRef.current = null;
          const loadedType = loadedEstimate.estimateType
            ? normalizeEstimateMethod(loadedEstimate.estimateType)
            : planDefaultEstimateType;
          setActiveEstimateType(loadedEstimate.estimateType);
          setSelectedEstimateMethod(loadedType);
          if (loadedEstimate.estimateType && !lineItemDraftRef.current.dirty) {
            estimateSetupRef.current.restoreSavedSetup(
              loadedType,
              loadedEstimate.selectedDivisions,
            );
            lineItemDraftRef.current.rehydrateFromVersion(
              currentEstimateToDomainVersion(loadedEstimate),
            );
          }
        } else {
          cacheCurrentEstimateForProject(projectId, null);
          if (!localWorkspaceDirtyRef.current) {
            setCurrentEstimate(null);
            setActiveEstimateType(null);
            estimateSettingsRef.current.rehydrateFromEstimate(null);
            scheduleSettingsRef.current.rehydrateFromEstimate(null, []);
          }
        }
      } catch (error) {
        if (!isStale()) {
          setLoadError(error instanceof Error ? error.message : 'Could not load estimate');
        }
      } finally {
        if (!isStale()) {
          setDataLoading(false);
          setBackgroundRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId, planDefaultEstimateType]);

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
    setSelectedEstimateMethod(planDefaultEstimateType);
    scheduleSourceRehydrateKeyRef.current = null;
    estimateSetupRef.current.resetSetup(planDefaultEstimateType);
    lineItemDraftRef.current.resetDraftSetup();
    estimateSettingsRef.current.rehydrateFromEstimate(null);
    scheduleSettingsRef.current.rehydrateFromEstimate(null, []);

    try {
      const loadedEstimate = await loadCurrentEstimateForProject(projectId);
      if (token !== loadTokenRef.current) return;

      setCurrentEstimate(loadedEstimate);
      estimateSettingsRef.current.rehydrateFromEstimate(loadedEstimate);
      scheduleSourceRehydrateKeyRef.current = null;
      if (loadedEstimate) {
        const loadedType = loadedEstimate.estimateType
          ? normalizeEstimateMethod(loadedEstimate.estimateType)
          : planDefaultEstimateType;
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
  }, [resolvedProjectId, planDefaultEstimateType]);

  const handleStartEstimate = useCallback(async (estimateTypeOverride?: EstimateType) => {
    if (!resolvedProjectId || creating || estimate != null) return;

    const estimateType = estimateTypeOverride ?? selectedEstimateMethod;
    if (!canUseEstimateType(plan, estimateType)) {
      setCreateError('Upgrade required to use this estimate type.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    setSaveError(null);
    setSaveToastMessage(null);
    const result = await createCurrentEstimate({
      projectId: resolvedProjectId,
      createdBy: user?.id ?? null,
      estimateType,
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
      estimateSetup.startSetup(estimateType);
      if (shouldOpenBuildScopeModal(estimateType)) {
        setAutoOpenScopeModalKey(result.data.id);
      }
      lineItemDraft.rehydrateFromVersion(nextVersion);
      scheduleSettingsHook.rehydrateFromEstimate(
        result.data,
        (result.data.lineItems ?? []) as import('../infrastructure/estimateDbTypes').EstimateDomainTask[],
        [],
        { enableLegacyEstimateScheduleFallback: false },
      );
      setLevelingModalResult(null);
    }
    setSaveToastMessage('Estimate started');
    navigate(
      estimateWorkspaceHref(
        resolvedProjectId,
        getDefaultWorkspaceTabForEstimateType(estimateType),
      ),
    );
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
    plan,
  ]);

  const handleSchedulingEnabledChange = useCallback(
    async (enabled: boolean) => {
      if (!currentEstimate) return;
      const optimistic = { ...currentEstimate, schedulingEnabled: enabled };
      setCurrentEstimate(optimistic);
      const result = await saveCurrentEstimate({
        ...buildEstimatePersistenceFields(optimistic),
        selectedDivisions: optimistic.selectedDivisions,
        lineItems: optimistic.lineItems,
        totals: optimistic.totals,
        summary: optimistic.summary,
        assumptions: optimistic.assumptions,
        createdBy: user?.id ?? null,
      });
      if (result.error) {
        setSaveError(result.error);
        setCurrentEstimate(currentEstimate);
        return;
      }
      if (result.data) {
        setCurrentEstimate(result.data);
      }
    },
    [currentEstimate, user?.id],
  );

  const handleEstimateTypeModalSelect = useCallback(
    (nextType: EstimateType) => {
      setEstimateTypeModalOpen(false);
      if (!isEstimateTypeAllowed(nextType)) {
        return;
      }
      if (!currentEstimate) {
        setSelectedEstimateMethod(nextType);
        setActiveEstimateType(nextType);
        void handleStartEstimate(nextType);
        return;
      }
      if (nextType === resolvedEstimateType) return;
      setPendingEstimateTypeChange(nextType);
      setEstimateTypeChangeConfirmOpen(true);
    },
    [currentEstimate, handleStartEstimate, isEstimateTypeAllowed, resolvedEstimateType],
  );

  const handleSwitchToSupportedEstimateType = useCallback(
    async (nextType: EstimateType) => {
      if (!currentEstimate || changingEstimateType || !isEstimateTypeAllowed(nextType)) return;

      setChangingEstimateType(true);
      setSaveError(null);

      const nextEstimate: CurrentEstimate = {
        ...currentEstimate,
        estimateType: nextType,
      };

      const result = await saveCurrentEstimate({
        ...buildEstimatePersistenceFields(nextEstimate),
        selectedDivisions: currentEstimate.selectedDivisions,
        lineItems: currentEstimate.lineItems,
        totals: currentEstimate.totals,
        summary: currentEstimate.summary,
        assumptions: currentEstimate.assumptions,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        setSaveError(result.error ?? 'Could not change estimate type.');
        setChangingEstimateType(false);
        return;
      }

      const loadedType = normalizeEstimateMethod(result.data.estimateType ?? nextType);
      setCurrentEstimate(result.data);
      setActiveEstimateType(result.data.estimateType);
      setSelectedEstimateMethod(loadedType);
      estimateSetup.restoreSavedSetup(loadedType, result.data.selectedDivisions);
      lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
      setChangingEstimateType(false);
      setSaveToastMessage('Estimate type updated');
      navigate(
        estimateWorkspaceHref(
          resolvedProjectId,
          getDefaultWorkspaceTabForEstimateType(loadedType),
        ),
        { replace: true },
      );
    },
    [
      changingEstimateType,
      currentEstimate,
      estimateSetup,
      isEstimateTypeAllowed,
      lineItemDraft,
      navigate,
      resolvedProjectId,
      user?.id,
    ],
  );

  const pendingEstimateTypeWarning = useMemo(
    () =>
      pendingEstimateTypeChange
        ? getEstimateTypeChangeWarning(
            resolvedEstimateType,
            pendingEstimateTypeChange,
            schedulingEnabled,
          )
        : { showWarning: false, title: '', body: '' },
    [pendingEstimateTypeChange, resolvedEstimateType, schedulingEnabled],
  );

  const handleConfirmEstimateTypeChange = useCallback(async () => {
    if (!currentEstimate || !pendingEstimateTypeChange || changingEstimateType) return;
    if (!isEstimateTypeAllowed(pendingEstimateTypeChange)) {
      setEstimateTypeChangeConfirmOpen(false);
      setPendingEstimateTypeChange(null);
      return;
    }

    setChangingEstimateType(true);
    setSaveError(null);

    const nextEstimate: CurrentEstimate = {
      ...currentEstimate,
      estimateType: pendingEstimateTypeChange,
    };

    const result = await saveCurrentEstimate({
      ...buildEstimatePersistenceFields(nextEstimate),
      selectedDivisions: currentEstimate.selectedDivisions,
      lineItems: currentEstimate.lineItems,
      totals: currentEstimate.totals,
      summary: currentEstimate.summary,
      assumptions: currentEstimate.assumptions,
      createdBy: user?.id ?? null,
    });

    if (result.error || !result.data) {
      setSaveError(result.error ?? 'Could not change estimate type.');
      setChangingEstimateType(false);
      return;
    }

    const loadedType = normalizeEstimateMethod(result.data.estimateType ?? pendingEstimateTypeChange);
    setCurrentEstimate(result.data);
    setActiveEstimateType(result.data.estimateType);
    setSelectedEstimateMethod(loadedType);
    estimateSetup.restoreSavedSetup(loadedType, result.data.selectedDivisions);
    lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
    setEstimateTypeChangeConfirmOpen(false);
    setPendingEstimateTypeChange(null);
    setChangingEstimateType(false);
    setSaveToastMessage('Estimate type updated');

    if (
      !isTabVisibleForEstimateType(
        activeTab,
        loadedType,
        result.data.schedulingEnabled,
      )
    ) {
      navigate(
        estimateWorkspaceHref(
          resolvedProjectId,
          getDefaultWorkspaceTabForEstimateType(loadedType),
        ),
      );
    }
  }, [
    activeTab,
    changingEstimateType,
    currentEstimate,
    estimateSetup,
    isEstimateTypeAllowed,
    lineItemDraft,
    navigate,
    pendingEstimateTypeChange,
    resolvedProjectId,
    user?.id,
  ]);

  // Divisions are dirty only when the session division codes differ from the persisted ones.
  // Using length > 0 was incorrect — it permanently flagged any estimate with saved divisions as dirty.
  const sessionDivisionCodeKey = estimateSetup.session.selectedDivisions
    .map((d) => d.code)
    .sort()
    .join(',');
  const persistedDivisionCodeKey = (currentEstimate?.selectedDivisions ?? [])
    .map((d) => d.code)
    .sort()
    .join(',');
  const divisionsDirty = sessionDivisionCodeKey !== persistedDivisionCodeKey;

  const hasPendingEstimateChanges = isConceptualEstimate
    ? conceptualEstimate.dirty || estimateSettings.dirty
    : lineItemDraft.dirty ||
      estimateSettings.dirty ||
      divisionsDirty ||
      projectCrewSizeDraftDirty;

  const workspaceSaveStatus = useEstimateWorkspaceSaveStatus({
    hasPendingEstimateChanges,
  });

  const canSave =
    estimate != null &&
    estimateAdapter != null &&
    !saving &&
    hasPendingEstimateChanges;

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
      workspaceSaveStatus.markSaving();
      setSaving(true);

      const result = await saveCurrentEstimate({
        ...buildEstimatePersistenceFields(currentEstimate),
        selectedDivisions: divisions,
        lineItems: currentEstimate.lineItems,
        totals: currentEstimate.totals,
        summary: currentEstimate.summary,
        assumptions: currentEstimate.assumptions,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        workspaceSaveStatus.markError(result.error);
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
      workspaceSaveStatus.markSaved();
      setSaving(false);
    },
    [currentEstimate, estimateAdapter, user?.id, estimateSetup, lineItemDraft, workspaceSaveStatus],
  );

  const handleEnsureDivisionsSelected = useCallback(
    async (divisionCodes: readonly string[]) => {
      if (!currentEstimate || !estimateAdapter || divisionCodes.length === 0) return;

      const existingCodes = new Set(currentEstimate.selectedDivisions.map((division) => division.code));
      const missingCodes = divisionCodes.filter((code) => !existingCodes.has(code));
      if (missingCodes.length === 0) return;

      const additions = buildSelectedDivisionsFromCodes(missingCodes, { source: 'ai' });
      await handleSaveSelectedDivisions(
        appendSelectedDivisions(currentEstimate.selectedDivisions, additions),
      );
      setSaveToastMessage(
        `Estimate saved — ${missingCodes.length} division${missingCodes.length === 1 ? '' : 's'} imported.`,
      );
      setImportCollapseDivisionCodesKey(
        `import-${Date.now()}-${missingCodes.join(',')}`,
      );
    },
    [currentEstimate, estimateAdapter, handleSaveSelectedDivisions],
  );

  const handleSaveEstimate = useCallback(async () => {
    if (!estimate || !estimateAdapter || saving) return;

    if (isConceptualEstimateType(resolvedEstimateType)) {
      if (!conceptualEstimate.dirty && !estimateSettings.dirty) return;

      setSaving(true);
      workspaceSaveStatus.markSaving();
      setSaveError(null);
      setSaveToastMessage(null);
      const conceptualPayloadForSave = conceptualEstimate.buildPayloadWithDraftItems();

      const saveAssumptions = mergeScheduleAssumptions(
        {
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: scheduleSettingsHook.logicNetworkInitialized,
          logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode,
          precedenceDiagram: scheduleSettingsHook.precedenceDiagram,
        },
        (currentEstimateRef.current?.assumptions as Record<string, unknown>) ?? {},
      );

      const result = await saveCurrentConceptualEstimate({
        estimateId: estimate.id,
        projectId: estimate.projectId,
        payload: conceptualPayloadForSave,
        estimateSettings: estimateSettings.settings,
        existingAssumptions: saveAssumptions,
        schedulingEnabled: currentEstimate?.schedulingEnabled,
        estimateModeConfig: currentEstimate?.estimateModeConfig ?? null,
        pricingMode: currentEstimate?.pricingMode ?? null,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        workspaceSaveStatus.markError(result.error);
        setSaveError(friendlyEstimateWorkspaceSaveError(result.error ?? 'Failed to save conceptual estimate.'));
        setSaving(false);
        return;
      }

      setSaveToastMessage(createEstimateSaveSuccessToast().message);
      setCurrentEstimate(result.data);
      conceptualEstimate.markSaved(result.data);
      estimateSettings.rehydrateFromEstimate(result.data);
      workspaceSaveStatus.markSaved();
      setSaving(false);
      return;
    }

    if (!canSave) return;

    const pendingCrewCommit = projectCrewSizeInputRef.current?.flushCommit() ?? null;
    if (pendingCrewCommit !== null) {
      setProjectCrewSizeDraftDirty(false);
      await handleProjectCrewSizeChange(pendingCrewCommit);
    }

    if (isQuickFeasibilityEstimate) {
      if (!estimateSettings.dirty && !projectCrewSizeDraftDirty) return;

      setSaving(true);
      workspaceSaveStatus.markSaving();
      setSaveError(null);
      setSaveToastMessage(null);

      const saveAssumptions = mergeScheduleAssumptions(
        {
          scheduleSettings: scheduleSettingsHook.scheduleSettings,
          logicLinks: scheduleSettingsHook.logicLinks,
          logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
          leveledActivityOffsets: scheduleSettingsHook.leveledOffsets,
          logicReviewIgnored: scheduleSettingsHook.logicReviewIgnored,
          logicNetworkInitialized: scheduleSettingsHook.logicNetworkInitialized,
          logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode,
          precedenceDiagram: scheduleSettingsHook.precedenceDiagram,
        },
        (currentEstimateRef.current?.assumptions as Record<string, unknown>) ?? {},
      );
      const assumptions = estimateSettingsToAssumptions(
        estimateSettings.settings,
        saveAssumptions,
      );

      const result = await saveCurrentEstimate({
        ...(currentEstimate
          ? buildEstimatePersistenceFields(currentEstimate)
          : {
              estimateId: estimate.id,
              projectId: estimate.projectId,
              estimateType: normalizeEstimateMethod(estimateAdapter.estimateType),
            }),
        selectedDivisions: currentEstimate?.selectedDivisions ?? [],
        lineItems: currentEstimate?.lineItems ?? [],
        totals: currentEstimate?.totals ?? {},
        summary: currentEstimate?.summary ?? {},
        assumptions,
        createdBy: user?.id ?? null,
      });

      if (result.error || !result.data) {
        workspaceSaveStatus.markError(result.error);
        setSaveError(friendlyEstimateWorkspaceSaveError(result.error ?? 'Failed to save estimate settings.'));
        setSaving(false);
        return;
      }

      setSaveToastMessage(createEstimateSaveSuccessToast().message);
      setCurrentEstimate(result.data);
      estimateSettings.rehydrateFromEstimate(result.data);
      workspaceSaveStatus.markSaved();
      setSaving(false);
      return;
    }

    const savedDivisionKey = (currentEstimate?.selectedDivisions ?? [])
      .map((d) => d.code)
      .sort()
      .join(',');
    const sessionDivisionKey = estimateSetup.session.selectedDivisions
      .map((d) => d.code)
      .sort()
      .join(',');
    const hasEstimateChanges =
      lineItemDraft.dirty ||
      estimateSettings.dirty ||
      sessionDivisionKey !== savedDivisionKey;

    if (!hasEstimateChanges) {
      return;
    }

    setSaving(true);
    workspaceSaveStatus.markSaving();
    setSaveError(null);
    setSaveToastMessage(null);

    const invalidateCpmOnSave = shouldInvalidateCpmOnEstimateSave({
      estimateSettingsDirty: estimateSettings.dirty,
      lineItemDraftDirty: lineItemDraft.dirty,
      usesConstructionActivities: constructionActivities.length > 0,
    });

    const precedenceDiagramForSave =
      invalidateCpmOnSave && scheduleSettingsHook.precedenceDiagram.hasRunCpm
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
      invalidateCpmOnSave &&
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
      ...(currentEstimate
        ? {
            schedulingEnabled: currentEstimate.schedulingEnabled,
            estimateModeConfig: currentEstimate.estimateModeConfig,
            pricingMode: currentEstimate.pricingMode,
          }
        : {}),
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
      workspaceSaveStatus.markError(result.error);
      setSaveError(friendlyEstimateWorkspaceSaveError(result.error ?? 'Failed to save estimate.'));
      setSaving(false);
      return;
    }

    setSaveToastMessage(createEstimateSaveSuccessToast().message);
    setCurrentEstimate((previous) =>
      previous && result.data
        ? {
            ...previous,
            lineItems: result.data.lineItems,
            totals: result.data.totals,
            summary: result.data.summary,
            assumptions: result.data.assumptions,
            selectedDivisions: result.data.selectedDivisions,
            updatedAt: result.data.updatedAt,
          }
        : result.data,
    );
    lineItemDraft.rehydrateFromVersion(currentEstimateToDomainVersion(result.data));
    estimateSettings.rehydrateFromEstimate(result.data);
    estimateSetup.restoreSavedSetup(
      normalizeEstimateMethod(result.data.estimateType ?? estimateAdapter.estimateType),
      result.data.selectedDivisions,
    );

    workspaceSaveStatus.markSaved();
    setSaving(false);
  }, [
    constructionActivities.length,
    conceptualEstimate,
    estimate,
    estimateAdapter,
    canSave,
    saving,
    resolvedEstimateType,
    lineItemDraft,
    estimateSettings,
    estimateSetup,
    scheduleActivitiesResult.activities,
    scheduleSettingsHook,
    currentEstimate?.assumptions,
    currentEstimate?.selectedDivisions,
    currentEstimate?.schedulingEnabled,
    currentEstimate?.estimateModeConfig,
    currentEstimate?.pricingMode,
    estimateSetup.session.selectedDivisions,
    user?.id,
    projectCrewSizeDraftDirty,
    handleProjectCrewSizeChange,
    workspaceSaveStatus,
  ]);

  const handleRetrySave = useCallback(() => {
    workspaceSaveStatus.clearError();
    void handleSaveEstimate();
  }, [handleSaveEstimate, workspaceSaveStatus]);

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
        setSaveError(result.error ?? QUICK_ESTIMATE_SAVE_ERROR_MESSAGE);
        setSaveToastMessage(QUICK_ESTIMATE_SAVE_ERROR_MESSAGE);
        setSaving(false);
        return;
      }

      setSaveToastMessage(QUICK_ESTIMATE_SAVE_SUCCESS_MESSAGE);
      setQuickEstimateSavedAt(Date.now());
      setCurrentEstimate(result.data);
      rehydrateDraftFromVersion(currentEstimateToDomainVersion(result.data));
      setSaving(false);
    },
    [estimate, rehydrateDraftFromVersion, saving, user?.id],
  );

  const handleQuickFeasibilityPreviewChange = useCallback(
    (inputs: QuickFeasibilityInputs, result: QuickFeasibilityResult) => {
      setQuickFeasibilityPreview({ inputs, result });
    },
    [],
  );

  const handleQuickTabSave = useCallback(() => {
    const preview = quickFeasibilityPreviewRef.current;
    if (preview) void handleSaveQuickEstimate(preview);
  }, [handleSaveQuickEstimate]);

  const savedQuickFeasibilityInputs = useMemo(
    () =>
      estimateAdapter ? quickFeasibilityInputsFromSnapshot(estimateAdapter.snapshot) : null,
    [estimateAdapter],
  );

  const isQuickFeasibilityDirty = useMemo(() => {
    if (!quickFeasibilityPreview || !savedQuickFeasibilityInputs) return false;
    return (
      JSON.stringify(quickFeasibilityPreview.inputs) !==
      JSON.stringify(savedQuickFeasibilityInputs)
    );
  }, [quickFeasibilityPreview, savedQuickFeasibilityInputs]);

  const quickSaveStatusHint = useMemo(() => {
    if (isQuickFeasibilityDirty) return 'Unsaved changes';
    if (quickEstimateSavedAt != null) return 'Saved just now';
    return null;
  }, [isQuickFeasibilityDirty, quickEstimateSavedAt]);

  const handleResetEstimate = useCallback(async (): Promise<boolean> => {
    if (!resolvedProjectId || saving) return false;

    setSaving(true);
    setSaveError(null);
    setSaveToastMessage(null);
    workspaceSaveStatus.markSaving();

    try {
      const result = await resetCurrentEstimateWorkspace(resolvedProjectId);

      if (result.error) {
        workspaceSaveStatus.markError(result.error);
        setSaveError(result.error ?? 'Failed to reset estimate.');
        return false;
      }

      lineItemDraft.resetDraftSetup();
      estimateSettings.rehydrateFromEstimate(null);
      scheduleSettingsHook.rehydrateFromEstimate(null, []);
      estimateSetup.resetSetup(selectedEstimateMethod);
      conceptualEstimate.rehydrateFromEstimate(null);
      setLevelingModalResult(null);
      setImportCollapseDivisionCodesKey(null);
      setCurrentEstimate(null);
      setActiveEstimateType(null);
      await reloadConstructionActivities();
      workspaceSaveStatus.markSaved();
      setSaveToastMessage('Estimate reset');
      return true;
    } finally {
      setSaving(false);
    }
  }, [
    conceptualEstimate,
    estimateSetup,
    estimateSettings,
    lineItemDraft,
    reloadConstructionActivities,
    resolvedProjectId,
    saving,
    scheduleSettingsHook,
    selectedEstimateMethod,
    workspaceSaveStatus,
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
      scheduleSourceRehydrateKeyRef.current = null;
      rehydrateScheduleFromEstimate(result.data);
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
      rehydrateScheduleFromEstimate,
      user?.id,
    ],
  );

  const handleApplyActivityExcelImport = useCallback(
    async ({
      mode,
      groups,
    }: {
      mode: ActivityExcelImportMode;
      groups: ParsedActivityGroup[];
    }) => {
      if (!estimate || saving || !resolvedProjectId) return;
      const excelType: ActivityExcelEstimateType | null =
        resolvedEstimateType === 'detailed' || resolvedEstimateType === 'bid'
          ? resolvedEstimateType
          : null;
      if (!excelType) return;

      setSaving(true);
      setSaveError(null);
      setSaveToastMessage(null);

      const laborRates =
        projectRates.length > 0 ? projectRates : await ensureProjectLaborRatesReady();
      const existingResult = await loadProjectActivitiesWithLineItems(resolvedProjectId, estimate.id);
      const existingLoaded = existingResult.data ?? [];
      const existingLineItemsByActivityId = new Map(
        existingLoaded.map((entry) => [entry.activity.id, entry.lineItems]),
      );

      const result = await applyActivityExcelImport({
        mode,
        groups,
        projectId: resolvedProjectId,
        estimateId: estimate.id,
        projectLaborRates: laborRates,
        existingActivities: existingLoaded.map((entry) => entry.activity),
        existingLineItemsByActivityId,
      });

      if (result.error) {
        setSaveError(result.error);
        setSaving(false);
        return;
      }

      await reloadConstructionActivities();
      // Trigger the activities panel to reload its own state from DB.
      setActivitiesPanelReloadKey((k) => k + 1);
      setSaveToastMessage(
        `Imported ${result.importedActivityCount} activit${result.importedActivityCount === 1 ? 'y' : 'ies'} (${result.importedLineItemCount} line items)`,
      );
      setImportModalOpen(false);
      setSaving(false);
    },
    [
      estimate,
      saving,
      resolvedProjectId,
      resolvedEstimateType,
      projectRates,
      ensureProjectLaborRatesReady,
      reloadConstructionActivities,
    ],
  );

  const handleExportEstimate = useCallback(async () => {
    if (!currentEstimate || !resolvedProjectId || !estimate?.id) return;
    const excelType: ActivityExcelEstimateType | null =
      resolvedEstimateType === 'detailed' || resolvedEstimateType === 'bid'
        ? resolvedEstimateType
        : null;

    if (excelType) {
      const loaded = await loadProjectActivitiesWithLineItems(resolvedProjectId, estimate.id);
      if (loaded.error || !loaded.data) {
        setSaveError(loaded.error ?? 'Failed to export construction activities.');
        return;
      }
      downloadActivityExcelExport(
        mapLoadedActivitiesToExportInput(
          excelType,
          project?.name ?? 'project',
          loaded.data,
        ),
      );
      return;
    }

    downloadEstimateWorkbook(currentEstimate, project?.name ?? 'project');
  }, [currentEstimate, project?.name, resolvedProjectId, estimate?.id, resolvedEstimateType]);

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

      workspaceSaveStatus.markSaving();
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
        workspaceSaveStatus.markError(result.error);
        setSaveToastMessage(
          friendlyEstimateWorkspaceSaveError(result.error ?? 'Failed to save logic links'),
        );
      } else {
        workspaceSaveStatus.markSaved();
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
      workspaceSaveStatus,
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
      // Layout-only save: positions + view mode + CPM metadata — never logic links or line items.
      const updatedAssumptions = mergeLogicLayoutAssumptionsOnly(
        layout,
        estimate.assumptions as Record<string, unknown>,
        {
          logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode,
          precedenceDiagram: scheduleSettingsHook.precedenceDiagram,
        },
      );

      workspaceSaveStatus.markSaving();
      const result = await saveCurrentEstimate({
        ...(currentEstimate ? buildEstimatePersistenceFields(currentEstimate) : {
          estimateId: estimate.id,
          projectId: estimate.projectId,
          estimateType: normalizeEstimateMethod(estimateAdapter.estimateType),
        }),
        selectedDivisions: estimate.selectedDivisions,
        lineItems: estimate.lineItems,
        totals: estimate.totals,
        summary: estimate.summary,
        assumptions: updatedAssumptions,
        createdBy: user?.id ?? null,
      });
      if (result.error || !result.data) {
        workspaceSaveStatus.markError(result.error);
        throw new Error(friendlyEstimateWorkspaceSaveError(result.error ?? 'Failed to save logic layout'));
      }
      workspaceSaveStatus.markSaved();
      setCurrentEstimate((previous) =>
        previous && result.data
          ? { ...previous, assumptions: result.data.assumptions }
          : result.data,
      );
    },
    [estimateAdapter, scheduleSettingsHook, user?.id, workspaceSaveStatus],
  );

  const handleLogicNetworkLayoutChange = useCallback(
    (layout: LogicNetworkLayout[]) => {
      scheduleSettingsHook.setLogicNetworkLayout(layout);
    },
    [scheduleSettingsHook.setLogicNetworkLayout],
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
    const newOffsets: Record<string, number> = { ...levelingModalResult.appliedOffsets };
    scheduleSettingsHook.setLeveledOffsets(newOffsets);
    const updatedAssumptions = mergeScheduleAssumptions(
      {
        logicLinks: scheduleSettingsHook.logicLinks,
        logicNetworkLayout: scheduleSettingsHook.logicNetworkLayout,
        scheduleSettings: scheduleSettingsHook.scheduleSettings,
        leveledActivityOffsets: newOffsets,
        logicNetworkInitialized: true,
        resourceLevelingResults: {
          movedActivities: levelingModalResult.movedActivities,
        },
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
    // Close the post-Apply timing gap: make the saved leveling provider records
    // (resourceLevelingResults.movedActivities[].resourceProviderActivityCodes)
    // available in-memory immediately so resource-dummy connectors render right
    // away, without requiring a reload/re-apply.
    setCurrentEstimate((previous) => {
      const nextAssumptions =
        (result.data?.assumptions as Record<string, unknown> | undefined) ?? updatedAssumptions;
      if (previous) return { ...previous, assumptions: nextAssumptions };
      return result.data ?? previous;
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
    async (format: 'pdf' | 'excel', mode: GanttExportMode = 'leveled') => {
      if (!estimateAdapter || !cpmResult) return;
      setSaveToastMessage('Preparing CPM export…');
      try {
        const effectiveLeveledOffsets =
          mode === 'baseline' ? {} : scheduleSettingsHook.leveledOffsets;
        const projectStartDate =
          scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd();

        if (format === 'pdf') {
          await downloadLevelThreeGanttPdf({
            projectName: project?.name ?? 'project',
            cpmResult,
            activities: scheduleActivitiesResult.activities,
            projectStartDate,
            leveledOffsets: effectiveLeveledOffsets,
            scheduleMode: mode,
          });
          setSaveToastMessage('Gantt PDF exported');
        } else {
          const exportParams = {
            schedule: null as BuildGanttScheduleResult | null,
            projectName: project?.name ?? 'project',
            estimateType: estimateAdapter.estimateType,
            cpmResult,
            activities: scheduleActivitiesResult.activities,
            logicLinks: scheduleSettingsHook.logicLinks,
            projectStartDate,
            scheduleSettings: scheduleSettingsHook.scheduleSettings,
            leveledOffsets: effectiveLeveledOffsets,
            resourceHistogram,
            scheduleMode: mode,
          };
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
    const excelType: ActivityExcelEstimateType | null =
      resolvedEstimateType === 'detailed' || resolvedEstimateType === 'bid'
        ? resolvedEstimateType
        : null;
    if (excelType) {
      void downloadEstimateExcelTemplate(excelType, project?.name ?? 'project');
      return;
    }
    downloadBlankEstimateTemplateWorkbook();
  }, [project?.name, resolvedEstimateType]);

  const handleOpenHelp = useCallback(() => {
    const { lastSection, open } = useDefinitionsHelpStore.getState();
    open(undefined, { section: lastSection });
  }, []);

  const estimateIdForGuide = estimate?.id ?? null;
  const [hasDismissedGuideForEstimate, setHasDismissedGuideForEstimate] = useState(false);

  useEffect(() => {
    if (!estimateIdForGuide) {
      setHasDismissedGuideForEstimate(false);
      return;
    }
    setHasDismissedGuideForEstimate(hasDismissedEstimateGuide(estimateIdForGuide));
  }, [estimateIdForGuide]);

  const dismissGuidedHelpForCurrentEstimate = useCallback(() => {
    if (!estimateIdForGuide) return;
    markEstimateGuideDismissed(estimateIdForGuide);
    setHasDismissedGuideForEstimate(true);
  }, [estimateIdForGuide]);

  const handleOpenGuidedHelp = useCallback(() => {
    useDefinitionsHelpStore.getState().open(undefined, { section: 'guide' });
    dismissGuidedHelpForCurrentEstimate();
  }, [dismissGuidedHelpForCurrentEstimate]);

  const handleDismissGuidedHelp = useCallback(() => {
    dismissGuidedHelpForCurrentEstimate();
  }, [dismissGuidedHelpForCurrentEstimate]);

  const showGuidedHelpBadge = useMemo(
    () =>
      shouldShowConceptualEstimateGuideBadge({
        isConceptualEstimate,
        hasEstimate: estimate != null,
        estimateId: estimateIdForGuide,
        payload: isConceptualEstimate ? conceptualEstimate.payload : null,
        hasDismissedGuideForEstimate,
      }),
    [
      conceptualEstimate.payload,
      estimate,
      estimateIdForGuide,
      hasDismissedGuideForEstimate,
      isConceptualEstimate,
    ],
  );

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

  if (plannerLoading && !currentEstimate) {
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
  const showWorkspaceTabPanels = !loadError && !estimateTypeEntitlementBlocked;
  const selectedDivisionCount = currentEstimate?.selectedDivisions.length ?? 0;
  const lineItemCount = currentEstimate?.lineItems.length ?? 0;
  const tabRenderOptions = { isLoading: dataLoading, hasEstimate };
  const showOverviewLoading = activeTab === 'overview' && dataLoading;
  const showEstimateTabLoading = activeTab === 'line-items' && dataLoading;
  const showEstimateTypeSelection = shouldShowEstimateTypeSelectionOnTab(activeTab, tabRenderOptions);
  const showStartEstimatePrompt =
    !dataLoading &&
    !hasEstimate &&
    (showEstimateTypeSelection ||
      activeTab === 'quick-estimate' ||
      activeTab === 'overview' ||
      activeTab === 'conceptual-budget');
  const showOverviewNoEstimate = shouldShowOverviewNoEstimateMessage(activeTab, tabRenderOptions);
  const showOverviewFinancialSummary = shouldShowOverviewFinancialSummary(
    activeTab,
    tabRenderOptions,
  );
  const showEstimateBuilder = shouldShowEstimateBuilderPanel(activeTab, tabRenderOptions);
  const isQuickFeasibilityEstimate = isQuickEstimateType(resolvedEstimateType);
  const canEditEstimate = hasEstimate && hasEstimateAdapter;
  const showCollapseAll = shouldShowCollapseAllAction(
    activeTab,
    builderToolbarHandlers?.showCollapseAll ?? false,
  );
  const hasPersistedWorkspaceWork =
    hasEstimate ||
    constructionActivities.length > 0 ||
    (currentEstimate?.selectedDivisions.length ?? 0) > 0 ||
    estimateSetup.session.selectedDivisions.length > 0;
  const showResetForm = shouldShowResetFormAction(
    activeTab,
    hasEstimate,
    activeEstimateType,
    estimateSetup,
    canEditEstimate || activeEstimateType != null,
    hasPersistedWorkspaceWork,
  );
  const showEstimateSettings = shouldShowEstimateSettingsPanel(activeTab, tabRenderOptions);
  const hasProjectContext = Boolean(resolvedProjectId);
  const saveBlockedReason =
    !estimate && !saving && workspaceSaveStatus.status !== 'saving'
      ? 'Select an estimate type before saving'
      : null;
  const showSaveBucket = shouldShowBucketSaveAction(
    activeTab,
    hasEstimate,
    activeEstimateType,
    isQuickFeasibilityEstimate,
    builderToolbarHandlers?.showCollapseAll ?? false,
    hasProjectContext,
  );
  const showSaveQuick = shouldShowQuickSaveAction(
    activeTab,
    (builderToolbarHandlers?.showSaveQuick ?? false) ||
      (activeTab === 'quick-estimate' && isQuickFeasibilityEstimate && hasEstimate),
  );
  const quickTabToolbarHandlers = useMemo<EstimateBuilderToolbarHandlers>(
    () => ({
      showCollapseAll: false,
      showSaveQuick: true,
      canSaveQuick: Boolean(quickFeasibilityPreview?.result.isValid) && !saving,
      showAddDivision: false,
      collapseAll: () => {},
      saveQuick: handleQuickTabSave,
      openAddDivision: () => {},
    }),
    [quickFeasibilityPreview?.result.isValid, saving, handleQuickTabSave],
  );
  const workspaceToolbarHandlers =
    activeTab === 'quick-estimate' && isQuickFeasibilityEstimate && hasEstimate
      ? quickTabToolbarHandlers
      : builderToolbarHandlers;
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
  const showConvertToDetailed = shouldShowConvertToDetailedAction(
    activeTab,
    hasEstimate,
    isConceptualEstimate,
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

  const headerCollapse = useEstimateWorkspaceHeaderCollapse();
  const headerCollapseEnabled = headerCollapse?.enabled ?? false;
  const setHeaderMiniStatus = headerCollapse?.setMiniStatus;
  const plannerWorkspaceFocus = usePlannerWorkspaceFocus();
  const setPlannerWorkspaceFocusMode = plannerWorkspaceFocus?.setWorkspaceFocusMode;
  const isModelWorkspaceTab = activeTab === '3d-takeoff' || activeTab === 'design-builder';
  const isModelWorkspaceFocusMode = isModelWorkspaceTab && Boolean(headerCollapse?.focusMode);
  const isDesignBuilderFocusMode = activeTab === 'design-builder' && Boolean(headerCollapse?.focusMode);

  useEffect(() => {
    setPlannerWorkspaceFocusMode?.(isModelWorkspaceFocusMode);
    return () => {
      setPlannerWorkspaceFocusMode?.(false);
    };
  }, [setPlannerWorkspaceFocusMode, isModelWorkspaceFocusMode]);

  useEffect(() => {
    if (!isModelWorkspaceTab && headerCollapse?.focusMode) {
      headerCollapse.setFocusMode(false);
    }
  }, [isModelWorkspaceTab, headerCollapse]);

  useEffect(() => {
    if (!isModelWorkspaceFocusMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        headerCollapse?.setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModelWorkspaceFocusMode, headerCollapse]);

  const activeTabLabel =
    visibleWorkspaceTabs.find((tab) => tab.id === activeTab)?.label ??
    entitlementFilteredTabs.find((tab) => tab.id === activeTab)?.label ??
    'Workspace';

  useEffect(() => {
    if (!headerCollapseEnabled || !setHeaderMiniStatus) return;
    const saveControl = resolveEstimateWorkspaceSaveControl({
      status: workspaceSaveStatus.status,
      activeOperations: workspaceSaveStatus.activeOperations,
      hasPendingEstimateChanges,
      errorMessage: workspaceSaveStatus.errorMessage ?? saveError,
      saveBlockedReason,
    });
    setHeaderMiniStatus({
      estimateTypeLabel: hasEstimate
        ? formatEstimateMethodLabel(resolvedEstimateType)
        : 'No estimate type selected',
      activeTabLabel,
      saveStatus: workspaceSaveStatus.status,
      saveStatusLabel: saveControl.label,
      hasPendingEstimateChanges,
    });
  }, [
    headerCollapseEnabled,
    setHeaderMiniStatus,
    hasEstimate,
    resolvedEstimateType,
    activeTabLabel,
    workspaceSaveStatus.status,
    workspaceSaveStatus.activeOperations,
    workspaceSaveStatus.errorMessage,
    hasPendingEstimateChanges,
    saveError,
    saveBlockedReason,
  ]);

  const estimateWorkspaceTabBar = (
    <EstimateWorkspaceTabBar
      activeTabId={activeTab}
      visibleTabs={entitlementFilteredTabs}
      onTabChange={handleTabChange}
      estimateTypeControl={
        <EstimateTypeHeaderControl
          hasEstimate={hasEstimate}
          estimateType={resolvedEstimateType}
          schedulingEnabled={schedulingEnabled}
          onActionClick={() => setEstimateTypeModalOpen(true)}
          disabled={saving || changingEstimateType || dataLoading || creating}
        />
      }
      rightActions={
        <EstimateWorkspaceToolbarActions
          showAddDivision={showAddDivision}
          showCollapseAll={showCollapseAll}
          showReset={showResetForm}
          showSaveBucket={showSaveBucket}
          showSaveQuick={showSaveQuick}
          showImportExport={showImportExport}
          showConvertToDetailed={showConvertToDetailed}
          canEdit={canEditEstimate || activeEstimateType != null}
          canSaveQuick={workspaceToolbarHandlers?.canSaveQuick ?? false}
          saving={saving}
          saveStatus={workspaceSaveStatus.status}
          saveStatusActiveOperations={workspaceSaveStatus.activeOperations}
          hasPendingEstimateChanges={hasPendingEstimateChanges}
          saveStatusErrorMessage={workspaceSaveStatus.errorMessage ?? saveError}
          saveBlockedReason={saveBlockedReason}
          handlers={workspaceToolbarHandlers}
          onReset={() => {
            if (activeTab === 'settings') {
              estimateSettings.resetSettings();
              return;
            }
            setResetModalOpen(true);
          }}
          onSave={() => void handleSaveEstimate()}
          onRetrySave={handleRetrySave}
          onImportEstimate={() => setImportModalOpen(true)}
          onExportEstimate={handleExportEstimate}
          onDownloadImportTemplate={handleDownloadImportTemplate}
          onOpenHelp={handleOpenHelp}
          onConvertToDetailed={() => setConvertToDetailedModalOpen(true)}
          showGuidedHelpBadge={showGuidedHelpBadge}
          onOpenGuidedHelp={handleOpenGuidedHelp}
          onDismissGuidedHelp={handleDismissGuidedHelp}
        />
      }
    />
  );

  const headerPortalTarget =
    headerCollapse?.portalTargetRef.current ??
    (typeof document !== 'undefined'
      ? document.getElementById(ESTIMATE_WORKSPACE_HEADER_PORTAL_ID)
      : null);

  return (
    <EstimateWorkspaceSaveStatusProvider value={workspaceSaveStatus}>
    <>
      <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        {headerCollapse?.enabled && headerCollapse.portalReady && headerPortalTarget
          ? createPortal(estimateWorkspaceTabBar, headerPortalTarget)
          : !headerCollapse?.enabled
            ? estimateWorkspaceTabBar
            : null}

        <div
          className={
            isDesignBuilderFocusMode
              ? 'min-h-0 flex-1 overflow-hidden p-0'
              : 'flex-1 overflow-y-auto p-4 sm:p-6'
          }
        >
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

        {!loadError && backgroundRefreshing && hasEstimate ? (
          <div className={`mb-3 text-right text-xs ${PLANNER_MUTED}`} role="status">
            Refreshing estimate...
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

        {!loadError && !dataLoading && estimateTypeEntitlementBlocked ? (
          <UnsupportedEstimateTypePanel
            estimateType={resolvedEstimateType}
            plan={plan}
            onSwitchToSupportedEstimateType={(type) => void handleSwitchToSupportedEstimateType(type)}
            switching={changingEstimateType}
          />
        ) : null}

        {showWorkspaceTabPanels && showOverviewLoading ? (
          <p className={`py-12 text-center text-sm ${PLANNER_MUTED}`}>{LOADING_ESTIMATE_MESSAGE}</p>
        ) : null}

        {showWorkspaceTabPanels && showEstimateTabLoading ? (
          <p className={`py-12 text-center text-sm ${PLANNER_MUTED}`}>{LOADING_ESTIMATE_MESSAGE}</p>
        ) : null}

        {showWorkspaceTabPanels && showOverviewNoEstimate ? (
          <EstimateWorkspaceEmptyState
            title="No estimate started"
            body={OVERVIEW_NO_ESTIMATE_MESSAGE}
          />
        ) : null}

        {showWorkspaceTabPanels && showOverviewFinancialSummary && hasEstimateAdapter ? (
          <EstimateTotalsReviewPanel
            version={estimateAdapter}
            loading={
              dataLoading ||
              constructionActivitiesLoading ||
              (supportsConstructionActivitiesWorkflow(resolvedEstimateType) &&
                projectResourceTotals.loading)
            }
            estimateType={resolvedEstimateType}
            constructionActivities={constructionActivities}
            projectMaterialResources={
              supportsConstructionActivitiesWorkflow(resolvedEstimateType)
                ? projectResourceTotals.materials
                : undefined
            }
            projectEquipmentResources={
              supportsConstructionActivitiesWorkflow(resolvedEstimateType)
                ? projectResourceTotals.equipment
                : undefined
            }
            settingsState={estimateSettings}
            conceptualRollup={isConceptualEstimate ? conceptualEstimate.rollup : null}
            canEdit={canEditEstimate}
            scheduleActivities={scheduleActivitiesResult.activities}
            projectDurationDays={cpmResult?.projectDurationDays ?? null}
            cpmActivities={cpmResult?.activities}
          />
        ) : null}

        {showWorkspaceTabPanels && showStartEstimatePrompt ? (
          <div className="space-y-4">
            <EstimateMethodSelector
              value={selectedEstimateMethod}
              onChange={setSelectedEstimateMethod}
              disabled={creating}
              isEstimateTypeAllowed={isEstimateTypeAllowed}
              defaultEstimateType={planDefaultEstimateType}
            />
            <EstimateWorkspaceEmptyState
              title="No estimate has been started for this project yet"
              body="Choose an estimate type and click Start Estimate."
            />
            <Button
              variant="accent"
              size="sm"
              icon={<Play className="h-4 w-4" />}
              disabled={creating || !isEstimateTypeAllowed(selectedEstimateMethod)}
              isLoading={creating}
              className="w-full sm:w-auto"
              onClick={() => void handleStartEstimate()}
            >
              {creating ? 'Starting...' : 'Start Estimate'}
            </Button>
          </div>
        ) : null}

        {showWorkspaceTabPanels && showEstimateSettings && hasEstimate ? (
          <EstimateSettingsPanel
            settingsState={estimateSettings}
            canEdit={canEditEstimate}
            projectId={resolvedProjectId}
            estimateType={resolvedEstimateType}
            schedulingEnabled={schedulingEnabled}
            onEstimateTypeChange={() => setEstimateTypeModalOpen(true)}
            onSchedulingEnabledChange={(enabled) => void handleSchedulingEnabledChange(enabled)}
            projectCrewSize={projectAvailableCrewSize}
            onProjectCrewSizeChange={(value) => void handleProjectCrewSizeChange(value)}
            onProjectCrewSizeDraftChange={handleProjectCrewSizeDraftChange}
            projectCrewSizeInputRef={projectCrewSizeInputRef}
            projectCrewSizeSaving={projectCrewSizeSaving}
          />
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'settings' && !hasEstimate ? (
          <EstimateWorkspaceEmptyState
            title="No estimate started"
            body={TAB_NO_ESTIMATE_MESSAGE}
          />
        ) : null}

        {showWorkspaceTabPanels && showEstimateBuilder && estimate && hasEstimateAdapter ? (
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

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'schedule-preview' ? (
          hasEstimate && estimate ? (
            !schedulingEnabled ? (
              renderScheduleDisabledEmptyState(resolvedEstimateType)
            ) : (
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
                effectiveSchedule={effectiveSchedule}
                planControls={schedulePlanControls}
                onPlanControlsChange={handleSchedulePlanControlsChange}
                loading={dataLoading}
                totalConstructionActivityCount={constructionActivities.length}
                schedulePreviewSource={schedulePreviewSource}
                legacyScheduleAvailable={legacyScheduleLineItemsAvailable}
              />
            </div>
            )
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'gantt-preview' ? (
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

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'logic-network' ? (
          hasEstimate ? (
            !schedulingEnabled ? (
              renderScheduleDisabledEmptyState(resolvedEstimateType)
            ) : (
            (() => {
              const emptyState = resolveScheduleTabEmptyState(
                constructionActivities.length,
                scheduleActivitiesResult.activities.length,
                'logic-network',
                Boolean(cpmResult?.hasRunCpm),
              );
              if (emptyState) {
                return (
                  <div className="space-y-3">
                    {renderScheduleSourceDevBadge(
                      scheduleActivitiesResult.activities.length,
                      enableLegacyEstimateScheduleFallback,
                    )}
                    <EstimateWorkspaceEmptyState
                      title={emptyState.title}
                      body={emptyState.body}
                    />
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {renderScheduleSourceDevBadge(
                    scheduleActivitiesResult.activities.length,
                    enableLegacyEstimateScheduleFallback,
                  )}
                  {scheduleActivitiesResult.warnings.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {scheduleActivitiesResult.warnings.map((w, i) => (
                        <div key={`schedule-${i}`}>{w.message}</div>
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
                    levelingApplied={levelingApplied}
                    leveledDurationDays={effectiveAnalysis?.leveledDurationDays ?? null}
                    effectiveAnalysis={effectiveAnalysis}
                  />
                </div>
              );
            })()
            )
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'level-iii-gantt' ? (
          hasEstimate ? (
            !schedulingEnabled ? (
              renderScheduleDisabledEmptyState(resolvedEstimateType)
            ) : (
            (() => {
              const emptyState = resolveScheduleTabEmptyState(
                constructionActivities.length,
                scheduleActivitiesResult.activities.length,
                'level-iii-gantt',
                Boolean(cpmResult?.hasRunCpm),
              );
              if (emptyState) {
                return (
                  <div className="space-y-3">
                    {renderScheduleSourceDevBadge(
                      scheduleActivitiesResult.activities.length,
                      enableLegacyEstimateScheduleFallback,
                    )}
                    <EstimateWorkspaceEmptyState
                      title={emptyState.title}
                      body={emptyState.body}
                    />
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {renderScheduleSourceDevBadge(
                    scheduleActivitiesResult.activities.length,
                    enableLegacyEstimateScheduleFallback,
                  )}
                  {cpmResult && !cpmResult.hasValidCriticalPath ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                      No valid critical path yet. Complete the logic network from project start to
                      project finish.
                    </div>
                  ) : null}
                  {scheduleActivitiesResult.warnings.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {scheduleActivitiesResult.warnings.map((w, i) => (
                        <div key={`schedule-${i}`}>{w.message}</div>
                      ))}
                    </div>
                  ) : null}
                  <LevelThreeGanttWorkspace
                    chartExportRef={ganttExportRef}
                    activities={scheduleActivitiesResult.activities}
                    cpmResult={activeScheduleCpmResult}
                    levelingApplied={levelingApplied}
                    scheduleSettings={scheduleSettingsHook.scheduleSettings}
                    leveledOffsets={{}}
                    logicLinks={scheduleSettingsHook.logicLinks}
                    lineItems={estimateAdapter?.lineItems ?? []}
                    onEditActivity={handleEditActivityFromGantt}
                    exportReady={Boolean(cpmResult?.hasRunCpm && cpmResult.hasValidPrecedenceDiagram)}
                    onExportPdf={(mode) => void runCpmGanttExport('pdf', mode)}
                    onExportExcel={(mode) => void runCpmGanttExport('excel', mode)}
                    resourceHistogram={resourceHistogram}
                    onResourceLevel={
                      cpmResult?.hasRunCpm && scheduleActivitiesResult.activities.length > 0
                        ? handleRunResourceLeveling
                        : undefined
                    }
                    onClearLeveling={() => {
                      scheduleSettingsHook.setLeveledOffsets({});
                      void handleApplyResourceLeveling();
                    }}
                    showClearLeveling={Object.keys(scheduleSettingsHook.leveledOffsets).length > 0}
                  />
                </div>
              );
            })()
            )
          ) : (
            <EstimateWorkspaceEmptyState
              title="No estimate started"
              body={TAB_NO_ESTIMATE_MESSAGE}
            />
          )
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'quick-estimate' && hasEstimate ? (
          <EstimateQuickFeasibilityPanel
            disabled={!canEditEstimate || saving}
            projectContext={
              projectScopeContext
                ? {
                    projectName: projectScopeContext.projectName,
                    projectDescription: projectScopeContext.projectDescription,
                    locationLabel: projectScopeContext.locationLabel,
                  }
                : null
            }
            initialInputs={
              estimateAdapter
                ? quickFeasibilityInputsFromSnapshot(estimateAdapter.snapshot)
                : null
            }
            initialInputsKey={estimateAdapter?.id ?? null}
            onPreviewChange={handleQuickFeasibilityPreviewChange}
            onSave={handleQuickTabSave}
            canSave={Boolean(quickFeasibilityPreview?.result.isValid) && !saving}
            saving={saving}
            saveStatusHint={quickSaveStatusHint}
          />
        ) : null}

        {showWorkspaceTabPanels &&
        !dataLoading &&
        isConceptualEstimate &&
        hasEstimate &&
        activeTab === 'conceptual-budget' ? (
          <ConceptualBudgetPanel
            controller={conceptualEstimate}
            disabled={saving}
            lastUpdated={currentEstimate?.updatedAt ?? null}
          />
        ) : null}

        {showWorkspaceTabPanels &&
        !dataLoading &&
        isConceptualEstimate &&
        hasEstimate &&
        activeTab === 'assumptions-allowances' ? (
          <ConceptualAssumptionsExclusionsPanel
            controller={conceptualEstimate}
            disabled={saving}
          />
        ) : null}

        {showWorkspaceTabPanels &&
        !dataLoading &&
        isConceptualEstimate &&
        hasEstimate &&
        activeTab === 'scenarios' ? (
          <ConceptualScenariosPanel controller={conceptualEstimate} disabled={saving} />
        ) : null}

        {showWorkspaceTabPanels &&
        !dataLoading &&
        isConceptualEstimate &&
        hasEstimate &&
        activeTab === 'risks-contingency' ? (
          <ConceptualRisksContingencyPanel controller={conceptualEstimate} disabled={saving} />
        ) : null}

        {showWorkspaceTabPanels &&
        !dataLoading &&
        WORKFLOW_PLACEHOLDER_TAB_IDS.includes(activeTab) &&
        hasEstimate ? (
          (() => {
            const empty = getEstimateTypeEmptyState(resolvedEstimateType, activeTab);
            return <EstimateWorkspaceEmptyState title={empty.title} body={empty.body} />;
          })()
        ) : null}

        {/* ── Construction Activities tab (Milestones 4 + 5) ─────────────────── */}
        {showWorkspaceTabPanels && !dataLoading && activeTab === 'activities' ? (
          resolvedProjectId ? (
            <FeatureGate feature="activity_based_estimating">
              <ConstructionActivityBuilderPanel
                projectId={resolvedProjectId}
                estimateId={estimate?.id}
                hasEstimateTypeSelected={hasEstimate}
                onChooseEstimateType={() => setEstimateTypeModalOpen(true)}
                projectContext={projectScopeContext}
                acceptedDivisionCodes={acceptedDivisionCodes}
                selectedDivisions={currentEstimate?.selectedDivisions ?? EMPTY_SELECTED_DIVISIONS}
                importCollapseDivisionCodesKey={importCollapseDivisionCodesKey}
                onEnsureDivisionsSelected={handleEnsureDivisionsSelected}
                onActivitiesChanged={reloadConstructionActivities}
                reloadKey={activitiesPanelReloadKey}
              />
            </FeatureGate>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No project"
              body="Open a project to manage construction activities."
            />
          )
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === '3d-takeoff' ? (
          resolvedProjectId ? (
            <FeatureGate feature="model_3d_takeoff">
              <BimTakeoffPage
                projectId={resolvedProjectId}
                estimateId={estimate?.id ?? null}
                onTakeoffAdded={reloadConstructionActivities}
              />
            </FeatureGate>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No project"
              body="Open a project to use 3D Takeoff."
            />
          )
        ) : null}

        {showWorkspaceTabPanels && !dataLoading && activeTab === 'design-builder' ? (
          resolvedProjectId ? (
            <FeatureGate feature="design_builder">
              <DesignBuilderPage
                projectId={resolvedProjectId}
                estimateId={estimate?.id ?? null}
                onEstimateCommitted={reloadConstructionActivities}
              />
            </FeatureGate>
          ) : (
            <EstimateWorkspaceEmptyState
              title="No project"
              body="Open a project to use Design Builder."
            />
          )
        ) : null}

        </div>
      </div>
      <ChooseEstimateTypeModal
        open={estimateTypeModalOpen}
        currentType={resolvedEstimateType}
        onClose={() => setEstimateTypeModalOpen(false)}
        onSelect={handleEstimateTypeModalSelect}
        isEstimateTypeAllowed={isEstimateTypeAllowed}
      />
      <ChangeEstimateTypeConfirmModal
        open={estimateTypeChangeConfirmOpen}
        warning={pendingEstimateTypeWarning}
        onCancel={() => {
          setEstimateTypeChangeConfirmOpen(false);
          setPendingEstimateTypeChange(null);
        }}
        onConfirm={() => void handleConfirmEstimateTypeChange()}
        confirming={changingEstimateType}
      />
      <ConvertToDetailedEstimateModal
        open={convertToDetailedModalOpen}
        onClose={() => setConvertToDetailedModalOpen(false)}
      />
      <EstimateResetSetupConfirmModal
        isOpen={resetModalOpen}
        hasSavedWork={
          (estimateAdapter?.lineItems.length ?? 0) > 0 ||
          constructionActivities.length > 0 ||
          (currentEstimate?.selectedDivisions.length ?? 0) > 0
        }
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmResetSetup}
      />
      <ActivityExcelImportModal
        isOpen={importModalOpen && showImportExport}
        saving={saving}
        projectId={resolvedProjectId}
        estimateId={estimate?.id ?? ''}
        estimateType={
          resolvedEstimateType === 'bid' ? 'bid' : 'detailed'
        }
        onClose={() => setImportModalOpen(false)}
        onApply={handleApplyActivityExcelImport}
      />
      <EstimateImportModal
        isOpen={importModalOpen && !showImportExport}
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
    </EstimateWorkspaceSaveStatusProvider>
  );
}
