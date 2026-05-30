import React from 'react';
import { BarChart3 } from 'lucide-react';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { PLANNER_PAGE_BG, PLANNER_MUTED } from '../../components/planner/plannerTheme';

export default function PlannerChartsPage() {
  const { project } = usePlannerProject();

  return (
    <div className={PLANNER_PAGE_BG}>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <BarChart3 className="mx-auto h-12 w-12 text-cyan-600 dark:text-cyan-400" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Charts</h2>
          <p className={`mt-2 ${PLANNER_MUTED}`}>
            Status and progress charts for {project?.name ?? 'this project'} are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
