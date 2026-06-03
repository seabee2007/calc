import { describe, expect, it } from 'vitest';
import {
  filterDocumentsTabBuilderDocuments,
  getProjectDocumentDisplayMeta,
  isChangeOrderBuilderDocument,
  isDocumentsTabBuilderDocument,
  resolveEffectiveDocumentType,
} from './projectDocumentDisplay';
import type { ProjectDocumentRow } from './projectDocumentService';

function row(partial: Partial<ProjectDocumentRow> & { document_type: string; pack_key: string }): ProjectDocumentRow {
  return {
    id: '1',
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

describe('projectDocumentDisplay', () => {
  it('resolves daily report from pack_key when document_type is wrong', () => {
    const doc = row({ document_type: 'change_order', pack_key: 'GENERIC_DAILY_REPORT' });
    expect(resolveEffectiveDocumentType(doc)).toBe('daily_report');
    expect(isChangeOrderBuilderDocument(doc)).toBe(false);
    expect(getProjectDocumentDisplayMeta(doc).subtitleLabel).toBe('Daily Report');
  });

  it('keeps change order drafts in change order bucket', () => {
    const doc = row({ document_type: 'change_order', pack_key: 'GENERIC_CHANGE_ORDER' });
    expect(isChangeOrderBuilderDocument(doc)).toBe(true);
  });

  it('excludes mis-typed daily reports from change orders and documents tab CO bucket', () => {
    const doc = row({ document_type: 'change_order', pack_key: 'GENERIC_DAILY_REPORT' });
    expect(isChangeOrderBuilderDocument(doc)).toBe(false);
    expect(isDocumentsTabBuilderDocument(doc)).toBe(true);
    expect(getProjectDocumentDisplayMeta(doc).group).toBe('Daily Reports');
  });

  it('routes GENERIC_WARRANTY_CLOSEOUT pack to Closeout / Warranty group', () => {
    const doc = row({
      document_type: 'residential_contract',
      pack_key: 'GENERIC_WARRANTY_CLOSEOUT',
      id: 'wc',
    });
    expect(resolveEffectiveDocumentType(doc)).toBe('warranty_letter');
    expect(getProjectDocumentDisplayMeta(doc).group).toBe('Closeout / Warranty');
    const grouped = filterDocumentsTabBuilderDocuments([doc]);
    expect(grouped.closeout.map((d) => d.id)).toEqual(['wc']);
  });

  it('routes GENERIC_PUNCH_LIST pack to Punch Lists group', () => {
    const doc = row({
      document_type: 'residential_contract',
      pack_key: 'GENERIC_PUNCH_LIST',
      id: 'pl',
    });
    expect(resolveEffectiveDocumentType(doc)).toBe('punch_list');
    expect(getProjectDocumentDisplayMeta(doc).group).toBe('Punch Lists');
    const grouped = filterDocumentsTabBuilderDocuments([doc]);
    expect(grouped.punchLists.map((d) => d.id)).toEqual(['pl']);
  });

  it('routes GENERIC_QC_REPORT pack to QC Reports group', () => {
    const doc = row({ document_type: 'residential_contract', pack_key: 'GENERIC_QC_REPORT', id: 'qc' });
    expect(resolveEffectiveDocumentType(doc)).toBe('qc_report');
    expect(getProjectDocumentDisplayMeta(doc).group).toBe('QC Reports');
    const grouped = filterDocumentsTabBuilderDocuments([doc]);
    expect(grouped.qcReports.map((d) => d.id)).toEqual(['qc']);
  });

  it('routes GENERIC_FAR pack to FAR group and excludes from documents tab', () => {
    const doc = row({
      document_type: 'residential_contract',
      pack_key: 'GENERIC_FAR',
      id: 'far1',
    });
    expect(resolveEffectiveDocumentType(doc)).toBe('far');
    expect(getProjectDocumentDisplayMeta(doc).group).toBe('FARs');
    const grouped = filterDocumentsTabBuilderDocuments([doc]);
    expect(grouped.contracts.length + grouped.other.length).toBe(0);
  });

  it('groups documents tab rows correctly', () => {
    const docs = [
      row({ document_type: 'change_order', pack_key: 'GENERIC_DAILY_REPORT', id: 'dr' }),
      row({ document_type: 'submittal', pack_key: 'GENERIC_SUBMITTAL', id: 's' }),
      row({ document_type: 'residential_contract', pack_key: 'GENERIC_RESIDENTIAL', id: 'c' }),
    ];
    const grouped = filterDocumentsTabBuilderDocuments(docs);
    expect(grouped.dailyReports.map((d) => d.id)).toEqual(['dr']);
    expect(grouped.submittals.map((d) => d.id)).toEqual(['s']);
    expect(grouped.contracts.map((d) => d.id)).toEqual(['c']);
  });
});
