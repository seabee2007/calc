import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, FileOutput, Layers, ListPlus, Plus } from 'lucide-react';
import { usePlannerProject } from '../../../contexts/PlannerProjectContext';
import Button from '../../../components/ui/Button';
import EstimateWorkspaceHeader from './components/EstimateWorkspaceHeader';
import EstimateWorkspaceTabBar, {
  type EstimateWorkspaceTabId,
} from './components/EstimateWorkspaceTabBar';
import EstimateWorkspaceLoading from './components/EstimateWorkspaceLoading';
import EstimateWorkspaceEmptyState from './components/EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './components/EstimateSummaryCard';
import EstimateLineItemsPlaceholder from './components/EstimateLineItemsPlaceholder';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from './estimateWorkspaceTheme';

const SUMMARY_CARDS = [
  { label: 'Total Estimate' },
  { label: 'Labor Hours' },
  { label: 'Man-Days' },
  { label: 'Crew-Days' },
  { label: 'Material Cost' },
  { label: 'Equipment Cost' },
  { label: 'Profit' },
] as const;

const COMING_SOON_ACTIONS = [
  { label: 'Add scope', icon: Layers },
  { label: 'Add line item', icon: ListPlus },
  { label: 'Generate schedule', icon: Calendar },
  { label: 'Export proposal', icon: FileOutput },
] as const;

function SummaryCardsGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {SUMMARY_CARDS.map((card) => (
        <EstimateSummaryCard key={card.label} label={card.label} />
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

export default function EstimateWorkspacePage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { projectId, project, loading, accessDenied } = usePlannerProject();
  const [activeTab, setActiveTab] = useState<EstimateWorkspaceTabId>('overview');

  const resolvedProjectId = projectId ?? routeProjectId ?? '';

  if (loading) {
    return (
      <div className={PLANNER_PAGE_BG}>
        <EstimateWorkspaceLoading />
      </div>
    );
  }

  if (accessDenied || !resolvedProjectId) {
    return null;
  }

  return (
    <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <EstimateWorkspaceTabBar activeTabId={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <EstimateWorkspaceHeader
          projectId={resolvedProjectId}
          projectName={project?.name}
        />

        <div className="mb-4">
          <ComingSoonActions />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <EstimateWorkspaceEmptyState />
            <div>
              <h2 className={`mb-3 ${PLANNER_SECTION_TITLE}`}>Summary preview</h2>
              <SummaryCardsGrid />
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
            <EstimateLineItemsPlaceholder />
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-4">
            <EstimateWorkspaceEmptyState
              title="No estimate versions yet"
              body="Version snapshots will be listed here once estimate creation and save workflows are connected."
            />
          </div>
        )}

        {activeTab === 'totals' && (
          <div className="space-y-4">
            <h2 className={PLANNER_SECTION_TITLE}>Cost totals</h2>
            <SummaryCardsGrid />
            <p className={`text-sm ${PLANNER_MUTED}`}>
              Totals will be calculated from line items and pricing inputs when the estimate engine
              is connected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
