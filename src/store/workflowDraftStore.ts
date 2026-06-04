import { create } from 'zustand';
import type { PourPlannerFormState } from '../types/pourPlanner';
import type { ProposalData } from '../types/proposal';

const STORAGE_KEY = 'workflow_drafts';

type TemplateType = 'classic' | 'modern' | 'minimal';

export interface PourPlannerDraft {
  form: PourPlannerFormState;
  activeStep: number;
}

export interface ProposalWorkflowDraft {
  proposalData: ProposalData;
  proposalTitle: string;
  selectedTemplate: TemplateType;
  showPreview: boolean;
}

export type MixDesignWorkflowDraft = import('../types/mixDesignAdvisor').MixDesignAdvisorFormState;

interface WorkflowDraftsByProject {
  pourPlanner?: PourPlannerDraft;
  proposal?: ProposalWorkflowDraft;
  /** @deprecated — use mixDesignByCalculation */
  mixDesign?: MixDesignWorkflowDraft;
  mixDesignByCalculation?: Record<string, MixDesignWorkflowDraft>;
}

interface WorkflowDraftState {
  byProject: Record<string, WorkflowDraftsByProject>;
  getPourPlannerDraft: (projectId: string) => PourPlannerDraft | undefined;
  savePourPlannerDraft: (projectId: string, draft: PourPlannerDraft) => void;
  getProposalDraft: (projectId: string) => ProposalWorkflowDraft | undefined;
  saveProposalDraft: (projectId: string, draft: ProposalWorkflowDraft) => void;
  getMixDesignDraft: (
    projectId: string,
    calculationId?: string,
  ) => MixDesignWorkflowDraft | undefined;
  saveMixDesignDraft: (
    projectId: string,
    calculationId: string | undefined,
    draft: MixDesignWorkflowDraft,
  ) => void;
}

function readStored(): Record<string, WorkflowDraftsByProject> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WorkflowDraftsByProject>;
  } catch {
    return {};
  }
}

function writeStored(map: Record<string, WorkflowDraftsByProject>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export const useWorkflowDraftStore = create<WorkflowDraftState>((set, get) => ({
  byProject: readStored(),

  getPourPlannerDraft: (projectId) => get().byProject[projectId]?.pourPlanner,

  savePourPlannerDraft: (projectId, draft) => {
    set((s) => {
      const next = {
        ...s.byProject,
        [projectId]: { ...s.byProject[projectId], pourPlanner: draft },
      };
      writeStored(next);
      return { byProject: next };
    });
  },

  getProposalDraft: (projectId) => get().byProject[projectId]?.proposal,

  saveProposalDraft: (projectId, draft) => {
    set((s) => {
      const next = {
        ...s.byProject,
        [projectId]: { ...s.byProject[projectId], proposal: draft },
      };
      writeStored(next);
      return { byProject: next };
    });
  },

  getMixDesignDraft: (projectId, calculationId) => {
    const bucket = get().byProject[projectId];
    if (!bucket) return undefined;
    if (calculationId && bucket.mixDesignByCalculation?.[calculationId]) {
      return bucket.mixDesignByCalculation[calculationId];
    }
    if (calculationId) return undefined;
    return bucket.mixDesign;
  },

  saveMixDesignDraft: (projectId, calculationId, draft) => {
    set((s) => {
      const prev = s.byProject[projectId] ?? {};
      let mixDesignByCalculation = { ...prev.mixDesignByCalculation };
      if (calculationId) {
        mixDesignByCalculation = {
          ...mixDesignByCalculation,
          [calculationId]: draft,
        };
      }
      const next = {
        ...s.byProject,
        [projectId]: {
          ...prev,
          ...(calculationId
            ? { mixDesignByCalculation }
            : { mixDesign: draft }),
        },
      };
      writeStored(next);
      return { byProject: next };
    });
  },
}));
