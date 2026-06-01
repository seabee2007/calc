import { describe, expect, it } from 'vitest';
import { evaluateDocumentCompliance, evaluateExportPolicy } from './complianceEngine';
import type { DocumentInput } from '../types';

function makeInput(packKey = 'GENERIC_RESIDENTIAL'): DocumentInput {
  return {
    documentType: 'residential_contract',
    packKey,
    answers: {
      projectType: 'remodel',
      priceModel: 'fixed_price',
      contractorLegalName: 'Acme',
      ownerFullName: 'Jane',
      propertyAddress: '1 Main St',
      scopeSummary: 'Kitchen remodel',
      contractPrice: 25000,
    },
    facts: {},
  };
}

describe('evaluateExportPolicy', () => {
  it('allows preview but blocks final export for the generic draft-only pack', () => {
    const policy = evaluateExportPolicy(makeInput());
    expect(policy.allowPreview).toBe(true);
    expect(policy.allowFinalExport).toBe(false);
    expect(policy.reason).toBeTruthy();
  });

  it('blocks final export when a blocker is present', () => {
    const policy = evaluateExportPolicy(makeInput(), true);
    expect(policy.allowFinalExport).toBe(false);
    expect(policy.reason).toMatch(/blocking/i);
  });
});

describe('evaluateDocumentCompliance', () => {
  it('produces a draft-only info note for the generic pack and stays compliant', () => {
    const result = evaluateDocumentCompliance(makeInput());
    expect(result.compliant).toBe(true);
    expect(result.canFinalExport).toBe(false);
    expect(result.issues.some((i) => i.code === 'draft_only')).toBe(true);
  });

  it('flags attorney-review-required state packs as a warning', () => {
    const result = evaluateDocumentCompliance(makeInput('CA_RESIDENTIAL'));
    const review = result.issues.find((i) => i.code === 'attorney_review_required');
    expect(review).toBeDefined();
    expect(review?.severity).toBe('warning');
    expect(result.canFinalExport).toBe(false);
  });

  it('warns about unanswered required fields', () => {
    const input: DocumentInput = {
      documentType: 'residential_contract',
      packKey: 'GENERIC_RESIDENTIAL',
      answers: { projectType: 'remodel' },
      facts: {},
    };
    const result = evaluateDocumentCompliance(input);
    expect(result.issues.some((i) => i.code.startsWith('missing_field:'))).toBe(true);
  });
});
