import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import type { ProposalData } from '../../types/proposal';
import { EMPTY_PROPOSAL_DOCUMENT_FIELDS } from '../../types/proposal';
import { EMPTY_US_ADDRESS } from '../../types/address';
import { emptyProposalPricingState } from '../proposalPricing';
import {
  buildDefaultProposalTitle,
  importProjectIntoProposal,
  resolveProjectScopeOfWork,
} from '../proposalProjectImport';
import { buildProposalImportFromCurrentEstimate, type CurrentEstimateImportContext } from '../proposalCurrentEstimateImport';
import * as constructionActivityEstimateTotals from '../../features/estimating/application/constructionActivityEstimateTotals';
import { vi } from 'vitest';

const baseProposal = (): ProposalData => ({
  businessName: 'Acme Concrete',
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
});

const sampleProject = (): Project =>
  ({
    id: 'project-1',
    name: 'Riverfront Slab',
    description: 'Pour 4-inch slab with vapor barrier and finish.',
    clientInfo: {
      clientName: 'Jane Client',
      clientCompany: 'Client Co',
      clientEmail: 'jane@client.com',
      clientPhone: '(555) 111-2222',
      clientAddressSameAsJobsite: true,
    },
    jobsiteAddress: {
      street: '123 Main St',
      street2: '',
      city: 'Atlanta',
      state: 'GA',
      zip: '30301',
    },
    calculations: [],
    laborEstimates: [],
    reinforcements: [],
  }) as Project;

describe('proposalProjectImport', () => {
  it('builds default proposal title from project name', () => {
    expect(buildDefaultProposalTitle('Riverfront Slab')).toBe('Riverfront Slab - Proposal');
  });

  it('imports client and project fields from selected project', () => {
    const imported = importProjectIntoProposal(baseProposal(), sampleProject(), {
      importPricing: false,
    });

    expect(imported.clientName).toBe('Jane Client');
    expect(imported.clientEmail).toBe('jane@client.com');
    expect(imported.clientPhone).toBe('(555) 111-2222');
    expect(imported.projectTitle).toBe('Riverfront Slab');
    expect(imported.scope).toBe('Pour 4-inch slab with vapor barrier and finish.');
  });

  it('falls back to estimate source summary when project scope is empty', () => {
    const project = {
      ...sampleProject(),
      description: '',
      calculations: [
        {
          result: { pricing: { concreteCost: 1200 } },
        },
      ],
    } as Project;

    expect(resolveProjectScopeOfWork(project)).toContain('concrete');
  });

  it('does not overwrite filled proposal fields when overwriteEmptyOnly is true', () => {
    const current = {
      ...baseProposal(),
      clientEmail: 'override@proposal.com',
      projectTitle: 'Custom Title',
    };

    const imported = importProjectIntoProposal(current, sampleProject(), {
      overwriteEmptyOnly: true,
      importPricing: false,
    });

    expect(imported.clientEmail).toBe('override@proposal.com');
    expect(imported.projectTitle).toBe('Custom Title');
    expect(imported.clientName).toBe('Jane Client');
  });

  it('imports legacy calculator pricing when no current estimate import is provided', () => {
    const project = {
      ...sampleProject(),
      calculations: [
        {
          result: { pricing: { concreteCost: 1500 }, volume: 12 },
          type: 'slab',
          psi: '4000',
        },
      ],
    } as Project;

    const imported = importProjectIntoProposal(baseProposal(), project, {
      importPricing: true,
      overwriteEmptyOnly: false,
    });

    expect(imported.materialItems?.length).toBeGreaterThan(0);
    expect(imported.importedEstimateSummary).toBeUndefined();
  });

  it('imports current estimate pricing when currentEstimateImport is provided', () => {
    vi.spyOn(
      constructionActivityEstimateTotals,
      'calculateEstimateTotalsFromConstructionActivities',
    ).mockReturnValue({
      totalActivities: 1,
      totalManHours: 40,
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
    });

    const context: CurrentEstimateImportContext = {
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
          },
        },
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      activities: [
        {
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
        },
      ],
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
        },
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
        },
      ],
    };

    const currentEstimateImport = buildProposalImportFromCurrentEstimate(context);
    const imported = importProjectIntoProposal(baseProposal(), sampleProject(), {
      importPricing: true,
      overwriteEmptyOnly: false,
      currentEstimateImport,
    });

    expect(imported.laborItems?.length).toBeGreaterThan(0);
    expect(imported.materialItems?.length).toBeGreaterThan(0);
    expect(imported.equipmentItems?.length).toBeGreaterThan(0);
    expect(imported.importedEstimateSummary?.finalSellPrice).toBe(13370.27);
  });
});
