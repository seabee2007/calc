import { describe, expect, it, vi } from 'vitest';
import {
  formatRecordNumber,
  isFormattedRecordNumber,
  maxSequenceFromValues,
  nextRecordNumber,
  parseRecordSequence,
  resolveFarDisplayNumber,
  resolveFarNumberForSave,
  resolveRfiDisplayNumber,
  resolveRfiNumberForSave,
} from './projectRecordNumbering';

vi.mock('./rfiService', () => ({
  fetchRfisForProject: vi.fn(async () => [
    { displayNumber: 'RFI-001' },
    { displayNumber: 'RFI-003' },
  ]),
}));

vi.mock('./fieldAdjustmentService', () => ({
  fetchAdjustmentsForProject: vi.fn(async () => [{ displayNumber: 'FAR-002' }]),
}));

vi.mock('../features/documents/services/contractDocumentService', () => ({
  listContractDocuments: vi.fn(async (projectId: string) => {
    if (projectId === 'proj-far') {
      return [{ document_number: 'FAR-001', document_type: 'far', pack_key: 'GENERIC_FAR' }];
    }
    return [{ document_number: 'RFI-002', document_type: 'rfi', pack_key: 'GENERIC_RFI' }];
  }),
}));

describe('projectRecordNumbering', () => {
  it('parses and formats record numbers', () => {
    expect(parseRecordSequence('RFI', 'RFI-001')).toBe(1);
    expect(parseRecordSequence('RFI', 'rfi-12')).toBe(12);
    expect(parseRecordSequence('RFI', '001', { allowBareDigits: true })).toBe(1);
    expect(formatRecordNumber('RFI', 2)).toBe('RFI-002');
    expect(isFormattedRecordNumber('RFI', 'RFI-001')).toBe(true);
    expect(isFormattedRecordNumber('RFI', '5463456')).toBe(false);
  });

  it('computes next number from mixed values', () => {
    expect(maxSequenceFromValues('RFI', ['RFI-001', 'RFI-010', null])).toBe(10);
    expect(nextRecordNumber('RFI', ['RFI-001', 'RFI-003'])).toBe('RFI-004');
  });

  it('getNextRfiNumber considers legacy and builder sources', async () => {
    const { getNextRfiNumber } = await import('./projectRecordNumbering');
    expect(await getNextRfiNumber('proj-1')).toBe('RFI-004');
  });

  it('getNextFarNumber considers legacy and builder sources', async () => {
    const { getNextFarNumber } = await import('./projectRecordNumbering');
    expect(await getNextFarNumber('proj-far')).toBe('FAR-003');
  });

  it('resolveRfiNumberForSave preserves formatted existing parent number', async () => {
    const n = await resolveRfiNumberForSave({
      projectId: 'p',
      answers: {},
      existingDocumentNumber: 'RFI-007',
    });
    expect(n).toBe('RFI-007');
  });

  it('resolveRfiNumberForSave auto-assigns when empty', async () => {
    const n = await resolveRfiNumberForSave({
      projectId: 'proj-1',
      answers: {},
    });
    expect(n).toBe('RFI-004');
  });

  it('resolveRfiNumberForSave preserves user-typed non-formatted value', async () => {
    const n = await resolveRfiNumberForSave({
      projectId: 'proj-1',
      answers: { rfiNumber: '5463456' },
    });
    expect(n).toBe('5463456');
  });

  it('resolveFarNumberForSave mirrors FAR logic', async () => {
    expect(
      await resolveFarNumberForSave({
        projectId: 'p',
        answers: {},
        existingDocumentNumber: 'FAR-005',
      }),
    ).toBe('FAR-005');
  });

  it('resolveRfiDisplayNumber uses document_number first', () => {
    expect(
      resolveRfiDisplayNumber(
        { document_number: 'RFI-002', title: 'Subject' },
        { rfiNumber: 'RFI-099' },
      ),
    ).toBe('RFI-002');
  });

  it('resolveRfiDisplayNumber falls back to answers then title', () => {
    expect(resolveRfiDisplayNumber({ document_number: null, title: 'RFI-005 Question' }, { rfiNumber: 'RFI-003' })).toBe(
      'RFI-003',
    );
    expect(resolveRfiDisplayNumber({ document_number: null, title: 'RFI-007 site issue' })).toBe('RFI-007');
    expect(resolveRfiDisplayNumber({ document_number: null, title: 'General question' })).toBe('—');
  });

  it('resolveFarDisplayNumber uses document_number first', () => {
    expect(resolveFarDisplayNumber({ document_number: 'FAR-001', title: 'T' })).toBe('FAR-001');
  });
});
