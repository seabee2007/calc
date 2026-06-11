import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), 'utf8');

const projectDetailsSource = read('pages/Projects/ProjectDetails.tsx');
const proposalsSource = read('pages/Proposals.tsx');
const appSource = read('App.tsx');
const projectProposalsSource = read('pages/Projects/ProjectProposalsPage.tsx');

describe('Project Files navigation', () => {
  it('routes Proposals to the project proposals list, not the generator', () => {
    expect(projectDetailsSource).toContain("import { projectProposalsHref } from '../../utils/projectProposals'");
    expect(projectDetailsSource).toContain('to: projectProposalsHref(project.id)');
    expect(projectDetailsSource).not.toMatch(/key:\s*'proposals'[\s\S]*proposal-generator/);
  });

  it('routes RFIs, FARs, Photos, and QC to project list views', () => {
    expect(projectDetailsSource).toContain("to: plannerRfiHref(project.id)");
    expect(projectDetailsSource).toContain("to: plannerAdjustmentHref(project.id)");
    expect(projectDetailsSource).toContain("to: plannerBoardHref(project.id)");
    expect(projectDetailsSource).toContain("tab: 'qc-reports'");
    expect(projectDetailsSource).not.toMatch(/key:\s*'rfis'[\s\S]*\/new/);
    expect(projectDetailsSource).not.toMatch(/key:\s*'fars'[\s\S]*change-orders\/new/);
  });

  it('does not auto-launch the legacy proposal generator from Project Files', () => {
    expect(projectDetailsSource).not.toContain('projectProposalHref');
    expect(projectDetailsSource).not.toMatch(/key:\s*'proposals'[\s\S]{0,120}proposal-generator/);
  });
});

describe('Project proposals page routing', () => {
  it('registers a dedicated project proposals route', () => {
    expect(appSource).toContain('path="projects/:projectId/proposals"');
    expect(appSource).toContain('LazyProjectProposalsPage');
  });

  it('opens the generator only from explicit Create Proposal actions', () => {
    expect(projectProposalsSource).toContain('projectProposalCreateHref(projectId)');
    expect(projectProposalsSource).toContain("title=\"No proposals linked yet\"");
    expect(projectProposalsSource).toContain('Create Proposal');
    expect(projectProposalsSource).not.toContain('Navigate to="/proposal-generator"');
  });

  it('lists linked proposals with pipeline actions', () => {
    expect(projectProposalsSource).toContain('getProjectProposals(project, proposals)');
    expect(projectProposalsSource).toContain('ProposalPipelineCard');
    expect(projectProposalsSource).toContain('projectProposalPreviewHref(proposal.id)');
    expect(projectProposalsSource).toContain('projectProposalEditHref(proposal.id)');
  });
});

describe('Proposal pipeline creation entry points', () => {
  it('still opens proposal creation from New Proposal', () => {
    expect(proposalsSource).toContain("navigate('/proposal-generator')");
    expect(proposalsSource).toContain('New Proposal');
  });
});
