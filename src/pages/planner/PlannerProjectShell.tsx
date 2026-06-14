import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PlannerProjectProvider } from '../../contexts/PlannerProjectContext';
import PlannerPlanHeader from '../../components/planner/PlannerPlanHeader';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { EstimateWorkspaceHeaderCollapseProvider } from '../../features/estimating/ui/EstimateWorkspaceHeaderCollapseContext';
import EstimateWorkspaceCollapsibleHeader from '../../features/estimating/ui/components/EstimateWorkspaceCollapsibleHeader';

function isEstimateWorkspaceRoute(pathname: string): boolean {
  return /\/planner\/estimate(?:\/|$)/.test(pathname);
}

function PlannerShellContent() {
  const { loading, accessDenied } = usePlannerProject();
  const location = useLocation();
  const isEstimateWorkspace = isEstimateWorkspaceRoute(location.pathname);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-cyan-400" />
      </div>
    );
  }

  if (accessDenied) return null;

  return (
    <EstimateWorkspaceHeaderCollapseProvider enabled={isEstimateWorkspace}>
      <div className="flex min-h-0 flex-1 flex-col">
        <EstimateWorkspaceCollapsibleHeader plannerHeader={<PlannerPlanHeader />} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </EstimateWorkspaceHeaderCollapseProvider>
  );
}

export default function PlannerProjectShell() {
  return (
    <PlannerProjectProvider>
      <PlannerShellContent />
    </PlannerProjectProvider>
  );
}
