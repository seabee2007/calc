import type { TrackedProposalRow } from '../types/proposalTracking';
import type { ProjectWorkflowStage } from './projectWorkflow';
import { projectProposalsHref } from './projectProposals';

export type ProjectProposalNextAction =
  | { type: 'navigate'; label: string; path: string; search?: string }
  | { type: 'email'; label: string; mode: 'send' | 'followUp'; proposal: TrackedProposalRow };

export function resolveProjectProposalNextAction(
  projectId: string,
  matchedProposal: TrackedProposalRow | undefined,
): ProjectProposalNextAction {
  if (!matchedProposal) {
    return {
      type: 'navigate',
      label: 'Create proposal',
      path: projectProposalsHref(projectId),
    };
  }

  if (matchedProposal.status === 'draft') {
    return {
      type: 'email',
      label: 'Send proposal',
      mode: 'send',
      proposal: matchedProposal,
    };
  }

  if (['sent', 'viewed', 'opened', 'declined'].includes(matchedProposal.status)) {
    return {
      type: 'email',
      label: 'Follow up proposal',
      mode: 'followUp',
      proposal: matchedProposal,
    };
  }

  if (matchedProposal.status === 'accepted') {
    return {
      type: 'email',
      label: 'Request deposit',
      mode: 'followUp',
      proposal: matchedProposal,
    };
  }

  return {
    type: 'navigate',
    label: 'View proposals',
    path: projectProposalsHref(projectId),
  };
}

export function shouldUseProjectProposalNextAction(
  workflowStage: ProjectWorkflowStage,
  matchedProposal: TrackedProposalRow | undefined,
): boolean {
  if (!matchedProposal) {
    return workflowStage === 'created' || workflowStage === 'estimating';
  }

  if (matchedProposal.status === 'draft') {
    return workflowStage === 'estimating' || workflowStage === 'created';
  }

  if (['sent', 'viewed', 'opened', 'declined'].includes(matchedProposal.status)) {
    return workflowStage === 'proposal_sent';
  }

  if (matchedProposal.status === 'accepted') {
    return workflowStage === 'accepted';
  }

  return false;
}
