/** Guided contractor workflow: project → estimates → proposal (concrete tools optional via Tools modal) */

import type { NavigateFunction } from 'react-router-dom';
import type { Project } from '../types';
import type { PlacementOrderStatus } from '../types/placementOrder';

export const WORKFLOW_STEPS = [
  { id: 'project', label: 'Project Info', path: '/projects' },
  { id: 'calculator', label: 'Estimates', path: '/calculator' },
  { id: 'proposal', label: 'Proposal', path: '/proposal-generator' },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]['id'];

export const WORKFLOW_CONCRETE_TOOLS = [
  { id: 'mix', label: 'Mix Design', path: '/mix-design-advisor' },
  { id: 'placement', label: 'Placement Planner', path: '/pour-planner' },
] as const;

export type WorkflowConcreteToolId = (typeof WORKFLOW_CONCRETE_TOOLS)[number]['id'];

const CORE_STEP_COUNT = WORKFLOW_STEPS.length;

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

/** Workflow URL for optional concrete tools (mix / placement). */
export function workflowConcreteToolQuery(
  projectId: string,
  calculationId?: string,
): string {
  return workflowQuery(projectId, calculationId);
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

function projectVolumeYd(project: Project): number {
  return (project.calculations ?? []).reduce(
    (sum, c) => sum + (c.result?.volume > 0 ? c.result.volume : 0),
    0,
  );
}

/** True when the job likely involves ready-mix / placement work. */
export function projectHasConcreteWork(project: Project | undefined | null): boolean {
  if (!project) return false;
  if (projectVolumeYd(project) > 0) return true;
  if (project.pourDate) return true;
  const status = project.placementOrder?.status as PlacementOrderStatus | undefined;
  if (status && status !== 'draft') return true;
  return false;
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

export function isConcreteToolPath(pathname: string): boolean {
  return (
    pathname.startsWith('/mix-design-advisor') || pathname.startsWith('/pour-planner')
  );
}

/** Core workflow step for progress UI (optional concrete tool routes map to proposal). */
export function getWorkflowStepFromPath(pathname: string): WorkflowStepId {
  if (pathname.startsWith('/projects')) return 'project';
  if (pathname.startsWith('/calculator')) return 'calculator';
  if (pathname.startsWith('/proposal')) return 'proposal';
  if (isConcreteToolPath(pathname)) return 'proposal';
  return 'proposal';
}

export function stepIndex(stepId: WorkflowStepId): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === stepId);
}

/** Remap legacy 6-step session progress to 3-step indices. */
export function remapLegacyMaxStepIndex(legacyIndex: number): number {
  if (legacyIndex <= 0) return 0;
  if (legacyIndex <= 2) return legacyIndex;
  return CORE_STEP_COUNT - 1;
}

export const WORKFLOW_PROGRESS_STORAGE_KEY = 'workflow_max_step_v2';
