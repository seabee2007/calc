import { create } from 'zustand';
import {
  remapLegacyMaxStepIndex,
  stepIndex,
  WORKFLOW_PROGRESS_STORAGE_KEY,
  type WorkflowStepId,
} from '../utils/workflow';

const GLOBAL_KEY = '__global__';
const LEGACY_STORAGE_KEY = 'workflow_max_step';

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

function migrateStoredMap(raw: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    next[key] = remapLegacyMaxStepIndex(n);
  }
  return next;
}

function readStored(): Record<string, number> {
  try {
    const v2 = sessionStorage.getItem(WORKFLOW_PROGRESS_STORAGE_KEY);
    if (v2) {
      return migrateStoredMap(JSON.parse(v2) as Record<string, number>);
    }
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return {};
    const migrated = migrateStoredMap(JSON.parse(legacy) as Record<string, number>);
    sessionStorage.setItem(WORKFLOW_PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return {};
  }
}

function writeStored(map: Record<string, number>) {
  try {
    sessionStorage.setItem(WORKFLOW_PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const useWorkflowProgressStore = create<WorkflowProgressState>((set, get) => ({
  maxStepIndex: readStored(),

  recordVisit: (projectId, stepId) => {
    const key = storageKey(projectId);
    const idx = stepIndex(stepId);
    if (idx < 0) return;
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
