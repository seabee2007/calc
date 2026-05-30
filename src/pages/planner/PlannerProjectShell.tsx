import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PlannerProjectProvider } from '../../contexts/PlannerProjectContext';
import PlannerPlanHeader from '../../components/planner/PlannerPlanHeader';
import PlannerBoardToolbar from '../../components/planner/PlannerBoardToolbar';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';

function PlannerShellContent() {
  const { loading, accessDenied } = usePlannerProject();
  const location = useLocation();
  const isBoard = location.pathname.includes('/planner/board');

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-cyan-400" />
      </div>
    );
  }

  if (accessDenied) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlannerPlanHeader />
      {isBoard && <PlannerBoardToolbar />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

export default function PlannerProjectShell() {
  return (
    <PlannerProjectProvider>
      <PlannerShellContent />
    </PlannerProjectProvider>
  );
}
