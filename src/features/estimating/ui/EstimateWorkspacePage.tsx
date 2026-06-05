import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createDraftEstimate } from '../application/createDraftEstimate';
import { DEFAULT_ESTIMATE_METHOD, normalizeEstimateMethod } from '../domain/estimateMethods';
import type { EstimateType } from '../domain/estimateTypes';
import { saveEstimateVersionWithLineItems } from '../application/saveEstimateVersionWithLineItems';
import type {
  EstimateDomainVersion,
  EstimateSummary,
  EstimateVersionRow,
} from '../infrastructure/estimateDbTypes';
import {
  getEstimateVersionWithLineItems,
  listEstimateVersions,
  listEstimatesForProject,
} from '../infrastructure/estimateRepository';
import { buildEstimateVersionHistoryItems } from './estimateVersionDisplay';
import EstimateVersionHistoryList from './components/EstimateVersionHistoryList';
import { buildWorkspaceSummaryValues } from './estimateFormatters';
import EstimateWorkspaceHeader from './components/EstimateWorkspaceHeader';
import EstimateWorkspaceTabBar, {
  type EstimateWorkspaceTabId,
} from './components/EstimateWorkspaceTabBar';
import EstimateWorkspaceLoading from './components/EstimateWorkspaceLoading';
import EstimateWorkspaceEmptyState from './components/EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './components/EstimateSummaryCard';
import EstimateLineItemsBuilderPanel from './components/EstimateLineItemsBuilderPanel';
import EstimateNextAvailableActions from './components/EstimateNextAvailableActions';
import EstimateTotalsReviewPanel from './components/EstimateTotalsReviewPanel';
import EstimateSchedulePreviewPanel from './components/EstimateSchedulePreviewPanel';
import EstimateGanttPreview from './components/EstimateGanttPreview';
import EstimateMethodSelector from './components/EstimateMethodSelector';
import type { EstimateSchedulePlanControlValues } from './components/EstimateSchedulePlanControls';
import {
  ROUGH_SCHEDULE_PREVIEW_NOTE,
  shouldShowRoughSchedulePreviewNote,
} from './estimateMethodDisplay';
import { extractScheduleDatePlanSummary } from './estimateScheduleDisplay';
import { useEstimateLineItemDraft } from './hooks/useEstimateLineItemDraft';
import { useEstimateSetupSession } from './hooks/useEstimateSetupSession';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from './estimateWorkspaceTheme';

const SUMMARY_CARD_KEYS = [
  { key: 'totalEstimate', label: 'Total Estimate' },
  { key: 'laborHours', label: 'Labor Hours' },
  { key: 'manDays', label: 'Man-Days' },
  { key: 'crewDays', label: 'Crew-Days' },
  { key: 'materialCost', label: 'Material Cost' },
  { key: 'equipmentCost', label: 'Equipment Cost' },
  { key: 'profit', label: 'Profit' },
] as const;

const NO_VERSION_MESSAGE = 'This estimate does not have a saved version yet.';

function getTodayScheduleDateYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface SummaryCardsGridProps {
  version: EstimateDomainVersion | null;
  loading?: boolean;
}

function SummaryCardsGrid({ version, loading = false }: SummaryCardsGridProps) {
  const values = useMemo(() => buildWorkspaceSummaryValues(version), [version]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {SUMMARY_CARD_KEYS.map((card) => (
        <EstimateSummaryCard
          key={card.key}
          label={card.label}
          value={values[card.key]}
          loading={loading}
        />
      ))}
    </div>
  );
}

