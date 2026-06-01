import { describe, expect, it } from 'vitest';
import {
  buildQuestionnaire,
  findMissingRequiredAnswers,
  isQuestionRequired,
  isQuestionVisible,
  resolveVisibleQuestions,
} from './questionnaireEngine';

describe('buildQuestionnaire', () => {
  it('includes only questions at or below the requested mode', () => {
    const quick = buildQuestionnaire('residential_contract', 'quick');
    expect(quick.questions.length).toBeGreaterThan(0);
    expect(quick.questions.every((q) => q.mode === 'quick')).toBe(true);
  });

  it('advanced is a superset of quick', () => {
    const quick = buildQuestionnaire('residential_contract', 'quick');
    const advanced = buildQuestionnaire('residential_contract', 'advanced');
    expect(advanced.questions.length).toBeGreaterThan(quick.questions.length);
  });
});

describe('visibility and requiredness rules', () => {
  it('hides project-type-branched questions until the branch is selected', () => {
    const advanced = buildQuestionnaire('residential_contract', 'advanced');
    const withoutType = resolveVisibleQuestions(advanced, {});
    const withConcrete = resolveVisibleQuestions(advanced, { projectType: 'concrete' });
    expect(withoutType.some((q) => q.questionKey === 'concretePsi')).toBe(false);
    expect(withConcrete.some((q) => q.questionKey === 'concretePsi')).toBe(true);
  });

  it('evaluates visibleWhen for a single question', () => {
    const advanced = buildQuestionnaire('residential_contract', 'advanced');
    const contractPrice = advanced.questions.find((q) => q.questionKey === 'contractPrice');
    expect(contractPrice).toBeDefined();
    expect(isQuestionVisible(contractPrice!, { priceModel: 'fixed_price' })).toBe(true);
    expect(isQuestionVisible(contractPrice!, { priceModel: 'time_and_materials' })).toBe(false);
  });

  it('applies requiredWhen conditionally', () => {
    const advanced = buildQuestionnaire('residential_contract', 'advanced');
    const contractPrice = advanced.questions.find((q) => q.questionKey === 'contractPrice');
    expect(isQuestionRequired(contractPrice!, { priceModel: 'fixed_price' })).toBe(true);
    expect(isQuestionRequired(contractPrice!, { priceModel: 'cost_plus' })).toBe(false);
  });
});

describe('findMissingRequiredAnswers', () => {
  it('reports unanswered always-required questions', () => {
    const quick = buildQuestionnaire('residential_contract', 'quick');
    const missing = findMissingRequiredAnswers(quick, {});
    expect(missing).toContain('projectType');
    expect(missing).toContain('scopeSummary');
  });

  it('does not report answered questions', () => {
    const quick = buildQuestionnaire('residential_contract', 'quick');
    const missing = findMissingRequiredAnswers(quick, {
      projectType: 'remodel',
      priceModel: 'fixed_price',
      contractorLegalName: 'Acme',
      ownerFullName: 'Jane',
      propertyAddress: '1 Main St',
      scopeSummary: 'Kitchen',
      contractPrice: 1000,
    });
    expect(missing).not.toContain('projectType');
    expect(missing).not.toContain('contractPrice');
  });
});
