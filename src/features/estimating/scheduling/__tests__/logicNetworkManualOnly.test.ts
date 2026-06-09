import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const logicWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);

const estimateWorkspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

const canvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);

describe('Logic Network manual-only UI contract', () => {
  it('does not render removed sequencing or review entry points', () => {
    expect(logicWorkspaceSource).not.toContain('Check logic');
    expect(logicWorkspaceSource).not.toContain('LogicReviewPanel');
    expect(logicWorkspaceSource).not.toContain('AiSequenceReviewModal');
    expect(logicWorkspaceSource).not.toContain('AI Sequence Activities');
    expect(logicWorkspaceSource).not.toContain('runAiLogicSequence');
    expect(logicWorkspaceSource).not.toContain('Sequence Assistant');
    expect(logicWorkspaceSource).not.toContain('onAddSuggestedLinks');
  });

  it('keeps manual network and CPM controls', () => {
    expect(logicWorkspaceSource).toContain('Calculate CPM');
    expect(logicWorkspaceSource).toContain('Auto layout');
    expect(logicWorkspaceSource).toContain('Save layout');
    expect(logicWorkspaceSource).toContain('Fit view');
    expect(logicWorkspaceSource).toContain('Export logic');
    expect(logicWorkspaceSource).toContain('Run CPM');
  });

  it('does not wire suggested-link apply handlers from EstimateWorkspacePage', () => {
    expect(estimateWorkspaceSource).not.toContain('applyLogicSuggestions');
    expect(estimateWorkspaceSource).not.toContain('handleAddSuggestedLogicLinks');
    expect(estimateWorkspaceSource).not.toContain('onAddSuggestedLinks');
    expect(estimateWorkspaceSource).not.toContain('onIgnoreLogicWarning');
    expect(estimateWorkspaceSource).not.toContain('onRevertLastLogicBatch');
    expect(estimateWorkspaceSource).not.toContain('onClearAllLogicLinks');
  });

  it('manual canvas wiring uses onLinksChange directly', () => {
    expect(canvasSource).toContain('onLinksChange');
    expect(canvasSource).toContain('hasCycleWithNewLink');
    expect(canvasSource).not.toContain('applyLogicSuggestions');
    expect(canvasSource).not.toContain('validateLogicLinkCandidate');
  });
});
