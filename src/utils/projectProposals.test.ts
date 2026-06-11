import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import type { TrackedProposalRow } from '../types/proposalTracking';
import {
  getProjectProposals,
  projectProposalCreateHref,
  projectProposalsHref,
  proposalMatchesProject,
} from './projectProposals';

const project: Pick<Project, 'id' | 'name'> = {
  id: 'proj-abc',
  name: 'Oak Drive Patio',
};

const baseProposal = (overrides: Partial<TrackedProposalRow>): TrackedProposalRow =>
  ({
    id: 'prop-1',
    user_id: 'user-1',
    project_id: null,
    title: 'Untitled',
    template_type: 'classic',
    data: { projectTitle: 'Other', clientName: 'Client' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: 'draft',
    sent_at: null,
    viewed_at: null,
    opened_at: null,
    accepted_at: null,
    declined_at: null,
    deposit_paid_at: null,
    scheduled_at: null,
    paid_at: null,
    total_amount: 0,
    labor_cost: 0,
    material_cost: 0,
    deposit_amount: 0,
    gross_profit: 0,
    gross_margin_percent: 0,
    public_token: '',
    ...overrides,
  }) as TrackedProposalRow;

describe('projectProposals utils', () => {
  it('builds project-scoped proposal list href', () => {
    expect(projectProposalsHref('proj-abc')).toBe('/projects/proj-abc/proposals');
  });

  it('builds explicit create href for the legacy generator', () => {
    expect(projectProposalCreateHref('proj-abc')).toBe(
      '/proposal-generator?flow=1&project=proj-abc',
    );
  });

  it('matches proposals by project_id and project name heuristics', () => {
    expect(
      proposalMatchesProject(
        baseProposal({ project_id: 'proj-abc' }),
        project,
      ),
    ).toBe(true);
    expect(
      proposalMatchesProject(
        baseProposal({ data: { projectTitle: 'Oak Drive Patio', clientName: 'Client' } }),
        project,
      ),
    ).toBe(true);
    expect(
      proposalMatchesProject(
        baseProposal({ title: 'Estimate for Oak Drive Patio' }),
        project,
      ),
    ).toBe(true);
    expect(proposalMatchesProject(baseProposal({}), project)).toBe(false);
  });

  it('returns all linked proposals for a project', () => {
    const proposals = [
      baseProposal({ id: 'a', project_id: 'proj-abc' }),
      baseProposal({ id: 'b', title: 'Oak Drive Patio bid' }),
      baseProposal({ id: 'c', project_id: 'other' }),
    ];
    expect(getProjectProposals(project, proposals).map((p) => p.id)).toEqual(['a', 'b']);
  });
});
