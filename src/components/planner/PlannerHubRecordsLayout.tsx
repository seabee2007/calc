import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PLANNER_BOARD_BG, PLANNER_LINK } from './plannerTheme';
import PlannerRecordsQuickNav from './PlannerRecordsQuickNav';

export default function PlannerHubRecordsLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${PLANNER_BOARD_BG}`}>
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <Link
          to="/planner/hub"
          className={`inline-flex items-center gap-1 ${PLANNER_LINK}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Planner Hub
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          {subtitle ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">{subtitle}</p>
          ) : (
            <span className="hidden lg:block lg:flex-1" aria-hidden />
          )}
          <PlannerRecordsQuickNav />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
