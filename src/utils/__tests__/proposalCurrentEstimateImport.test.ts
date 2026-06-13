import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types';
import type { ProposalData } from '../../types/proposal';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../../types/proposal';
import { EMPTY_US_ADDRESS } from '../../types/address';
import * as constructionActivityEstimateTotals from '../../features/estimating/application/constructionActivityEstimateTotals';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectConstructionActivity,
} from '../../features/estimating/domain/constructionActivityTypes';
import { emptyProposalPricingState, computeProposalBreakdown, formatProposalTotal } from '../proposalPricing';
import { importProjectIntoProposal } from '../proposalProjectImport';
import {
  buildProposalImportFromCurrentEstimate,
  currentEstimateContextHasImportablePricing,
  loadCurrentEstimateImportContext,
  projectHasImportablePricingAsync,
  resolveProposalPricingImport,
  type CurrentEstimateImportContext,
} from '../proposalCurrentEstimateImport';

vi.mock('../../features/estimating/application/currentEstimateService', () => ({
  getCurrentEstimate: vi.fn(),
}));

vi.mock('../../features/estimating/application/constructionActivityService', () => ({
  loadProjectActivitiesWithLineItems: vi.fn(),
}));

vi.mock('../../features/estimating/infrastructure/activityRepository', () => ({
  fetchProjectMaterialResources: vi.fn(),
  fetchProjectEquipmentResources: vi.fn(),
}));

import { getCurrentEstimate } from '../../features/estimating/application/currentEstimateService';
import { loadProjectActivitiesWithLineItems } from '../../features/estimating/application/constructionActivityService';
import {
  fetchProjectMaterialResources,
  fetchProjectEquipmentResources,
} from '../../features/estimating/infrastructure/activityRepository';

