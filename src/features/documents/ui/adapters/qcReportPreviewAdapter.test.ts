import { describe, expect, it } from 'vitest';
import { buildQcReportPreviewFromDocumentAnswers } from './qcReportPreviewAdapter';

describe('qcReportPreviewAdapter', () => {
  it('maps report fields and uses QC Report title', () => {
    const view = buildQcReportPreviewFromDocumentAnswers({
      answers: {
        reportNumber: 'QC-12',
        reportDate: '2026-06-03',
        inspectionType: 'concrete_placement',
        overallStatus: 'passed',
        preparedBy: 'Alex Inspector',
        workInspected: 'Slab Area B',
        slump: '4 in',
      },
      selectedProject: {
        id: 'p1',
        name: 'Riverside Remodel',
        clientInfo: { clientName: 'Jane Owner' },
        jobsiteAddress: null,
      } as never,
      companySettings: {
        companyName: 'AC Concrete',
        address: '1 Main St',
        phone: '555-0100',
        email: 'qc@ac.com',
        licenseNumber: 'LIC-1',
        motto: '',
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
    });

    expect(view.documentNumber).toBe('QC-12');
    expect(view.documentTitle).toContain('QC Report');
    expect(view.inspectionType).toBe('Concrete Placement Inspection');
    expect(view.status).toBe('Passed');
    expect(view.slump).toBe('4 in');
    expect(view.project.name).toBe('Riverside Remodel');
  });
});
