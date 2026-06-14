import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const proposalGeneratorSource = readFileSync(
  resolve(process.cwd(), 'src/pages/ProposalGenerator.tsx'),
  'utf8',
);
const proposalSetupPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/proposals/ProposalSetupPanel.tsx'),
  'utf8',
);

describe('ProposalGenerator preview actions', () => {
  it('uses ProposalPreviewActionBar instead of a separate Email button', () => {
    expect(proposalGeneratorSource).toContain('ProposalPreviewActionBar');
    expect(proposalGeneratorSource).not.toContain('handleEmailProposal');
    expect(proposalGeneratorSource).not.toContain('markProposalSent');
  });

  it('renders send/download modals while preview is open', () => {
    expect(proposalGeneratorSource).toContain('{proposalFeedbackModals}');
    expect(proposalGeneratorSource).toMatch(
      /if \(showPreview\)[\s\S]*\{proposalFeedbackModals\}/,
    );
  });

  it('shows success and error toasts for proposal email send', () => {
    expect(proposalGeneratorSource).toContain("'Proposal sent to client.'");
    expect(proposalGeneratorSource).toContain(
      "'Could not send proposal. Please try again.'",
    );
  });

  it('uses Download PDF toast without marking proposal sent', () => {
    expect(proposalGeneratorSource).toContain("'Proposal PDF downloaded.'");
    expect(proposalGeneratorSource).not.toMatch(
      /handleDownloadPDF[\s\S]*markProposalSent/,
    );
  });

  it('uses formatProposalPreviewSubtitle for preview date line', () => {
    expect(proposalGeneratorSource).toContain('formatProposalPreviewSubtitle');
    expect(proposalGeneratorSource).not.toMatch(/Proposal â€/);
    expect(proposalGeneratorSource).not.toContain('Proposal —');
  });

  it('normalizes polluted proposal text at display boundaries', () => {
    expect(proposalGeneratorSource).toContain('normalizeDisplayText');
  });

  it('uses one shared AppPage container for preview header and document shell', () => {
    expect(proposalGeneratorSource).toContain('<AppPage data-testid="proposal-preview-page"');
    expect(proposalGeneratorSource).toContain('data-testid="proposal-preview-shell"');
    expect(proposalGeneratorSource).not.toMatch(
      /if \(showPreview\)[\s\S]*flex w-full justify-center/,
    );
    expect(proposalGeneratorSource).not.toContain('max-w-5xl mx-auto');
    expect(proposalGeneratorSource).not.toContain('proposalPreviewShellClass');
  });

  it('imports pricing from the current estimate before legacy calculator data', () => {
    expect(proposalGeneratorSource).toContain('resolveProposalPricingImport');
    expect(proposalGeneratorSource).toContain('proposalCurrentEstimateImport');
    expect(proposalGeneratorSource).toContain('importedEstimateSummary');
    expect(proposalGeneratorSource).toContain('projectHasImportablePricingAsync');
  });

  it('uses Arden Proposal Builder copy and actions', () => {
    expect(proposalGeneratorSource).toContain('Proposal Builder');
    expect(proposalGeneratorSource).toContain(
      'Create client-ready proposals from your project estimate, scope, pricing, and schedule.',
    );
    expect(proposalGeneratorSource).toContain('Save Draft');
    expect(proposalGeneratorSource).toContain('Preview');
    expect(proposalGeneratorSource).toContain('Send to Client');
    expect(proposalGeneratorSource).toContain('handleBackToEditor');
    expect(proposalGeneratorSource).toContain('onBackToEditor={handleBackToEditor}');
    expect(proposalGeneratorSource).not.toContain('onEdit=');
  });

  it('keeps the compact setup and pricing summary sections visible', () => {
    expect(proposalGeneratorSource).toContain('ProposalSetupPanel');
    expect(proposalGeneratorSource).toContain('Estimate / Pricing Summary');
    expect(proposalGeneratorSource).toContain('onSelectProject={handleSelectProject}');
    expect(proposalGeneratorSource).not.toContain('Project Source');
    expect(proposalGeneratorSource).not.toContain('Proposal Settings');
    expect(proposalGeneratorSource).not.toContain('Nothing imported yet');
    expect(proposalSetupPanelSource).toContain('Select a project...');
    expect(proposalSetupPanelSource).not.toContain('Nothing imported yet');
    expect(proposalSetupPanelSource).not.toContain('Import Current Estimate');
  });

  it('does not use old calculator-era proposal copy', () => {
    expect(proposalGeneratorSource).not.toContain('Create professional concrete project proposals');
    expect(proposalGeneratorSource).not.toContain('concrete project proposals');
    expect(proposalGeneratorSource).not.toContain('Concrete Calc');
  });
});
