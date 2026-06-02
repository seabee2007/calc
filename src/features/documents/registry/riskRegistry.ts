import type { DocumentInput, DocumentRiskFactor, DocumentType } from '../types';
import { getAnswer, getProjectType } from '../engine/inputUtils';
import { getQuestions } from './questionnaireRegistry';

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

export function getDeclarativeQuestions(documentType: DocumentType) {
  return getQuestions(documentType);
}

export function evaluateDerivedRisk(input: DocumentInput): DocumentRiskFactor[] {
  const factors: DocumentRiskFactor[] = [];
  const projectType = getProjectType(input);

  if (projectType === 'insurance_restoration') {
    factors.push({
      key: 'project.insurance_restoration',
      label: 'Insurance restoration adds carrier, adjuster, and scope-approval dependencies.',
      points: 20,
    });
  }
  if (projectType === 'concrete') {
    factors.push({
      key: 'project.concrete',
      label: 'Concrete work carries weather, cracking, and ready-mix delivery exposure.',
      points: 5,
    });
  }

  const yearBuilt = toNumber(getAnswer(input, 'yearBuilt'));
  if (yearBuilt !== undefined && yearBuilt < 1980) {
    factors.push({
      key: 'property.older_home',
      label: 'Older structures are more likely to hide code, structural, or hazardous-material issues.',
      points: 10,
    });
  }

  const contractValue =
    toNumber(getAnswer(input, 'contractPrice')) ?? toNumber(getAnswer(input, 'estimatedTotal'));
  if (contractValue !== undefined && contractValue >= 100000) {
    factors.push({
      key: 'pricing.high_value',
      label: 'Higher contract value increases financial exposure on a dispute.',
      points: 10,
    });
  }

  if (input.documentType === 'change_order') {
    const coAmount = toNumber(getAnswer(input, 'totalChangeOrderAmount'));
    if (coAmount !== undefined && coAmount >= 50000) {
      factors.push({
        key: 'co.high_value',
        label: 'High change order amount increases financial exposure.',
        points: 10,
      });
    }

    const hasScheduleImpact = getAnswer(input, 'scheduleImpact');
    if (hasScheduleImpact && String(hasScheduleImpact).trim()) {
      factors.push({
        key: 'co.schedule_impact',
        label: 'Schedule impact documented — review contract extension provisions.',
        points: 5,
      });
    }

    const originalAmount = getAnswer(input, 'originalContractAmount');
    if (originalAmount === undefined || originalAmount === null || originalAmount === '') {
      factors.push({
        key: 'co.missing_original_contract',
        label: 'Original contract amount not provided — revised contract value cannot be calculated.',
        points: 5,
      });
    }

    const revisedDate = getAnswer(input, 'revisedCompletionDate');
    const additionalDays = toNumber(getAnswer(input, 'additionalCalendarDays'));
    const hasScheduleText = hasScheduleImpact && String(hasScheduleImpact).trim();
    if (hasScheduleText && additionalDays && additionalDays > 0 && !revisedDate) {
      factors.push({
        key: 'co.missing_revised_completion',
        label: 'Revised completion date not set — schedule exposure is undocumented.',
        points: 5,
      });
    }
  }

  return factors;
}
