import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConceptualBudgetPanel, {
  CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL,
  CONCEPTUAL_BUDGET_ADD_TOOLBAR_MARKER,
  CONCEPTUAL_BUDGET_EMPTY_BODY,
  CONCEPTUAL_BUDGET_EMPTY_TITLE,
  ConceptualBudgetAddToolbar,
} from '../ui/components/ConceptualBudgetPanel';
import { createEmptyConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import type { ConceptualEstimateController } from '../ui/hooks/useConceptualEstimate';

const panelSource = readFileSync(
  resolve(process.cwd(), 'src/features/estimating/ui/components/ConceptualBudgetPanel.tsx'),
  'utf8',
);

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function buildController(
  lineItems: ConceptualEstimateController['payload']['lineItems'] = [],
): ConceptualEstimateController {
  const payload = { ...createEmptyConceptualEstimatePayload(), lineItems };
  return {
    payload,
    rawPayload: payload,
    draftItems: {
      assumption: {
        title: '',
        description: '',
        impact: 'cost',
      },
      exclusion: {
        title: '',
        reason: '',
        description: '',
      },
      allowanceNote: {
        title: '',
        includedAmount: '',
        description: '',
      },
    },
    hasDraftItems: false,
    rollup: {
      subtotal: 0,
      escalationTotal: 0,
      contingencyAmount: 0,
      contingencyPercent: 10,
      overhead: 0,
      profit: 0,
      tax: 0,
      indirectCost: 0,
      finalSellPrice: 0,
      totalRiskExposure: 0,
      recommendedContingencyPercent: 0,
      aggregateConfidence: 'medium',
    },
    dirty: false,
    rehydrateFromEstimate: () => {},
    markSaved: () => {},
    recalculate: () => {},
    buildPayloadWithDraftItems: () => payload,
    clearDraftItems: () => {},
    updateAssumptionDraft: () => {},
    updateExclusionDraft: () => {},
    updateAllowanceNoteDraft: () => {},
    addLineItem: () => {},
    updateLineItem: () => {},
    deleteLineItem: () => {},
    updateRevision: () => {},
    setContingencyPercent: () => {},
    addAssumption: () => {},
    commitAssumptionDraft: () => {},
    updateAssumption: () => {},
    deleteAssumption: () => {},
    addExclusion: () => {},
    commitExclusionDraft: () => {},
    updateExclusion: () => {},
    deleteExclusion: () => {},
    addAllowanceNote: () => {},
    commitAllowanceNoteDraft: () => {},
    updateAllowanceNote: () => {},
    deleteAllowanceNote: () => {},
    addRisk: () => {},
    updateRisk: () => {},
    deleteRisk: () => {},
    addScenario: () => {},
    duplicateBudgetAsScenario: () => {},
    updateScenario: () => {},
    deleteScenario: () => {},
    selectScenario: () => {},
  };
}

describe('ConceptualBudgetPanel action buttons', () => {
  it('does not render Add Cost Model label in source', () => {
    expect(panelSource).not.toContain('Add Cost Model');
    expect(panelSource).toContain(CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL);
  });

  it('does not render Convert to detailed estimate beside add-item buttons', () => {
    expect(panelSource).not.toContain('Convert to detailed estimate');
    expect(panelSource).not.toContain('ConvertToDetailedEstimateModal');
  });

  it('shows one add toolbar in empty state', () => {
    render(<ConceptualBudgetPanel controller={buildController()} />);
    expect(screen.getByTestId('conceptual-budget-empty-state')).toBeTruthy();
    expect(screen.getByText(CONCEPTUAL_BUDGET_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(CONCEPTUAL_BUDGET_EMPTY_BODY)).toBeTruthy();
    expect(screen.getAllByTestId(CONCEPTUAL_BUDGET_ADD_TOOLBAR_MARKER)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add Division Budget' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add Allowance' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add Unit Cost Item' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL })).toBeTruthy();
  });

  it('hides empty-state card when line items exist and shows compact toolbar', () => {
    render(
      <ConceptualBudgetPanel
        controller={buildController([
          {
            id: 'cli-1',
            type: 'lump_sum',
            title: 'Shell budget',
            amount: 100000,
            confidenceLevel: 'medium',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ])}
      />,
    );
    expect(screen.queryByTestId('conceptual-budget-empty-state')).toBeNull();
    expect(screen.getAllByTestId(CONCEPTUAL_BUDGET_ADD_TOOLBAR_MARKER)).toHaveLength(1);
    expect(screen.getByText('Shell budget')).toBeTruthy();
  });

  it('defines add toolbar buttons once in source', () => {
    expect(countOccurrences(panelSource, 'Add Division Budget')).toBe(1);
    expect(countOccurrences(panelSource, 'Add Allowance')).toBe(1);
    expect(countOccurrences(panelSource, 'Add Unit Cost Item')).toBe(1);
    expect(countOccurrences(panelSource, CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL)).toBe(1);
  });
});

describe('ConceptualBudgetAddToolbar', () => {
  it('renders all five add actions', () => {
    render(<ConceptualBudgetAddToolbar disabled={false} onAdd={() => {}} />);
    expect(screen.getByRole('button', { name: CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Lump Sum Item' })).toBeTruthy();
  });
});

describe('ConceptualLineItemFormModal Select handlers', () => {
  it('uses string-value Select onChange handlers instead of event.target', () => {
    const modalSource = readFileSync(
      resolve(process.cwd(), 'src/features/estimating/ui/components/ConceptualLineItemFormModal.tsx'),
      'utf8',
    );
    expect(modalSource).toContain('onChange={(divisionCode) =>');
    expect(modalSource).not.toContain('divisionCode: event.target.value');
    expect(modalSource).not.toContain('confidenceLevel: event.target.value');
  });
});
