import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, FileOutput, Layers, ListPlus, Plus } from 'lucide-react';
import { usePlannerProject } from '../../../contexts/PlannerProjectContext';
import Button from '../../../components/ui/Button';
import type { EstimateDomainVersion, EstimateSummary } from '../infrastructure/estimateDbTypes';
import {
  getEstimateVersionWithLineItems,
  listEstimatesForProject,
} from '../infrastructure/estimateRepository';
import { buildWorkspaceSummaryValues } from './estimateFormatters';
import EstimateWorkspaceHeader from './components/EstimateWorkspaceHeader';
import EstimateWorkspaceTabBar, {
  type EstimateWorkspaceTabId,
} from './components/EstimateWorkspaceTabBar';
import EstimateWorkspaceLoading from './components/EstimateWorkspaceLoading';
import EstimateWorkspaceEmptyState from './components/EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './components/EstimateSummaryCard';
import EstimateReadOnlyLineItemsTable from './components/EstimateReadOnlyLineItemsTable';
import EstimateVersionSummary from './components/EstimateVersionSummary';
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

const COMING_SOON_ACTIONS = [
  { label: 'Add scope', icon: Layers },
  { label: 'Add line item', icon: ListPlus },
  { label: 'Generate schedule', icon: Calendar },
  { label: 'Export proposal', icon: FileOutput },
] as const;

const NO_VERSION_MESSAGE = 'This estimate does not have a saved version yet.';

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

function ComingSoonActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {COMING_SOON_ACTIONS.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          icon={<Icon className="h-4 w-4" />}
          disabled
          title="Coming in a future phase"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function ScheduleNote() {
  return (
    <div className={`${PLANNER_FORM_PANEL} text-sm ${TEXT_BODY}`}>
      <p className={PLANNER_SECTION_TITLE}>Schedule &amp; Gantt</p>
      <p className={`mt-2 ${PLANNER_MUTED}`}>
        Estimate-driven scheduling and Gantt generation will be added after estimate creation and
        versioning are working.
      </p>
    </div>
  );
}

function selectEstimate(estimates: EstimateSummary[]): EstimateSummary | null {
  if (estimates.length === 0) return null;
  return estimates.find((row) => row.currentVersionId) ?? estimates[0];
}

export default function EstimateWorkspacePage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, project, loading: plannerLoading, accessDenied } = usePlannerProject();
  const [activeTab, setActiveTab] = useState<EstimateWorkspaceTabId>('overview');
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateSummary | null>(null);
  const [version, setVersion] = useState<EstimateDomainVersion | null>(null);

  const resolvedProjectId = projectId ?? routeProjectId ?? '';

  const loadEstimateData = useCallback(async () => {
    if (!resolvedProjectId) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setLoadError(null);
    setEstimate(null);
    setVersion(null);

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

    setVersion(versionResult.data);
    setDataLoading(false);
  }, [resolvedProjectId]);

  useEffect(() => {
    if (plannerLoading || accessDenied || !resolvedProjectId) return;
    void loadEstimateData();
  }, [plannerLoading, accessDenied, resolvedProjectId, loadEstimateData]);

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
      <EstimateWorkspaceTabBar activeTabId={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <EstimateWorkspaceHeader
          projectId={resolvedProjectId}
          projectName={project?.name}
          estimateName={estimate?.name}
          estimateStatus={estimate?.status}
        />

        {loadError ? (
          <div className="mb-4">
            <EstimateWorkspaceEmptyState
              variant="error"
              title="Could not load estimate data"
              body={loadError}
            />
          </div>
        ) : null}

        <div className="mb-4">
          <ComingSoonActions />
        </div>

        {dataLoading ? (
          <EstimateWorkspaceLoading />
        ) : null}

        {!dataLoading && !hasEstimate && !loadError ? (
          <EstimateWorkspaceEmptyState />
        ) : null}

        {!dataLoading && hasEstimate ? (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <EstimateVersionSummary estimate={estimate} version={version} />
                {!hasVersion ? (
                  <EstimateWorkspaceEmptyState
                    title={NO_VERSION_MESSAGE}
                    body="When a version is saved, summary totals and line items will appear here."
                  />
                ) : null}
                <div>
                  <h2 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>Summary</h2>
                  <SummaryCardsGrid version={version} />
                </div>
                <ScheduleNote />
              </div>
            )}

            {activeTab === 'line-items' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={PLANNER_SECTION_TITLE}>Line items</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    disabled
                    title="Coming in a future phase"
                  >
                    Add line item
                  </Button>
                </div>
                {hasVersion ? (
                  <EstimateReadOnlyLineItemsTable lineItems={version.lineItems} />
                ) : (
                  <EstimateWorkspaceEmptyState
                    title={NO_VERSION_MESSAGE}
                    body="Line items are stored on estimate versions and will display here once a version exists."
                  />
                )}
              </div>
            )}

            {activeTab === 'versions' && (
              <div className="space-y-4">
                <EstimateVersionSummary estimate={estimate} version={version} />
                {!hasVersion ? (
                  <EstimateWorkspaceEmptyState
                    title="No estimate versions yet"
                    body="Version snapshots will be listed here once estimate save workflows are connected."
                  />
                ) : null}
              </div>
            )}

            {activeTab === 'totals' && (
              <div className="space-y-4">
                <h2 className={PLANNER_SECTION_TITLE}>Cost totals</h2>
                {hasVersion ? (
                  <>
                    <SummaryCardsGrid version={version} />
                    <p className={`text-sm ${PLANNER_MUTED}`}>
                      Totals are read from the current estimate version snapshot.
                    </p>
                  </>
                ) : (
                  <EstimateWorkspaceEmptyState
                    title={NO_VERSION_MESSAGE}
                    body="Cost totals require a saved estimate version."
                  />
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
