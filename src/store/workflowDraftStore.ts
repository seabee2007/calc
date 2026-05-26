import { create } from 'zustand';
import type { PourPlannerFormState } from '../types/pourPlanner';
import type { ProposalData } from '../types/proposal';
import type { USAddress } from '../types/address';

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

export interface MixDesignWorkflowDraft {
  selectedPsi: string;
  exposure: 'F1' | 'F2' | 'F3' | 'none';
  unitSystem: 'imperial' | 'metric';
  climate: 'temperate' | 'tropical';
  jobsiteAddress: USAddress;
}

interface WorkflowDraftsByProject {
  pourPlanner?: PourPlannerDraft;
  proposal?: ProposalWorkflowDraft;
  mixDesign?: MixDesignWorkflowDraft;
}

interface WorkflowDraftState {
  byProject: Record<string, WorkflowDraftsByProject>;
  getPourPlannerDraft: (projectId: string) => PourPlannerDraft | undefined;
  savePourPlannerDraft: (projectId: string, draft: PourPlannerDraft) => void;
  getProposalDraft: (projectId: string) => ProposalWorkflowDraft | undefined;
  saveProposalDraft: (projectId: string, draft: ProposalWorkflowDraft) => void;
  getMixDesignDraft: (projectId: string) => MixDesignWorkflowDraft | undefined;
  saveMixDesignDraft: (projectId: string, draft: MixDesignWorkflowDraft) => void;
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

  getMixDesignDraft: (projectId) => get().byProject[projectId]?.mixDesign,

  saveMixDesignDraft: (projectId, draft) => {
    set((s) => {
      const next = {
        ...s.byProject,
        [projectId]: { ...s.byProject[projectId], mixDesign: draft },
      };
      writeStored(next);
      return { byProject: next };
    });
  },
}));
