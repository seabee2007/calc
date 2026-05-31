import { describe, expect, it } from 'vitest';
import { buildProposalLineItemsFromProject } from './proposalPricingImport';
import type { Project } from '../types';
import { computeLaborMaterialLineTotal } from './changeOrderFinancials';

describe('buildProposalLineItemsFromProject — labor unit price', () => {
  it('fills qty and unit price from placement labor hours', () => {
    const project = {
      id: 'p1',
      name: 'Test',
      laborEstimates: [
        {
          laborCost: 8000,
          adjustedLaborHours: 100,
        },
      ],
    } as unknown as Project;

    const { laborItems } = buildProposalLineItemsFromProject(project);
    expect(laborItems).toHaveLength(1);
    const row = laborItems[0];
    expect(row.qty).toBe(100);
    expect(row.unitPrice).toBe(80);
    expect(computeLaborMaterialLineTotal(row)).toBe(8000);
  });

  it('passes through custom labor lines with qty and unit price', () => {
    const project = {
      id: 'p1',
      name: 'Test',
      customEstimates: {
        laborItems: [
          {
            description: 'Drywall — hang',
            qty: 500,
            unitPrice: 2.4,
            amount: 1200,
          },
        ],
        materialItems: [],
        equipmentItems: [],
      },
    } as unknown as Project;

    const { laborItems } = buildProposalLineItemsFromProject(project);
    expect(laborItems[0].qty).toBe(500);
    expect(laborItems[0].unitPrice).toBe(2.4);
    expect(computeLaborMaterialLineTotal(laborItems[0])).toBe(1200);
  });
});
