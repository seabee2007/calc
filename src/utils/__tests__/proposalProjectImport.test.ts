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
});
