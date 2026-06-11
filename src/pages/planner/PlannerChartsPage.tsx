import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import {
  PLANNER_BOARD_BG,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
} from '../../components/planner/plannerTheme';
import ProjectChartsDashboard from '../../features/planner/projectCharts/ProjectChartsDashboard';
import { useProjectChartsData } from '../../features/planner/projectCharts/useProjectChartsData';

export default function PlannerChartsPage() {
  const { projectId, project } = usePlannerProject();
  const { snapshot, loading, error } = useProjectChartsData(projectId, project);

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center py-16 ${PLANNER_BOARD_BG}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${PLANNER_BOARD_BG}`}>
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h2 className={PLANNER_SECTION_TITLE}>Project Charts</h2>
          <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
            Decision-focused charts for {project?.name ?? 'this project'}. Values come from saved
            estimate, schedule, QC, and change order data only.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <ProjectChartsDashboard projectId={projectId} snapshot={snapshot} />
      </div>
    </div>
  );
}
