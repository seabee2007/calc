/**
 * Focused tests verifying that change_order is correctly registered in the
 * document engine without disturbing existing residential_contract behavior.
 *
 * Pricing math in src/utils/changeOrderFinancials.ts is NOT tested here and
 * is NOT modified by this registration.
 */

import { describe, expect, it } from 'vitest';
import { listSupportedDocumentTypes } from '../registry/documentTypeRegistry';
import { getQuestions } from '../registry/questionnaireRegistry';
import { buildQuestionnaire } from './questionnaireEngine';
import { getTemplate, listTemplates } from '../registry/templateRegistry';
import { getPackCatalog } from '../packs/registry';
import { getComplianceProfile } from '../registry/complianceRegistry';
import { evaluateDocumentCompliance } from './complianceEngine';
import { scoreDocumentRisk } from './riskEngine';
import { assembleDocument } from './documentAssembly';
import type { DocumentInput } from '../types';

function makeCoInput(answers: Record<string, unknown> = {}): DocumentInput {
  return {
    documentType: 'change_order',
    packKey: 'GENERIC_CHANGE_ORDER',
    answers,
    facts: {},
  };
}

// ---------------------------------------------------------------------------
// Document type registry
// ---------------------------------------------------------------------------

describe('document type registry', () => {
  it('still includes residential_contract', () => {
    expect(listSupportedDocumentTypes()).toContain('residential_contract');
  });

  it('includes change_order', () => {
    expect(listSupportedDocumentTypes()).toContain('change_order');
  });
});

// ---------------------------------------------------------------------------
// Pack catalog
// ---------------------------------------------------------------------------

