import type { ContractAnswers } from './contractInput';

const WORK_HOURS_PATTERN = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;

/** Split legacy `workHours` string into start/end fields when loading saved drafts. */
export function normalizeContractAnswers(answers: ContractAnswers): ContractAnswers {
  if (answers.workStartTime || answers.workEndTime) return answers;
  const workHours = typeof answers.workHours === 'string' ? answers.workHours.trim() : '';
  if (!workHours) return answers;

  const match = workHours.match(WORK_HOURS_PATTERN);
  if (!match) return answers;

  return {
    ...answers,
    workStartTime: match[1].padStart(5, '0'),
    workEndTime: match[2].padStart(5, '0'),
  };
}
