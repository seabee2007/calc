import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import Button from '../../components/ui/Button';
import { PLANNER_PAGE_BG } from '../../components/planner/plannerTheme';

export default function PlannerSchedulePage() {
  const { project } = usePlannerProject();

  return (
    <div className={`${PLANNER_PAGE_BG} flex flex-1 items-center justify-center p-6`}>
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Calendar className="mx-auto h-12 w-12 text-cyan-600 dark:text-cyan-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Schedule view</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          Timeline and pour-day scheduling will live here. Use Pour Planner for placement dates,
          weather, and delivery logistics.
        </p>
        {project?.pourDate && (
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-slate-200">
            Scheduled pour: {new Date(project.pourDate).toLocaleDateString()}
          </p>
        )}
        <Link to="/pour-planner" className="mt-6 inline-block">
          <Button icon={<ArrowRight className="h-4 w-4" />}>Open Pour Planner</Button>
        </Link>
      </div>
    </div>
  );
}
