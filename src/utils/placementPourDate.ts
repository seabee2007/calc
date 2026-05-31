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

/** HH:mm from placement order (planner field, then call sheet summary). */
export function parsePlacementStartTimeFromOrder(
  order?: {
    pourStartTime?: string | null;
    summaryLines?: string[] | null;
  } | null,
): string {
  if (order?.pourStartTime?.trim()) {
    const m = order.pourStartTime.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      return `${String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')}:${m[2]}`;
    }
  }
  const lines = order?.summaryLines;
  if (lines?.length) {
    for (const line of lines) {
      const m = line.match(/Requested Start Time:\s*(.+)/i);
      if (m) {
        const inner = m[1].match(/\((\d{1,2}:\d{2})\)/);
        if (inner) return inner[1];
        if (/^\d{1,2}:\d{2}/.test(m[1].trim())) return m[1].trim().slice(0, 5);
      }
    }
  }
  return '07:00';
}

/**
 * Local placement moment for scheduling: calendar day from ISO + start time from order.
 * Avoids UTC midnight shifting the pour to the previous calendar day.
 */
export function parsePlacementPourMoment(
  pourDateIso?: string | null,
  order?: {
    pourDateIso?: string | null;
    pourStartTime?: string | null;
    summaryLines?: string[] | null;
  } | null,
): Date | null {
  const ymd =
    placementDateYmdFromIso(pourDateIso) ??
    placementDateYmdFromIso(order?.pourDateIso);
  if (!ymd) return null;
  try {
    return new Date(buildPlacementPourDateIso(ymd, parsePlacementStartTimeFromOrder(order)));
  } catch {
    return null;
  }
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
