import { describe, expect, it } from 'vitest';
import { scoreDocumentRisk } from './riskEngine';
import type { DocumentInput } from '../types';

function makeInput(answers: Record<string, unknown>): DocumentInput {
  return { documentType: 'residential_contract', packKey: 'GENERIC_RESIDENTIAL', answers, facts: {} };
}

describe('scoreDocumentRisk', () => {
  it('scores a minimal fixed-price job as low risk', () => {
    const risk = scoreDocumentRisk(makeInput({ projectType: 'remodel', priceModel: 'fixed_price' }));
    expect(risk.score).toBe(0);
    expect(risk.level).toBe('low');
  });

  it('accumulates declarative risk signals', () => {
    const risk = scoreDocumentRisk(
      makeInput({ priceModel: 'time_and_materials', changeOrderProcess: 'verbal_ok' }),
    );
    // 15 (T&M) + 10 (verbal changes) = 25 -> medium
    expect(risk.score).toBe(25);
    expect(risk.level).toBe('medium');
    expect(risk.factors.some((f) => f.key === 'pricing.tm')).toBe(true);
    expect(risk.factors.some((f) => f.key === 'change.verbal')).toBe(true);
  });

  it('adds derived project-type and threshold factors', () => {
    const risk = scoreDocumentRisk(
      makeInput({ projectType: 'insurance_restoration', yearBuilt: 1975, contractPrice: 150000 }),
    );
    expect(risk.factors.some((f) => f.key === 'project.insurance_restoration')).toBe(true);
    expect(risk.factors.some((f) => f.key === 'property.older_home')).toBe(true);
    expect(risk.factors.some((f) => f.key === 'pricing.high_value')).toBe(true);
  });

  it('clamps the score to 0-100', () => {
    const risk = scoreDocumentRisk(
      makeInput({
        projectType: 'insurance_restoration',
        priceModel: 'time_and_materials',
        changeOrderProcess: 'verbal_ok',
        hoa: true,
        ownerSuppliedMaterials: true,
        financing: true,
        allowances: true,
        hazardousMaterialsPossible: true,
        yearBuilt: 1950,
        contractPrice: 500000,
      }),
    );
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
  });
});
