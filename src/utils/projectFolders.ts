import type { Project } from '../types';
import type { QCRecord } from '../types';
import type { ProposalStatus } from '../types/proposalTracking';
import {
  isProjectClosedOut,
  resolveProjectWorkflow,
  type ProjectWorkflowStage,
} from './projectWorkflow';

export type ProjectFolder = 'active' | 'qc_closeout' | 'archived';

const PLACED_STAGES: ProjectWorkflowStage[] = [
  'placed',
  'job_completed',
  'paid',
  'closed',
];

const OPERATIONALLY_COMPLETE_STAGES: ProjectWorkflowStage[] = [
  'job_completed',
  'paid',
  'closed',
];

export interface QcBreakStatus {
  sevenDayComplete: boolean;
  fourteenDayComplete: boolean;
  twentyEightDayComplete: boolean;
  qcComplete: boolean;
  progressPercent: number;
  nextDueLabel: string;
  nextDueDate: Date | null;
  isOverdue: boolean;
  daysUntilOrOverdueLabel: string;
  placedDateLabel: string;
}

export interface ProjectFolderContext {
  hasProposalDraft?: boolean;
  proposalStatus?: ProposalStatus;
}

function parseIsoMaybe(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveStage(
  project: Project,
  ctx?: ProjectFolderContext,
): ProjectWorkflowStage {
  return resolveProjectWorkflow(project, {
    hasProposalDraft: ctx?.hasProposalDraft ?? false,
    proposalStatus: ctx?.proposalStatus,
    readinessScore: 0,
    windRisk: 'unknown',
    heatRisk: 'unknown',
  }).stage;
}

export function hasConcretePlaced(
  project: Project,
  stage?: ProjectWorkflowStage,
  ctx?: ProjectFolderContext,
): boolean {
  const s = stage ?? resolveStage(project, ctx);
  if (PLACED_STAGES.includes(s)) return true;
  if (isProjectClosedOut(project)) return true;

  const ext = project as Record<string, unknown>;
  if (
    ext.concretePlacedDate ||
    ext.placedDate ||
    ext.actualPlacementDate
  ) {
    return true;
  }

  return false;
}

export function isOperationallyComplete(
  project: Project,
  stage?: ProjectWorkflowStage,
  ctx?: ProjectFolderContext,
): boolean {
  const s = stage ?? resolveStage(project, ctx);
  return OPERATIONALLY_COMPLETE_STAGES.includes(s);
}

export function getPlacedDate(
  project: Project,
  stage?: ProjectWorkflowStage,
  ctx?: ProjectFolderContext,
): Date | null {
  const ext = project as Record<string, unknown>;
  for (const key of ['concretePlacedDate', 'placedDate', 'actualPlacementDate']) {
    const d = parseIsoMaybe(ext[key] as string | undefined);
    if (d) return d;
  }

  const s = stage ?? resolveStage(project, ctx);
  if (PLACED_STAGES.includes(s) || isProjectClosedOut(project)) {
    return parseIsoMaybe(project.pourDate);
  }

  return null;
}

function recordMatchesBreakAge(record: QCRecord, age: 7 | 14 | 28): boolean {
  const r = record as Record<string, unknown>;
  if (r.testAgeDays === age || r.ageDays === age) return true;

  const hay = `${r.type ?? ''} ${r.status ?? ''} ${record.notes ?? ''}`.toLowerCase();
  if (!hay.trim()) return false;
  if (hay.includes('break') && hay.includes(String(age))) return true;
  if (hay.includes(`${age}-day`) || hay.includes(`${age} day`)) return true;
  return false;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDaysUntilOrOverdue(due: Date, now = new Date()): {
  label: string;
  isOverdue: boolean;
} {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(due);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / 86400000);

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      label: `${overdue} day${overdue === 1 ? '' : 's'} overdue`,
      isOverdue: true,
    };
  }
  if (days === 0) return { label: 'Due today', isOverdue: false };
  return {
    label: `${days} day${days === 1 ? '' : 's'} left`,
    isOverdue: false,
  };
}

export function getQcBreakStatus(
  project: Project,
  stage?: ProjectWorkflowStage,
  ctx?: ProjectFolderContext,
  now = new Date(),
): QcBreakStatus {
  const placed = getPlacedDate(project, stage, ctx);
  const records = project.qcRecords ?? [];

  const sevenDayComplete = records.some((r) => recordMatchesBreakAge(r, 7));
  const fourteenDayComplete = records.some((r) => recordMatchesBreakAge(r, 14));
  const twentyEightDayComplete = records.some((r) => recordMatchesBreakAge(r, 28));
  const qcComplete = twentyEightDayComplete;

  const completedCount = [sevenDayComplete, fourteenDayComplete, twentyEightDayComplete].filter(
    Boolean,
  ).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

  let nextDueLabel = 'QC complete';
  let nextDueDate: Date | null = null;

  if (!placed) {
    return {
      sevenDayComplete,
      fourteenDayComplete,
      twentyEightDayComplete,
      qcComplete,
      progressPercent,
      nextDueLabel: 'Set placement date',
      nextDueDate: null,
      isOverdue: false,
      daysUntilOrOverdueLabel: 'Placement date required',
      placedDateLabel: '—',
    };
  }

  if (!sevenDayComplete) {
    nextDueLabel = '7-day break';
    nextDueDate = addDays(placed, 7);
  } else if (!fourteenDayComplete) {
    nextDueLabel = '14-day break';
    nextDueDate = addDays(placed, 14);
  } else if (!twentyEightDayComplete) {
    nextDueLabel = '28-day break';
    nextDueDate = addDays(placed, 28);
  }

  const timing =
    nextDueDate != null
      ? formatDaysUntilOrOverdue(nextDueDate, now)
      : { label: 'QC complete', isOverdue: false };

  return {
    sevenDayComplete,
    fourteenDayComplete,
    twentyEightDayComplete,
    qcComplete,
    progressPercent,
    nextDueLabel,
    nextDueDate,
    isOverdue: timing.isOverdue,
    daysUntilOrOverdueLabel: timing.label,
    placedDateLabel: formatShortDate(placed),
  };
}

export function getProjectFolder(
  project: Project,
  ctx?: ProjectFolderContext,
): ProjectFolder {
  const stage = resolveStage(project, ctx);
  const qc = getQcBreakStatus(project, stage, ctx);

  if (qc.qcComplete && (stage === 'paid' || stage === 'closed')) {
    return 'archived';
  }

  if (
    isOperationallyComplete(project, stage, ctx) &&
    hasConcretePlaced(project, stage, ctx) &&
    !qc.qcComplete
  ) {
    return 'qc_closeout';
  }

  return 'active';
}

export function buildFolderCounts(
  projects: Project[],
  resolveCtx?: (project: Project) => ProjectFolderContext | undefined,
): Record<ProjectFolder, number> {
  const counts: Record<ProjectFolder, number> = {
    active: 0,
    qc_closeout: 0,
    archived: 0,
  };
  for (const project of projects) {
    const folder = getProjectFolder(project, resolveCtx?.(project));
    counts[folder] += 1;
  }
  return counts;
}

export const PROJECT_FOLDER_LABELS: Record<ProjectFolder, string> = {
  active: 'Active',
  qc_closeout: 'QC Closeout',
  archived: 'Archived',
};

export const PROJECT_FOLDER_EMPTY: Record<ProjectFolder, string> = {
  active:
    'No active projects. Start a project or check QC Closeout.',
  qc_closeout:
    'No QC closeout items. Projects will appear here after completion until 28-day break results are entered.',
  archived: 'No archived projects yet.',
};
