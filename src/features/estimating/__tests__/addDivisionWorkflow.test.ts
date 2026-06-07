import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  appendSelectedDivisions,
  normalizeSelectedDivisions,
} from '../application/estimateWorkBreakdown';
import {
  getScopeModalDescription,
  getScopeModalSubmitLabel,
  getScopeModalTitle,
} from '../application/estimateStartFlow';
import { mergeRecommendedDivisionCodes } from '../application/recommendEstimateDivisions';
import { shouldShowAddDivisionAction } from '../ui/estimateWorkspaceToolbar';
import type { EstimateSelectedDivision } from '../domain/estimateTypes';

const builderPanelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/EstimateLineItemsBuilderPanel.tsx',
  ),
  'utf8',
);
const scopeModalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/EstimateStartScopeModal.tsx',
  ),
  'utf8',
);
const toolbarSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/EstimateWorkspaceToolbarActions.tsx',
  ),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

function makeDivision(code: string): EstimateSelectedDivision {
  return {
    code,
    name: `Division ${code}`,
    source: 'manual',
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

describe('appendSelectedDivisions', () => {
  it('appends new divisions without duplicating existing codes', () => {
    const existing = [makeDivision('01'), makeDivision('03')];
    const additions = [makeDivision('03'), makeDivision('06')];
    expect(appendSelectedDivisions(existing, additions).map((division) => division.code)).toEqual([
      '01',
      '03',
      '06',
    ]);
  });

  it('preserves existing division metadata when merging', () => {
    const existing = [
      {
        code: '01',
        name: 'General Requirements',
        source: 'import' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const additions = [makeDivision('01'), makeDivision('02')];
    const merged = appendSelectedDivisions(existing, additions);
    expect(merged[0]?.name).toBe('General Requirements');
    expect(merged[0]?.source).toBe('import');
    expect(merged.map((division) => division.code)).toEqual(['01', '02']);
  });
});

describe('scope modal add mode copy', () => {
  it('uses add-mode title, helper text, and submit label', () => {
    expect(getScopeModalTitle('add', 'detailed')).toBe('Add Divisions');
    expect(getScopeModalDescription('add', 'detailed')).toBe(
      'Select additional divisions to add to this estimate.',
    );
    expect(getScopeModalSubmitLabel('add')).toBe('Add selected divisions');
  });

  it('keeps create-mode copy for initial scope setup', () => {
    expect(getScopeModalTitle('create', 'bid')).toBe('Build Project Scope');
    expect(getScopeModalSubmitLabel('create')).toBe('Create work breakdown');
  });
});

describe('add division workflow wiring', () => {
  it('shows Add division on the estimate tab when buckets are visible', () => {
    expect(shouldShowAddDivisionAction('line-items', true, true, 'bid', true)).toBe(true);
    expect(shouldShowAddDivisionAction('line-items', true, false, 'bid', true)).toBe(false);
    expect(shouldShowAddDivisionAction('overview', true, true, 'bid', true)).toBe(false);
    expect(shouldShowAddDivisionAction('line-items', true, true, 'quick_feasibility', true)).toBe(
      false,
    );
  });

  it('exposes toolbar button and add-mode modal wiring', () => {
    expect(toolbarSource).toContain('ADD_DIVISION_TOOLBAR_LABEL');
    expect(toolbarSource).toContain('openAddDivision');
    expect(builderPanelSource).toContain("setScopeModalMode('add')");
    expect(builderPanelSource).toContain('appendSelectedDivisions');
    expect(builderPanelSource).toContain('onDivisionsAdded');
    expect(scopeModalSource).toContain('Already added');
    expect(scopeModalSource).toContain("mode === 'add'");
    expect(workspaceSource).toContain('Divisions added');
    expect(workspaceSource).toContain('Select at least one new division');
  });

  it('marks existing divisions and filters AI recommendations in add mode', () => {
    expect(scopeModalSource).toContain('existingDivisionCodes');
    expect(scopeModalSource).toContain('!existingCodeSet.has(code)');
    expect(
      mergeRecommendedDivisionCodes(['01', '03'], ['03', '06', '26']).filter(
        (code) => !['01', '03'].includes(code),
      ),
    ).toEqual(['06', '26']);
  });

  it('persists merged selectedDivisions through existing save handler', () => {
    expect(builderPanelSource).toContain('onSaveSelectedDivisions(merged)');
    expect(workspaceSource).toContain('handleSaveSelectedDivisions');
    expect(workspaceSource).toContain('lineItems: currentEstimate.lineItems');
    expect(workspaceSource).toContain('assumptions: currentEstimate.assumptions');
  });

  it('collapses newly added divisions by default', () => {
    expect(builderPanelSource).toContain('next.add(division.code)');
  });
});

describe('normalizeSelectedDivisions dedupe', () => {
  it('does not duplicate divisions when reloading merged selections', () => {
    const merged = normalizeSelectedDivisions([
      makeDivision('01'),
      makeDivision('03'),
      makeDivision('01'),
      makeDivision('06'),
    ]);
    expect(merged.map((division) => division.code)).toEqual(['01', '03', '06']);
  });
});
