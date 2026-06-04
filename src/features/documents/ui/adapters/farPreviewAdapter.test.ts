import { describe, expect, it } from 'vitest';
import { buildFarPreviewFromDocumentAnswers } from './farPreviewAdapter';

describe('buildFarPreviewFromDocumentAnswers', () => {
  it('maps FAR answers to view model', () => {
    const view = buildFarPreviewFromDocumentAnswers({
      answers: {
        farNumber: 'FAR-01',
        title: 'Slab adjustment',
        description: 'Grade change',
        status: 'Submitted',
      },
      selectedProject: null,
      companySettings: {
        companyName: 'Test Co',
        address: '',
        phone: '',
        email: '',
        licenseNumber: '',
        motto: '',
        taxSystem: 'none',
        taxRatePercent: 0,
        taxApplication: 'materials_only',
      },
      title: 'Slab adjustment',
    });
    expect(view.documentNumber).toBe('FAR-01');
    expect(view.status).toBe('Submitted');
    expect(view.description).toBe('Grade change');
  });
});