function selectEstimate(estimates: EstimateSummary[]): EstimateSummary | null {
  if (estimates.length === 0) return null;
  return estimates.find((row) => row.currentVersionId) ?? estimates[0];
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState('Estimate created');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState<EstimateSummary | null>(null);
  const [version, setVersion] = useState<EstimateDomainVersion | null>(null);
  const [versionHistory, setVersionHistory] = useState<EstimateVersionRow[]>([]);
  const [selectedEstimateMethod, setSelectedEstimateMethod] = useState<EstimateType>(
    DEFAULT_ESTIMATE_METHOD,
  );
  const lineItemDraft = useEstimateLineItemDraft(version);
  const [schedulePlanControls, setSchedulePlanControls] = useState<EstimateSchedulePlanControlValues>(
    () => ({
      projectStartDate: getTodayScheduleDateYmd(),
      dependencyMode: 'sequential_by_project' satisfies EstimateScheduleDependencyMode,
      includeWeekends: false,
    }),
  );

  const schedulePlan = useMemo(() => {
    if (!version || !estimate) return null;
    return buildEstimateSchedulePlan({
      version,
      estimateId: estimate.id,
      projectId: estimate.projectId,
    });
  }, [version, estimate]);

  const scheduleDatePlanResult = useMemo(() => {
    if (!schedulePlan) return null;
    return planEstimateScheduleDates(schedulePlan, {
      projectStartDate: schedulePlanControls.projectStartDate,
      dependencyMode: schedulePlanControls.dependencyMode,
      includeWeekends: schedulePlanControls.includeWeekends,
    });
  }, [schedulePlan, schedulePlanControls]);

  const workspaceSummaryValues = useMemo(
    () => buildWorkspaceSummaryValues(version),
    [version],
  );

  const scheduleDatePlanSummary = useMemo(
    () => extractScheduleDatePlanSummary(scheduleDatePlanResult, schedulePlan),
    [scheduleDatePlanResult, schedulePlan],
  );

  const plannedDurationDisplay =
    scheduleDatePlanSummary.totalPlannedDurationDaysDisplay !== '—'
      ? scheduleDatePlanSummary.totalPlannedDurationDaysDisplay
      : null;

  const handleSchedulePlanControlsChange = useCallback(
    (patch: Partial<EstimateSchedulePlanControlValues>) => {
      setSchedulePlanControls((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const versionHistoryItems = useMemo(
    () => buildEstimateVersionHistoryItems(versionHistory, estimate?.currentVersionId),
    [versionHistory, estimate?.currentVersionId],
  );

  const resolvedProjectId = projectId ?? routeProjectId ?? '';
  const estimateSetup = useEstimateSetupSession(
    resolvedProjectId,
    version?.id,
    version?.estimateType,
  );

  useEffect(() => {
    if (estimateTab && parsedTab == null && resolvedProjectId) {
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

  const loadEstimateData = useCallback(async (silent = false) => {
    if (!resolvedProjectId) {
      setDataLoading(false);
      return;
    }

    if (!silent) {
      setDataLoading(true);
      setEstimate(null);
      setVersion(null);
      setVersionHistory([]);
    }
    setLoadError(null);

    const listResult = await listEstimatesForProject(resolvedProjectId);
    if (listResult.error) {
      setLoadError(listResult.error);
      setDataLoading(false);
      return;
    }

    const estimates = listResult.data ?? [];
    const selected = selectEstimate(estimates);
    if (!selected) {
      setDataLoading(false);
      return;
    }

    setEstimate(selected);

    const versionsResult = await listEstimateVersions(selected.id);
    if (versionsResult.error) {
      setLoadError(versionsResult.error);
      setDataLoading(false);
      return;
    }
    setVersionHistory(versionsResult.data ?? []);

    if (!selected.currentVersionId) {
      setDataLoading(false);
      return;
    }

    const versionResult = await getEstimateVersionWithLineItems(selected.currentVersionId);
    if (versionResult.error) {
      setLoadError(versionResult.error);
      setDataLoading(false);
      return;
    }

    const loadedVersion = versionResult.data;
    setVersion(loadedVersion);
    if (loadedVersion?.estimateType) {
      setSelectedEstimateMethod(normalizeEstimateMethod(loadedVersion.estimateType));
    }
    setDataLoading(false);
  }, [resolvedProjectId]);

  useEffect(() => {
    if (plannerLoading || accessDenied || !resolvedProjectId) return;
    void loadEstimateData();
  }, [plannerLoading, accessDenied, resolvedProjectId, loadEstimateData]);

  const handleCreateEstimate = useCallback(async () => {
    if (!resolvedProjectId || creating || estimate != null) return;

    setCreating(true);
    setCreateError(null);
    setSaveError(null);
    setSuccessMessage(null);
    setSuccessTitle('Estimate created');

    const result = await createDraftEstimate({
      projectId: resolvedProjectId,
      createdBy: user?.id ?? null,
      estimateType: selectedEstimateMethod,
    });

    if (result.error) {
      setCreateError(result.error);
      setCreating(false);
      return;
    }

    setSuccessMessage('Draft estimate and initial version created successfully.');
    await loadEstimateData(true);
    setCreating(false);
  }, [resolvedProjectId, creating, estimate, user?.id, loadEstimateData, selectedEstimateMethod]);

  const canSave =
    estimate != null &&
    version != null &&
    lineItemDraft.dirty &&
    lineItemDraft.draftLines.length > 0 &&
    !saving;

  const handleSaveEstimate = useCallback(async () => {
    if (!estimate || !version || !canSave || saving) return;

    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    const result = await saveEstimateVersionWithLineItems({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      currentVersion: {
        estimateType: version.estimateType,
        status: version.status,
        snapshot: version.snapshot,
      },
      draftLines: lineItemDraft.draftLines,
      createdBy: user?.id ?? null,
    });

    if (result.error || !result.data) {
      setSaveError(result.error ?? 'Failed to save estimate version.');
      setSaving(false);
      return;
    }

    setSuccessTitle('Estimate saved');
    setSuccessMessage(
      `Saved version ${result.data.versionNumber} with ${result.data.lineItemCount} activit${result.data.lineItemCount === 1 ? 'y' : 'ies'}.`,
    );

    const listResult = await listEstimatesForProject(resolvedProjectId);
    if (!listResult.error && listResult.data) {
      const selected = selectEstimate(listResult.data);
      if (selected) {
        setEstimate(selected);
        const versionsResult = await listEstimateVersions(selected.id);
        if (!versionsResult.error && versionsResult.data) {
          setVersionHistory(versionsResult.data);
        }
        if (selected.currentVersionId) {
          const versionResult = await getEstimateVersionWithLineItems(selected.currentVersionId);
          if (!versionResult.error && versionResult.data) {
            setVersion(versionResult.data);
            lineItemDraft.rehydrateFromVersion(versionResult.data);
          }
        }
      }
    }

    setSaving(false);
  }, [
    estimate,
    version,
    canSave,
    saving,
    lineItemDraft,
    user?.id,
    resolvedProjectId,
  ]);

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
  const hasVersion = version != null;

  return (
    <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <EstimateWorkspaceTabBar activeTabId={activeTab} onTabChange={handleTabChange} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {successMessage ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="success"
              title={successTitle}
              body={successMessage}
            />
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not load estimate data"
              body={loadError}
            />
          </div>
        ) : null}

        {createError ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not create estimate"
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

        {dataLoading ? (
          <EstimateWorkspaceLoading />
        ) : null}

        {!dataLoading && !hasEstimate && !loadError ? (
          <div className="space-y-4">
            <EstimateWorkspaceHeader
              hasEstimate={false}
              creating={creating}
              dataLoading={dataLoading}
              onCreateEstimate={handleCreateEstimate}
            />
            <EstimateMethodSelector
              value={selectedEstimateMethod}
              onChange={setSelectedEstimateMethod}
              disabled={creating}
            />
            <EstimateWorkspaceEmptyState
              body="Create the draft estimate record, then open the Estimate tab to choose your estimate type and start building scope."
            />
          </div>
        ) : null}

        {!dataLoading && hasEstimate ? (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <EstimateWorkspaceHeader
                  estimate={estimate}
                  version={version}
                  totalPriceDisplay={workspaceSummaryValues.totalEstimate}
                  laborHoursDisplay={workspaceSummaryValues.laborHours}
                  plannedDurationDisplay={plannedDurationDisplay}
                  hasEstimate={hasEstimate}
                  draftDirty={lineItemDraft.dirty}
                />
                <EstimateNextAvailableActions onNavigate={handleTabChange} />
                {!hasVersion ? (
                  <EstimateWorkspaceEmptyState
                    title={NO_VERSION_MESSAGE}
                    body="When a version is saved, summary totals will appear here."
                  />
                ) : (
                  <div>
                    <h2 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>Summary</h2>
                    <SummaryCardsGrid version={version} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'line-items' && (
              <div className="space-y-4">
                {hasVersion && estimate ? (
                  <EstimateLineItemsBuilderPanel
                    estimate={estimate}
                    version={version}
                    canEdit={hasEstimate && hasVersion}
                    canSave={canSave}
                    saving={saving}
                    draft={lineItemDraft}
                    setup={estimateSetup}
                    projectLocationLabel={project?.locationLabel}
                    onSave={handleSaveEstimate}
                  />
                ) : (
                  <>
                    <h2 className={PLANNER_SECTION_TITLE}>Estimate</h2>
                    <EstimateWorkspaceEmptyState
                      title={NO_VERSION_MESSAGE}
                      body="Work breakdown divisions and activities are stored on estimate versions and will display here once a version exists."
                    />
                  </>
                )}
              </div>
            )}

            {activeTab === 'schedule-preview' && estimate ? (
              <div className="space-y-4">
                {version && shouldShowRoughSchedulePreviewNote(version.estimateType) ? (
                  <div className={`${PLANNER_FORM_PANEL} text-sm ${TEXT_BODY}`}>
                    <p className={PLANNER_MUTED}>{ROUGH_SCHEDULE_PREVIEW_NOTE}</p>
                  </div>
                ) : null}
                <EstimateSchedulePreviewPanel
                  version={hasVersion ? version : null}
                  plan={schedulePlan}
                  datePlanResult={scheduleDatePlanResult}
                  planControls={schedulePlanControls}
                  onPlanControlsChange={handleSchedulePlanControlsChange}
                  loading={dataLoading}
                />
              </div>
            ) : null}

            {activeTab === 'gantt-preview' && estimate ? (
              <EstimateGanttPreview
                datePlanResult={scheduleDatePlanResult}
                loading={dataLoading}
              />
            ) : null}

            {activeTab === 'versions' && (
              <EstimateVersionHistoryList
                items={versionHistoryItems}
                loading={dataLoading}
                currentVersion={
                  version
                    ? {
                        versionName: version.versionName,
                        versionNumber: version.versionNumber,
                        lineItemCount: version.lineItems.length,
                        totalSellPrice: workspaceSummaryValues.totalEstimate,
                      }
                    : null
                }
              />
            )}

            {activeTab === 'totals' && (
              <EstimateTotalsReviewPanel version={hasVersion ? version : null} loading={dataLoading} />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
