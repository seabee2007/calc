import { describe, expect, it } from 'vitest';
import { buildPunchListPreviewFromDocumentAnswers } from './punchListPreviewAdapter';

const baseInput = {
  selectedProject: {
    id: 'p1',
    name: 'Main Street TI',
    clientInfo: { clientName: 'City of Example' },
    jobsiteAddress: null,
  } as never,
  companySettings: {
    companyName: 'AC Concrete',
    address: '1 Main St',
    phone: '555-0100',
    email: 'pl@ac.com',
    licenseNumber: 'LIC-1',
    logoUrl: null,
  },
};

describe('punchListPreviewAdapter', () => {
  it('maps legacy flat fields and builds one item row', () => {
    const view = buildPunchListPreviewFromDocumentAnswers({
      answers: {
        punchListNumber: 'PL-42',
        listDate: '2026-06-03',
        overallStatus: 'open',
        itemDescription: 'Patch spalled concrete at entry',
        priority: 'high',
        itemStatus: 'in_progress',
        responsibleParty: 'Concrete crew',
      },
      ...baseInput,
    });

    expect(view.documentNumber).toBe('PL-42');
    expect(view.documentTitle).toContain('Punch List');
    expect(view.status).toBe('Open');
    expect(view.items).toHaveLength(1);
    expect(view.items[0].itemDescription).toBe('Patch spalled concrete at entry');
    expect(view.items[0].priority).toBe('High');
  });

  it('maps punchItems array with multiple discrepancies', () => {
    const view = buildPunchListPreviewFromDocumentAnswers({
      answers: {
        punchListNumber: 'PL-100',
        punchItems: [
          {
            id: 'a',
            itemNumber: '1',
            locationArea: 'Lobby',
            description: 'Touch-up paint',
            priority: 'low',
            status: 'open',
            responsibleParty: 'Painter',
            category: '',
            trade: '',
            dueDate: '',
            correctiveAction: '',
            completionDate: '',
            verifiedBy: '',
            verificationDate: '',
            ownerComment: '',
            contractorResponse: '',
            costImpact: '',
            scheduleImpact: '',
            photoReferences: '',
            attachmentNotes: '',
          },
          {
            id: 'b',
            itemNumber: '2',
            locationArea: 'Roof',
            description: 'Seal penetration',
            priority: 'critical',
            status: 'in_progress',
            responsibleParty: 'Roofing',
            category: '',
            trade: '',
            dueDate: '2026-07-01',
            correctiveAction: '',
            completionDate: '',
            verifiedBy: '',
            verificationDate: '',
            ownerComment: '',
            contractorResponse: '',
            costImpact: '',
            scheduleImpact: '',
            photoReferences: '',
            attachmentNotes: '',
          },
          {
            id: 'c',
            itemNumber: '3',
            locationArea: 'Garage',
            description: 'Grind high spot',
            priority: 'medium',
            status: 'complete',
            responsibleParty: 'Concrete',
            category: '',
            trade: '',
            dueDate: '',
            correctiveAction: '',
            completionDate: '',
            verifiedBy: '',
            verificationDate: '',
            ownerComment: '',
            contractorResponse: '',
            costImpact: '',
            scheduleImpact: '',
            photoReferences: '',
            attachmentNotes: '',
          },
        ],
      },
      ...baseInput,
    });

    expect(view.items).toHaveLength(3);
    expect(view.items[0].priority).toBe('Low');
    expect(view.items[1].priority).toBe('Critical');
    expect(view.items[2].itemStatus).toBe('Complete');
    expect(view.costImpact).toBe('—');
  });

  it('prefers punchItems over legacy flat fields when both exist', () => {
    const view = buildPunchListPreviewFromDocumentAnswers({
      answers: {
        itemDescription: 'Legacy only',
        punchItems: [
          {
            id: 'x',
            itemNumber: '9',
            description: 'From array',
            locationArea: '',
            category: '',
            trade: '',
            responsibleParty: '',
            priority: '',
            status: '',
            dueDate: '',
            correctiveAction: '',
            completionDate: '',
            verifiedBy: '',
            verificationDate: '',
            ownerComment: '',
            contractorResponse: '',
            costImpact: '',
            scheduleImpact: '',
            photoReferences: '',
            attachmentNotes: '',
          },
        ],
      },
      ...baseInput,
    });

    expect(view.items).toHaveLength(1);
    expect(view.items[0].itemDescription).toBe('From array');
  });
});
