/** Guided contractor workflow: project → calc → proposal → mix → placement → dashboard */

export const WORKFLOW_STEPS = [
  { id: 'project', label: 'Project Info', path: '/projects' },
  { id: 'calculator', label: 'Calculator', path: '/calculator' },
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
  showProjectDetails?: boolean;
}

export function isWorkflowActive(
  search: string,
  state?: WorkflowLocationState | null,
): boolean {
  if (state?.workflow) return true;
  const params = new URLSearchParams(search);
  return params.get('flow') === '1';
}

export function getWorkflowProjectId(
  search: string,
  state?: WorkflowLocationState | null,
): string | undefined {
  if (state?.projectId) return state.projectId;
  const params = new URLSearchParams(search);
  return params.get('project') ?? undefined;
}

export function workflowQuery(projectId?: string): string {
  const params = new URLSearchParams({ flow: '1' });
  if (projectId) params.set('project', projectId);
  return `?${params.toString()}`;
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
>(project: { calculations?: T[] } | undefined, state?: WorkflowLocationState | null): T | undefined {
  const calcs = project?.calculations;
  if (!calcs?.length) return undefined;

  const fromState = state?.calculationId
    ? calcs.find((c) => c.id === state.calculationId)
    : undefined;
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
  if (pathname.startsWith('/proposal')) return 'proposal';
  if (pathname.startsWith('/mix-design-advisor')) return 'mix';
  if (pathname.startsWith('/pour-planner')) return 'placement';
  return 'dashboard';
}

export function stepIndex(stepId: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === stepId);
}
