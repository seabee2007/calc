/** Known stored enum values → display labels (lowercase keys). */
const KNOWN_ENUM_LABELS: Record<string, string> = {
  not_completed: 'Not Completed',
  not_applicable: 'Not Applicable',
  under_review: 'Under Review',
  approved_as_noted: 'Approved as Noted',
  revise_and_resubmit: 'Revise and Resubmit',
  corrective_action_required: 'Corrective Action Required',
  reinspection_required: 'Reinspection Required',
  in_progress: 'In Progress',
  ready_for_review: 'Ready for Review',
  passed_with_notes: 'Passed with Notes',
  punch_list_required: 'Punch List Required',
  manufacturer_only: 'Manufacturer Warranty Only',
  no_warranty: 'No Warranty',
  gross_receipts_tax: 'Gross Receipts Tax',
  materials_and_equipment: 'Materials and Equipment',
};

function titleCasePart(part: string): string {
  if (!part) return part;
  const digitSuffix = part.match(/^(\d+)([a-z]+)$/i);
  if (digitSuffix) {
    const [, num, word] = digitSuffix;
    return `${num} ${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  }
  if (/^\d+$/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function titleCaseFromDelimiters(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map(titleCasePart)
    .join(' ');
}

function looksLikeEnumKey(value: string): boolean {
  const lower = value.toLowerCase();
  if (KNOWN_ENUM_LABELS[lower]) return true;
  if (/^[a-z0-9]+([_-][a-z0-9]+)+$/.test(lower)) return true;
  return /^[a-z]+$/.test(lower) && lower.length > 1;
}

/**
 * Format stored enum/snake_case values for display. Does not mutate stored data.
 */
export function formatEnumLabel(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '—';

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '—';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return '—';

  const lower = trimmed.toLowerCase();
  if (KNOWN_ENUM_LABELS[lower]) return KNOWN_ENUM_LABELS[lower];

  if (trimmed.includes('_') || trimmed.includes('-')) {
    return titleCaseFromDelimiters(trimmed);
  }

  if (/^[A-Z]/.test(trimmed) || /\s/.test(trimmed)) {
    return trimmed;
  }

  if (looksLikeEnumKey(trimmed)) {
    return titleCaseFromDelimiters(trimmed);
  }

  if (/^[a-z]+$/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return trimmed;
}