const FIXTURE_TOTALS: constructionActivityEstimateTotals.ConstructionActivityEstimateTotals = {
  totalActivities: 1,
  totalManHours: 120,
  laborCost: 4456.28,
  materialCost: 1688.78,
  equipmentCost: 600,
  subcontractorCost: 0,
  indirectCost: 1551.36,
  directCostSubtotal: 6745.06,
  contingencyPercent: 12,
  contingencyAmount: 1529.78,
  overheadPercent: 10,
  overheadAmount: 809.41,
  profitPercent: 15,
  profitAmount: 1092.7,
  taxPercent: 8,
  taxAmount: 1641.96,
  grandTotal: 13370.27,
};

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Place Slab',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 120,
    totalLaborCost: 4456.28,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<CurrentEstimateImportContext> = {},
): CurrentEstimateImportContext {
  return {
    estimate: {
      id: 'est-1',
      projectId: 'project-1',
      estimateType: 'detailed',
      estimateTypeLabel: 'Detailed',
      schedulingEnabled: true,
      estimateModeConfig: null,
      pricingMode: null,
      status: 'draft',
      selectedDivisions: [],
      lineItems: [],
      totals: {},
      summary: {},
      assumptions: {
        estimateSettings: {
          overheadPercent: 10,
          profitPercent: 15,
          contingencyPercent: 12,
          taxPercent: 8,
          indirectCostPercent: 23,
        },
      },
      createdBy: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    activities: [makeActivity()],
    lineItemsByActivityId: new Map(),
    materialResources: [
      {
        id: 'mat-1',
        activityId: 'act-1',
        projectId: 'project-1',
        name: 'Concrete mix',
        quantity: 10,
        unit: 'CY',
        unitCost: 168.878,
        totalCost: 1688.78,
        sourceProvider: 'manual',
      } satisfies ActivityMaterialResource,
    ],
    equipmentResources: [
      {
        id: 'equip-1',
        activityId: 'act-1',
        projectId: 'project-1',
        name: 'Pump truck',
        quantity: 1,
        unit: 'day',
        unitCost: 600,
        totalCost: 600,
        sourceProvider: 'manual',
      } satisfies ActivityEquipmentResource,
    ],
    ...overrides,
  };
}

const legacyProject = (): Project =>
  ({
    id: 'project-legacy',
    name: 'Legacy Slab',
    calculations: [
      {
        result: { pricing: { concreteCost: 1200 }, volume: 10 },
        type: 'slab',
        psi: '3000',
      },
    ],
    laborEstimates: [],
    reinforcements: [],
  }) as Project;

describe('proposalCurrentEstimateImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      constructionActivityEstimateTotals,
      'calculateEstimateTotalsFromConstructionActivities',
    ).mockReturnValue(FIXTURE_TOTALS);
  });

  it('populates labor, material, and equipment lines from current estimate context', () => {
    const imported = buildProposalImportFromCurrentEstimate(makeContext());
    expect(imported).not.toBeNull();
    expect(imported!.laborItems.length).toBeGreaterThan(0);
    expect(imported!.materialItems.length).toBeGreaterThan(0);
    expect(imported!.equipmentItems.length).toBeGreaterThan(0);
    expect(imported!.laborItems[0].description).toContain('03-01-01');
    expect(imported!.materialItems[0].description).toContain('Concrete mix');
    expect(imported!.equipmentItems[0].description).toContain('Pump truck');
  });

  it('imports indirect, overhead, profit, contingency, tax, and final sell price rollup', () => {
    const imported = buildProposalImportFromCurrentEstimate(makeContext());
    const summary = imported!.importedEstimateSummary;

    expect(summary.laborTotal).toBe(4456.28);
    expect(summary.materialTotal).toBe(1688.78);
    expect(summary.equipmentTotal).toBe(600);
    expect(summary.subcontractorTotal).toBe(0);
    expect(summary.indirectCostTotal).toBe(1551.36);
    expect(summary.directCost).toBe(6745.06);
    expect(summary.overheadTotal).toBe(809.41);
    expect(summary.profitTotal).toBe(1092.7);
    expect(summary.contingencyTotal).toBe(1529.78);
    expect(summary.taxTotal).toBe(1641.96);
    expect(summary.finalSellPrice).toBe(13370.27);
  });

  it('maps estimate markup settings into proposal pricing indirect fields', () => {
    const imported = buildProposalImportFromCurrentEstimate(makeContext());
    expect(imported!.pricingIndirect.contingencyPercent).toBe(12);
    expect(imported!.pricingIndirect.overheadPercent).toBe(10);
    expect(imported!.pricingIndirect.targetMarginPercent).toBe(15);
    expect(imported!.pricingIndirect.taxRatePercent).toBe(8);
  });

  it('proposal final total equals estimate final sell price after import', () => {
    const imported = buildProposalImportFromCurrentEstimate(makeContext());
    const proposalData: ProposalData = {
      businessName: 'Acme',
      clientName: 'Client',
      clientCompany: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      clientAddressParts: { ...EMPTY_US_ADDRESS },
      projectTitle: 'Test',
      date: 'January 1, 2026',
      introduction: '',
      scope: '',
      timeline: [{ phase: '', start: '', end: '' }],
      ...emptyProposalPricingState(),
      laborItems: imported!.laborItems,
      materialItems: imported!.materialItems,
      equipmentItems: imported!.equipmentItems,
      subcontractorItems: imported!.subcontractorItems,
      importedEstimateSummary: imported!.importedEstimateSummary,
      pricingIndirect: {
        ...emptyProposalPricingState().pricingIndirect,
        ...imported!.pricingIndirect,
      },
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
    };

    expect(formatProposalTotal(proposalData)).toBe('$13,370.27');
    expect(computeProposalBreakdown(proposalData).totalPrice).toBe(13370.27);
    expect(computeProposalBreakdown(proposalData).importedIndirectCost).toBe(1551.36);
  });

  it('does not break import when material and equipment totals are zero', () => {
    vi.mocked(
      constructionActivityEstimateTotals.calculateEstimateTotalsFromConstructionActivities,
    ).mockReturnValue({
      ...FIXTURE_TOTALS,
      materialCost: 0,
      equipmentCost: 0,
      directCostSubtotal: 4456.28,
      grandTotal: 9000,
    });

    const imported = buildProposalImportFromCurrentEstimate(
      makeContext({
        materialResources: [],
        equipmentResources: [],
      }),
    );

    expect(imported).not.toBeNull();
    expect(imported!.materialItems).toEqual([]);
    expect(imported!.equipmentItems).toEqual([]);
    expect(imported!.laborItems.length).toBeGreaterThan(0);
    expect(imported!.importedEstimateSummary.finalSellPrice).toBe(9000);
  });

  it('resolveProposalPricingImport prefers current estimate over legacy calculator data', async () => {
    vi.mocked(getCurrentEstimate).mockResolvedValue(makeContext().estimate);
    vi.mocked(loadProjectActivitiesWithLineItems).mockResolvedValue({
      data: [{ activity: makeActivity(), lineItems: [] }],
      error: null,
    });
    vi.mocked(fetchProjectMaterialResources).mockResolvedValue({
      data: makeContext().materialResources,
      error: null,
    });
    vi.mocked(fetchProjectEquipmentResources).mockResolvedValue({
      data: makeContext().equipmentResources,
      error: null,
    });

    const resolved = await resolveProposalPricingImport('project-1', legacyProject());
    expect(resolved?.source).toBe('current-estimate');
    expect(resolved?.currentEstimateImport?.importedEstimateSummary.finalSellPrice).toBe(13370.27);
    expect(resolved?.legacyLineItems).toBeUndefined();
  });

  it('falls back to legacy import when no current estimate exists', async () => {
    vi.mocked(getCurrentEstimate).mockResolvedValue(null);

    const resolved = await resolveProposalPricingImport(
      'project-legacy',
      legacyProject(),
    );

    expect(resolved?.source).toBe('legacy');
    expect(resolved?.legacyLineItems?.materialItems.length).toBeGreaterThan(0);
  });

  it('projectHasImportablePricingAsync returns true for current estimate projects', async () => {
    vi.mocked(getCurrentEstimate).mockResolvedValue(makeContext().estimate);
    vi.mocked(loadProjectActivitiesWithLineItems).mockResolvedValue({
      data: [{ activity: makeActivity(), lineItems: [] }],
      error: null,
    });
    vi.mocked(fetchProjectMaterialResources).mockResolvedValue({
      data: makeContext().materialResources,
      error: null,
    });
    vi.mocked(fetchProjectEquipmentResources).mockResolvedValue({
      data: makeContext().equipmentResources,
      error: null,
    });

    const importable = await projectHasImportablePricingAsync('project-1', legacyProject());
    expect(importable).toBe(true);
  });

  it('importProjectIntoProposal uses current estimate import when provided', () => {
    const imported = buildProposalImportFromCurrentEstimate(makeContext());
    const baseProposal: ProposalData = {
      businessName: 'Acme',
      clientName: '',
      clientCompany: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      clientAddressParts: { ...EMPTY_US_ADDRESS },
      projectTitle: '',
      date: 'January 1, 2026',
      introduction: '',
      scope: '',
      timeline: [{ phase: '', start: '', end: '' }],
      ...emptyProposalPricingState(),
      ...EMPTY_PROPOSAL_DOCUMENT_FIELDS,
    };

    const result = importProjectIntoProposal(baseProposal, legacyProject(), {
      importPricing: true,
      overwriteEmptyOnly: false,
      currentEstimateImport: imported,
    });

    expect(result.laborItems?.length).toBeGreaterThan(0);
    expect(result.materialItems?.length).toBeGreaterThan(0);
    expect(result.equipmentItems?.length).toBeGreaterThan(0);
    expect(result.importedEstimateSummary?.finalSellPrice).toBe(13370.27);
  });

  it('currentEstimateContextHasImportablePricing is true when activities exist', () => {
    expect(currentEstimateContextHasImportablePricing(makeContext())).toBe(true);
  });

  it('loadCurrentEstimateImportContext returns null when no estimate exists', async () => {
    vi.mocked(getCurrentEstimate).mockResolvedValue(null);
    await expect(loadCurrentEstimateImportContext('missing-project')).resolves.toBeNull();
  });
});
