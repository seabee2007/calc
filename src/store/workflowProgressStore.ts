import { create } from 'zustand';
import { stepIndex, type WorkflowStepId } from '../utils/workflow';

const GLOBAL_KEY = '__global__';

interface WorkflowProgressState {
  /** Highest step index reached per project (or global when no project id). */
  maxStepIndex: Record<string, number>;
  recordVisit: (projectId: string | undefined, stepId: WorkflowStepId) => void;
  getMaxStepIndex: (projectId: string | undefined) => number;
  resetProgress: (projectId?: string) => void;
}

function storageKey(projectId: string | undefined): string {
  return projectId?.trim() || GLOBAL_KEY;
}

function readStored(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem('workflow_max_step');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeStored(map: Record<string, number>) {
  try {
    sessionStorage.setItem('workflow_max_step', JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const useWorkflowProgressStore = create<WorkflowProgressState>((set, get) => ({
  maxStepIndex: readStored(),

  recordVisit: (projectId, stepId) => {
    const key = storageKey(projectId);
    const idx = stepIndex(stepId);
    set((s) => {
      const prev = s.maxStepIndex[key] ?? 0;
      if (idx <= prev) return s;
      const next = { ...s.maxStepIndex, [key]: idx };
      writeStored(next);
      return { maxStepIndex: next };
    });
  },

  getMaxStepIndex: (projectId) => {
    const key = storageKey(projectId);
    return get().maxStepIndex[key] ?? 0;
  },

  resetProgress: (projectId) => {
    set((s) => {
      const next = { ...s.maxStepIndex };
      if (projectId) {
        delete next[storageKey(projectId)];
      } else {
        Object.keys(next).forEach((k) => delete next[k]);
      }
      writeStored(next);
      return { maxStepIndex: next };
    });
  },
}));