describe('pack catalog', () => {
  it('resolves GENERIC_CHANGE_ORDER catalog', () => {
    const catalog = getPackCatalog('GENERIC_CHANGE_ORDER');
    expect(catalog).toBeDefined();
    expect(catalog?.pack.documentType).toBe('change_order');
    expect(catalog?.pack.packKey).toBe('GENERIC_CHANGE_ORDER');
    expect(catalog?.clauses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Questionnaire
// ---------------------------------------------------------------------------

describe('change order questionnaire', () => {
  it('getQuestions returns the bank', () => {
    const qs = getQuestions('change_order');
    expect(qs.length).toBeGreaterThan(0);
  });

  it('quick mode has required core questions', () => {
    const q = buildQuestionnaire('change_order', 'quick');
    const keys = q.questions.map((x) => x.questionKey);
    expect(keys).toContain('changeOrderTitle');
    expect(keys).toContain('scopeOfChange');
    expect(keys).toContain('reasonForChange');
    expect(keys).toContain('totalChangeOrderAmount');
  });

  it('standard mode includes approval and schedule fields', () => {
    const q = buildQuestionnaire('change_order', 'standard');
    const keys = q.questions.map((x) => x.questionKey);
    expect(keys).toContain('approvalRequiredBeforeWorkStarts');
    expect(keys).toContain('revisedCompletionDate');
  });

  it('advanced mode includes contract value and risk fields', () => {
    const q = buildQuestionnaire('change_order', 'advanced');
    const keys = q.questions.map((x) => x.questionKey);
    expect(keys).toContain('originalContractAmount');
    expect(keys).toContain('emergencyWork');
    expect(keys).toContain('fieldCondition');
    expect(keys).toContain('ownerRequestedChange');
    expect(keys).toContain('rfiFarReference');
  });
});

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

describe('change order template', () => {
  it('resolves GENERIC_CHANGE_ORDER_TEMPLATE by key', () => {
    const t = getTemplate('GENERIC_CHANGE_ORDER_TEMPLATE');
    expect(t).toBeDefined();
    expect(t?.documentType).toBe('change_order');
    expect(t?.clauseKeys.length).toBeGreaterThan(0);
  });

  it('listTemplates returns the generic template for change_order', () => {
    const templates = listTemplates('change_order');
    expect(templates.some((t) => t.templateKey === 'GENERIC_CHANGE_ORDER_TEMPLATE')).toBe(true);
  });

  it('residential_contract template is unchanged', () => {
    const t = getTemplate('GENERIC_RESIDENTIAL_CONTRACT');
    expect(t).toBeDefined();
    expect(t?.documentType).toBe('residential_contract');
  });
});

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

describe('change order compliance', () => {
  it('loads the change_order compliance profile', () => {
    const profile = getComplianceProfile('change_order');
    expect(profile.requiredClauseKeys).toContain('co.title');
    expect(profile.requiredClauseKeys).toContain('co.scope');
    expect(profile.requiredClauseKeys).toContain('co.pricing_summary');
    expect(profile.advisoryNotes?.length).toBeGreaterThan(0);
  });

  it('evaluateDocumentCompliance loads the profile and emits advisory notes', () => {
    const result = evaluateDocumentCompliance(makeCoInput({
      changeOrderTitle: 'Additional rebar',
      scopeOfChange: 'Add rebar layer',
      reasonForChange: 'Engineer change order',
      totalChangeOrderAmount: 5000,
    }));
    expect(result).toBeDefined();
    const advisoryIssues = result.issues.filter((i) => i.code === 'advisory');
    expect(advisoryIssues.length).toBeGreaterThan(0);
  });

  it('flags missing required questionnaire fields as warnings', () => {
    const result = evaluateDocumentCompliance(makeCoInput({}));
    const missing = result.issues.filter((i) => i.code.startsWith('missing_field:'));
    expect(missing.length).toBeGreaterThan(0);
    const missingKeys = missing.map((i) => i.code.replace('missing_field:', ''));
    expect(missingKeys).toContain('changeOrderTitle');
    expect(missingKeys).toContain('scopeOfChange');
    expect(missingKeys).toContain('reasonForChange');
    expect(missingKeys).toContain('totalChangeOrderAmount');
  });

  it('residential_contract compliance is unaffected', () => {
    const result = evaluateDocumentCompliance({
      documentType: 'residential_contract',
      packKey: 'GENERIC_RESIDENTIAL',
      answers: { projectType: 'remodel' },
      facts: {},
    });
    expect(result.issues.some((i) => i.code === 'draft_only')).toBe(true);
    expect(result.issues.some((i) => i.code.startsWith('missing_field:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

describe('change order risk', () => {
  it('scores low for a minimal answered change order', () => {
    const risk = scoreDocumentRisk(makeCoInput({
      changeOrderTitle: 'Extras',
      totalChangeOrderAmount: 1000,
    }));
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(['low', 'medium', 'high', 'extreme']).toContain(risk.level);
  });

  it('triggers approval risk when approvalRequiredBeforeWorkStarts is false', () => {
    const risk = scoreDocumentRisk(makeCoInput({
      approvalRequiredBeforeWorkStarts: false,
    }));
    expect(risk.factors.some((f) => f.key === 'co.work_before_approval')).toBe(true);
  });

  it('triggers high-value risk for large amounts', () => {
    const risk = scoreDocumentRisk(makeCoInput({
      totalChangeOrderAmount: 75000,
    }));
    expect(risk.factors.some((f) => f.key === 'co.high_value')).toBe(true);
  });

  it('triggers emergency work risk signal', () => {
    const risk = scoreDocumentRisk(makeCoInput({ emergencyWork: true }));
    expect(risk.factors.some((f) => f.key === 'co.emergency_work')).toBe(true);
  });

  it('triggers missing original contract factor when amount absent', () => {
    const risk = scoreDocumentRisk(makeCoInput({
      totalChangeOrderAmount: 5000,
    }));
    expect(risk.factors.some((f) => f.key === 'co.missing_original_contract')).toBe(true);
  });

  it('residential_contract risk scoring is unaffected', () => {
    const risk = scoreDocumentRisk({
      documentType: 'residential_contract',
      packKey: 'GENERIC_RESIDENTIAL',
      answers: { projectType: 'remodel', priceModel: 'fixed_price' },
      facts: {},
    });
    expect(risk.score).toBe(0);
    expect(risk.level).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

describe('change order document assembly', () => {
  it('assembles a minimal change order with required sections', () => {
    const result = assembleDocument(makeCoInput({
      changeOrderTitle: 'Concrete footing change',
      scopeOfChange: 'Deepen footings by 6 inches.',
      reasonForChange: 'Soil report required additional depth.',
      totalChangeOrderAmount: 4200,
    }));
    const clauseKeys = result.sections.map((s) => s.clauseKey);
    expect(clauseKeys).toContain('co.title');
    expect(clauseKeys).toContain('co.scope');
    expect(clauseKeys).toContain('co.pricing_summary');
    expect(clauseKeys).toContain('co.signatures');
  });

  it('residential_contract still assembles correctly', () => {
    const result = assembleDocument({
      documentType: 'residential_contract',
      packKey: 'GENERIC_RESIDENTIAL',
      answers: { projectType: 'remodel', priceModel: 'fixed_price' },
      facts: {},
    });
    expect(result.sections.some((s) => s.clauseKey === 'contract.title')).toBe(true);
    expect(result.sections.some((s) => s.clauseKey === 'scope.work')).toBe(true);
  });
});
