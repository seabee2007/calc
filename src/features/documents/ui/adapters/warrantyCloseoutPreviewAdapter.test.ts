import { describe, expect, it } from 'vitest';
import { buildWarrantyCloseoutPreviewFromDocumentAnswers } from './warrantyCloseoutPreviewAdapter';

describe('warrantyCloseoutPreviewAdapter', () => {
  it('maps warranty closeout fields and title', () => {
    const view = buildWarrantyCloseoutPreviewFromDocumentAnswers({
      answers: {
        documentNumber: 'WC-2026-01',
        letterDate: '2026-06-03',
        warrantyPeriod: '1_year',
        closeoutSummary: 'Project substantially complete.',
        finalInspectionResult: 'passed',
      },
      selectedProject: {
        id: 'p1',
        name: 'Oak Street Remodel',
        clientInfo: { clientName: 'Jane Owner' },
        jobsiteAddress: null,
      } as never,
      companySettings: {
        companyName: 'AC Concrete',
        address: '1 Main St',
        phone: '555-0100',
        email: 'closeout@ac.com',
        licenseNumber: 'LIC-1',
        logoUrl: null,
      },
    });

    expect(view.documentNumber).toBe('WC-2026-01');
    expect(view.documentTitle).toContain('Warranty / Closeout Letter');
    expect(view.warrantyPeriod).toBe('1 Year');
    expect(view.finalInspectionResult).toBe('Passed');
    expect(view.closeoutSummary).toBe('Project substantially complete.');
  });
});
