import { formatEnumLabel } from '../../../utils/formatEnumLabel';

export function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function formatPlannerDisplayValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || t === 'undefined' || t === 'null') return '—';
    if (t.startsWith('{') || t.startsWith('[')) return '—';
    return formatEnumLabel(t);
  }
  if (typeof v === 'number' || typeof v === 'boolean') return formatEnumLabel(v);
  return '—';
}

export function answerDisplayValue(
  answers: Record<string, unknown>,
  key: string,
): string {
  const v = answers[key];
  if (key === 'question' && !str(v)) {
    return formatPlannerDisplayValue(answers.rfiTitle ?? answers.question);
  }
  if (key === 'description' && !str(v)) {
    return formatPlannerDisplayValue(answers.description ?? answers.title);
  }
  if (key === 'ownerName' && !str(v)) {
    return formatPlannerDisplayValue(answers.ownerName ?? answers.clientName);
  }
  return formatPlannerDisplayValue(v);
}
