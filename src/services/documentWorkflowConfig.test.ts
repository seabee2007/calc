import { describe, expect, it } from 'vitest';
import {
  getDocumentWorkflowFieldSections,
  getDocumentWorkflowStatusOptions,
  getPlannerDocumentDrawerMeta,
  getPlannerDocumentPrimaryActionLabel,
  normalizePlannerDocumentType,
} from './documentWorkflowConfig';

describe('documentWorkflowConfig', () => {
  it('returns non-empty status options for each planner document type', () => {
    const types = [
      'residential_contract',
      'submittal',
      'daily_report',
      'qc_report',
      'warranty_letter',
      'punch_list',
      'rfi',
      'far',
      'change_order',
    ];
    for (const t of types) {
      const options = getDocumentWorkflowStatusOptions(t);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toBe('Draft');
    }
  });

  it('normalizes contract aliases to residential_contract', () => {
    expect(normalizePlannerDocumentType('contract')).toBe('residential_contract');
    expect(normalizePlannerDocumentType('closeout_document')).toBe('warranty_letter');
  });

  it('returns stable primary action labels', () => {
    expect(getPlannerDocumentPrimaryActionLabel('rfi')).toBe('View / Respond');
    expect(getPlannerDocumentPrimaryActionLabel('far')).toBe('View / Review');
    expect(getPlannerDocumentPrimaryActionLabel('submittal')).toBe('Review');
    expect(getPlannerDocumentPrimaryActionLabel('residential_contract')).toBe('View / Update');
  });

  it('returns drawer meta per type', () => {
    expect(getPlannerDocumentDrawerMeta('rfi').saveLabel).toBe('Save response');
    expect(getPlannerDocumentDrawerMeta('far').saveLabel).toBe('Save review');
    expect(getPlannerDocumentDrawerMeta('submittal').drawerTitle).toBe('Submittal');
  });

  it('returns field sections with editable keys for submittal', () => {
    const sections = getDocumentWorkflowFieldSections('submittal');
    expect(sections.detailKeys.some((f) => f.key === 'submittalNumber')).toBe(true);
    expect(sections.editableKeys.some((f) => f.key === 'reviewerComments')).toBe(true);
  });
});
