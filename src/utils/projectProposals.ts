import type { Project } from '../types';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { workflowQuery } from './workflow';

export function projectProposalsHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/proposals`;
}

export function projectProposalCreateHref(projectId: string): string {
  return `/proposal-generator${workflowQuery(projectId)}`;
}

export function projectProposalEditHref(proposalId: string): string {
  return `/proposal-generator?edit=${encodeURIComponent(proposalId)}`;
}

export function projectProposalPreviewHref(proposalId: string): string {
  return `/proposal-generator?preview=${encodeURIComponent(proposalId)}`;
}

export function proposalMatchesProject(
  proposal: TrackedProposalRow,
  project: Pick<Project, 'id' | 'name'>,
): boolean {
  if (proposal.project_id === project.id) return true;
  const name = project.name?.trim() ?? '';
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    proposal.data?.projectTitle === name ||
    proposal.title.toLowerCase().includes(lower)
  );
}

export function getProjectProposals(
  project: Pick<Project, 'id' | 'name'>,
  proposals: TrackedProposalRow[],
): TrackedProposalRow[] {
  return proposals.filter((proposal) => proposalMatchesProject(proposal, project));
}

export function getLinkableProposals(
  project: Pick<Project, 'id' | 'name'>,
  proposals: TrackedProposalRow[],
): TrackedProposalRow[] {
  const linkedIds = new Set(getProjectProposals(project, proposals).map((p) => p.id));
  return proposals.filter((proposal) => !linkedIds.has(proposal.id));
}
