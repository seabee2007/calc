/** Guided contractor workflow: project → calc → proposal → mix → placement → dashboard */

import type { NavigateFunction } from 'react-router-dom';

export const WORKFLOW_STEPS = [
  { id: 'project', label: 'Project Info', path: '/projects' },
  { id: 'calculator', label: 'Estimates', path: '/calculator' },
  { id: 'proposal', label: 'Proposal', path: '/proposal-generator' },
  { id: 'mix', label: 'Mix Design', path: '/mix-design-advisor' },
  { id: 'placement', label: 'Placement', path: '/pour-planner' },
  { id: 'dashboard', label: 'Dashboard', path: '/' },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]['id'];

export interface WorkflowLocationState {
  workflow?: boolean;
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  /** Latest saved calculation id for proposal import */
  calculationId?: string;
  /** Tools / Projects nav: show library list, not guided workflow create step */
  mode?: 'browse' | 'workflow';
  openCreate?: boolean;
  /** Tools → Projects: force project library list (not create form) */
  view?: 'list' | 'create';
  showProjectDetails?: boolean;
}

export function isWorkflowActive(
  search: string,
  state?: WorkflowLocationState | null,
): boolean {
  if (state?.workflow) return true;
  const params = new URLSearchParams(search);
  const flag = params.get('flow') ?? params.get('workflow');
  return flag === '1' || flag === 'true';
}

/** Project id from workflow URL (`?project=`) even when not in guided flow. */
export function getProjectIdFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search);
  return params.get('project') ?? undefined;
}

export function getWorkflowProjectId(
  search: string,
  state?: WorkflowLocationState | null,
): string | undefined {
  if (state?.projectId) return state.projectId;
  return getProjectIdFromSearch(search);
}

/** Open the modular Projects page with this project's detail panel. */
export function navigateToProjectDetail(
  navigate: NavigateFunction,
  projectId: string,
): void {
  navigate('/projects', {
    state: {
      showProjectDetails: true,
      projectId,
    },
  });
}

export function workflowQuery(projectId?: string, calculationId?: string): string {
  const params = new URLSearchParams({ flow: '1' });
  if (projectId) params.set('project', projectId);
  if (calculationId) params.set('calc', calculationId);
  return `?${params.toString()}`;
}

export function getWorkflowCalculationId(
  search: string,
  state?: WorkflowLocationState | null,
): string | undefined {
  if (state?.calculationId) return state.calculationId;
  const params = new URLSearchParams(search);
  return params.get('calc') ?? undefined;
}

export function workflowNavigateState(
  projectId?: string,
  extra?: Omit<WorkflowLocationState, 'workflow' | 'projectId'>,
): WorkflowLocationState {
  return { workflow: true, ...(projectId ? { projectId } : {}), ...extra };
}

/** Prefer navigation state calc id, else latest calculation with volume. */
export function getWorkflowCalculation<
  T extends { id: string; createdAt: string; result?: { volume?: number } },
>(
  project: { calculations?: T[] } | undefined,
  state?: WorkflowLocationState | null,
  search?: string,
): T | undefined {
  const calcs = project?.calculations;
  if (!calcs?.length) return undefined;

  const calcId = getWorkflowCalculationId(search ?? '', state);
  const fromState = calcId ? calcs.find((c) => c.id === calcId) : undefined;
  if (fromState) return fromState;

  const withVolume = [...calcs]
    .filter((c) => (c.result?.volume ?? 0) > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (withVolume[0]) return withVolume[0];

  return calcs[calcs.length - 1];
}

export function getWorkflowStepFromPath(pathname: string): WorkflowStepId {
  if (pathname === '/' || pathname === '/dispatch' || pathname === '/qc') {
    return 'dashboard';
  }
  if (pathname.startsWith('/projects')) return 'project';
  if (pathname.startsWith('/calculator')) return 'calculator';
  // sub-routes (concrete, reinforcement, labor) still count as calculator step
  if (pathname.startsWith('/proposal')) return 'proposal';
  if (pathname.startsWith('/mix-design-advisor')) return 'mix';
  if (pathname.startsWith('/pour-planner')) return 'placement';
  return 'dashboard';
}

export function stepIndex(stepId: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === stepId);
}
