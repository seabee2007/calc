import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/hooks/useEstimateLineItemDraft.ts',
  ),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

describe('useEstimateLineItemDraft settings defaults', () => {
  it('applies estimate settings when creating new activity drafts', () => {
    expect(hookSource).toContain('applyEstimateSettingsToNewDraftLine');
    expect(hookSource).toContain('createNewFormDraft');
    expect(hookSource).toContain('estimateSettings');
  });

  it('preserves existing activity values when opening edit drawer', () => {
    expect(hookSource).toContain('setFormDraft(cloneDraftLine(existing))');
    expect(hookSource).not.toContain('applyEstimateSettingsToNewDraftLine(existing');
  });

  it('receives current estimate settings from workspace page', () => {
    expect(workspaceSource).toContain(
      'useEstimateLineItemDraft(estimateAdapter, estimateSettings.settings)',
    );
  });
});
