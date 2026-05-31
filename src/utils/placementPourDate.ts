/**
 * Placement pour date/time — local calendar date + start time encoded in pour_date ISO.
 */

const DATE_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date (YYYY-MM-DD) in the user's local timezone from a pour_date ISO string. */
export function placementDateYmdFromIso(pourDateIso?: string | null): string | null {
  if (!pourDateIso?.trim()) return null;
  const d = new Date(pourDateIso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build pour_date ISO from local calendar date and optional HH:mm (defaults 07:00). */
export function buildPlacementPourDateIso(
  dateYmd: string,
  timeHHmm?: string | null,
): string {
  const match = DATE_YMD.exec(dateYmd.trim());
  if (!match) {
    throw new Error('Invalid placement date');
  }
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const timeMatch = (timeHHmm?.trim() || '07:00').match(/^(\d{1,2}):(\d{2})/);
  const h = timeMatch ? Math.min(23, Math.max(0, parseInt(timeMatch[1], 10))) : 7;
  const min = timeMatch ? Math.min(59, Math.max(0, parseInt(timeMatch[2], 10))) : 0;
  const local = new Date(y, m - 1, d, h, min, 0, 0);
  if (Number.isNaN(local.getTime())) {
    throw new Error('Invalid placement date');
  }
  return local.toISOString();
}

/** Resolve placement day from planner selection or saved project / order. */
export function resolvePlacementDateYmd(
  selectedDate: string | null | undefined,
  project?: {
    pourDate?: string | null;
    placementOrder?: { pourDateIso?: string | null } | null;
  } | null,
): string | null {
  if (selectedDate?.trim()) return selectedDate.trim();
  const fromOrder = placementDateYmdFromIso(project?.placementOrder?.pourDateIso);
  if (fromOrder) return fromOrder;
  return placementDateYmdFromIso(project?.pourDate);
}

/** Human-readable placement date/time for dashboards and project cards. */
export function formatPlacementPourDateTime(
  pourDateIso?: string | null,
  options?: { includeWeekday?: boolean },
): string | null {
  if (!pourDateIso?.trim()) return null;
  const d = new Date(pourDateIso);
  if (Number.isNaN(d.getTime())) return null;

  const weekday = options?.includeWeekday !== false;
  const datePart = d.toLocaleDateString(undefined, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return weekday ? `${datePart} • ${timePart}` : `${datePart} at ${timePart}`;
}
