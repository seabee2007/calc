import type { ContractAnswers } from './contractInput';
import { isDateQuestionKey, normalizeDateValue } from '../../../utils/dateInput';

const WORK_HOURS_PATTERN = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;

const PUNCH_ITEM_DATE_KEYS = ['dueDate', 'completionDate', 'verificationDate'] as const;

function normalizePunchItemDates(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const next = { ...(row as Record<string, unknown>) };
    for (const key of PUNCH_ITEM_DATE_KEYS) {
      const raw = next[key];
      if (typeof raw === 'string' && raw.trim()) {
        next[key] = normalizeDateValue(raw);
      }
    }
    return next;
  });
}

function normalizeDateAnswers(answers: ContractAnswers): ContractAnswers {
  let changed = false;
  const next: ContractAnswers = { ...answers };

  for (const [key, value] of Object.entries(answers)) {
    if (key === 'punchItems') continue;
    if (!isDateQuestionKey(key) || typeof value !== 'string' || !value.trim()) continue;
    const normalized = normalizeDateValue(value);
    if (normalized !== value) {
      next[key] = normalized;
      changed = true;
    }
  }

  if (Array.isArray(answers.punchItems)) {
    const normalizedItems = normalizePunchItemDates(answers.punchItems);
    if (JSON.stringify(normalizedItems) !== JSON.stringify(answers.punchItems)) {
      next.punchItems = normalizedItems;
      changed = true;
    }
  }

  return changed ? next : answers;
}

/** Split legacy `workHours` string into start/end fields when loading saved drafts. */
export function normalizeContractAnswers(answers: ContractAnswers): ContractAnswers {
  const withDates = normalizeDateAnswers(answers);

  if (withDates.workStartTime || withDates.workEndTime) return withDates;
  const workHours = typeof withDates.workHours === 'string' ? withDates.workHours.trim() : '';
  if (!workHours) return withDates;

  const match = workHours.match(WORK_HOURS_PATTERN);
  if (!match) return withDates;

  return {
    ...withDates,
    workStartTime: match[1].padStart(5, '0'),
    workEndTime: match[2].padStart(5, '0'),
  };
}
