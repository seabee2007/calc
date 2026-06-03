import { describe, expect, it } from 'vitest';
import { countProjectDocumentsNavTotal } from './projectTabCounts';
import type { ProjectDocumentRow } from './projectDocumentService';

function row(partial: Partial<ProjectDocumentRow> & { document_type: string; pack_key: string }): ProjectDocumentRow {
  return {
    id: partial.id ?? '1',
    user_id: 'u',
    project_id: 'p',
    title: 'Test',
    status: 'draft',
    latest_version_number: 1,
    created_at: '',
    updated_at: '',
    ...partial,
  } as ProjectDocumentRow;
}

describe('countProjectDocumentsNavTotal', () => {
  it('sums document-category builder rows plus field tools', () => {
    const docs = [
      row({ id: 'c', document_type: 'residential_contract', pack_key: 'GENERIC_RESIDENTIAL' }),
      row({ id: 'dr', document_type: 'daily_report', pack_key: 'GENERIC_DAILY_REPORT' }),
    ];
    expect(countProjectDocumentsNavTotal(docs, 2, 1)).toBe(5);
  });

  it('excludes RFI, FAR, and change order builder documents', () => {
    const docs = [
      row({ id: 'rfi', document_type: 'rfi', pack_key: 'GENERIC_RFI' }),
      row({ id: 'co', document_type: 'change_order', pack_key: 'GENERIC_CHANGE_ORDER' }),
      row({ id: 'far', document_type: 'far', pack_key: '' }),
      row({ id: 'dr', document_type: 'daily_report', pack_key: 'GENERIC_DAILY_REPORT' }),
    ];
    expect(countProjectDocumentsNavTotal(docs, 0, 0)).toBe(1);
  });
});
