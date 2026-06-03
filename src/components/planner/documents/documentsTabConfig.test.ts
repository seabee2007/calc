import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENTS_TAB,
  DOCUMENTS_TAB_IDS,
  documentsTabFromHighlightParams,
  documentsTabLabel,
  isDocumentsTabId,
  parseDocumentsTab,
} from './documentsTabConfig';

describe('documentsTabConfig', () => {
  it('only includes document/file category tabs', () => {
    expect(DOCUMENTS_TAB_IDS).toEqual([
      'contracts',
      'submittals',
      'daily-reports',
      'qc-reports',
      'safety-meetings',
      'punch-lists',
      'closeout',
    ]);
    expect(isDocumentsTabId('rfis')).toBe(false);
    expect(isDocumentsTabId('fars')).toBe(false);
    expect(isDocumentsTabId('change-orders')).toBe(false);
  });

  it('defaults invalid or removed workflow tabs to contracts', () => {
    expect(parseDocumentsTab(null)).toBe(DEFAULT_DOCUMENTS_TAB);
    expect(parseDocumentsTab('invalid')).toBe('contracts');
    expect(parseDocumentsTab('rfis')).toBe('contracts');
    expect(parseDocumentsTab('fars')).toBe('contracts');
    expect(parseDocumentsTab('change-orders')).toBe('contracts');
  });

  it('parses valid tab slugs', () => {
    expect(parseDocumentsTab('punch-lists')).toBe('punch-lists');
    expect(parseDocumentsTab('closeout')).toBe('closeout');
  });

  it('formats labels with optional counts', () => {
    expect(documentsTabLabel('contracts')).toBe('Contracts');
    expect(documentsTabLabel('contracts', 3)).toBe('Contracts (3)');
    expect(documentsTabLabel('contracts', 0)).toBe('Contracts');
  });

  it('maps document highlight params only', () => {
    expect(documentsTabFromHighlightParams({ contract: 'x' })).toBe('contracts');
    expect(documentsTabFromHighlightParams({ safety: 'x' })).toBe('safety-meetings');
    expect(documentsTabFromHighlightParams({ inspection: 'x' })).toBe('qc-reports');
    expect(documentsTabFromHighlightParams({})).toBe(null);
  });
});
