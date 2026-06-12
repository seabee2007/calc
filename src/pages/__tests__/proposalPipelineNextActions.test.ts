import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const proposalsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../pages/Proposals.tsx'),
  'utf8',
);

const panelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../components/proposals/ProposalNextActionsPanel.tsx',
  ),
  'utf8',
);

describe('Proposal Pipeline next action workflow', () => {
  it('opens email modals from next actions instead of scrolling the pipeline', () => {
    expect(proposalsSource).toContain('onAction={(action) => void handleNextAction(action)}');
    expect(proposalsSource).not.toContain('onSelectProposal={scrollToProposal}');
    expect(proposalsSource).toContain('useProposalNextActionEmail');
  });

  it('does not navigate to generic /proposals for email actions in the panel', () => {
    expect(panelSource).toContain('onAction(item)');
    expect(panelSource).not.toContain("navigate('/proposals'");
  });

  it('routes dashboard deep links through openNextAction state', () => {
    expect(proposalsSource).toContain('openNextAction');
  });
});
