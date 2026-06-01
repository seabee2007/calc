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

  return factors;
}
