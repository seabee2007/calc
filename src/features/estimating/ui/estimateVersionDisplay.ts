import type { EstimateVersionRow } from '../infrastructure/estimateDbTypes';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export interface EstimateVersionDisplayMetrics {
  totalSellPrice: number | null;
  laborHours: number | null;
  lineItemCount: number | null;
}

/** Sort versions newest first by version_number descending. */
export function sortEstimateVersionsNewestFirst(
  versions: EstimateVersionRow[],
): EstimateVersionRow[] {
  return [...versions].sort((a, b) => b.version_number - a.version_number);
}

/** True when the row id matches the estimate's current_version_id. */
export function isCurrentEstimateVersion(
  versionId: string,
  currentVersionId: string | null | undefined,
): boolean {
  if (!currentVersionId || !versionId) return false;
  return versionId === currentVersionId;
}

/** Safely read final sell price (or direct cost fallback) from totals JSON. */
export function extractSellPriceFromTotalsJson(
  totals: Record<string, unknown> | null | undefined,
): number | null {
  const obj = parseJsonObject(totals);
  if (Object.keys(obj).length === 0) return null;

  const finalSell = toFiniteNumber(obj.finalSellPrice);
  if (finalSell != null) return finalSell;

  return toFiniteNumber(obj.directCost);
}

/** Sum adjusted/labor hours from snapshot line items when present. */
export function extractLaborHoursFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): number | null {
  const obj = parseJsonObject(snapshot);
  const lineItems = obj.lineItems;
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;

  let sum = 0;
  let hasAny = false;

  for (const item of lineItems) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const metrics = (item as Record<string, unknown>).metrics;
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) continue;

    const hours = toFiniteNumber(
      (metrics as Record<string, unknown>).adjustedLaborHours ??
        (metrics as Record<string, unknown>).laborHours,
    );
    if (hours != null) {
      sum += hours;
      hasAny = true;
    }
  }

  return hasAny ? sum : null;
}

/** Line item count from snapshot.lineItems array length. */
export function extractLineItemCountFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): number | null {
  const obj = parseJsonObject(snapshot);
  const lineItems = obj.lineItems;
  if (!Array.isArray(lineItems)) return null;
  return lineItems.length;
}

export function extractVersionDisplayMetrics(
  row: EstimateVersionRow,
): EstimateVersionDisplayMetrics {
  return {
    totalSellPrice: extractSellPriceFromTotalsJson(row.totals),
    laborHours: extractLaborHoursFromSnapshot(row.snapshot),
    lineItemCount: extractLineItemCountFromSnapshot(row.snapshot),
  };
}

export interface EstimateVersionHistoryItem {
  id: string;
  versionNumber: number;
  versionName: string;
  status: EstimateVersionRow['status'];
  estimateType: EstimateVersionRow['estimate_type'];
  createdAt: string;
  isCurrent: boolean;
  metrics: EstimateVersionDisplayMetrics;
}

export function buildEstimateVersionHistoryItems(
  versions: EstimateVersionRow[],
  currentVersionId: string | null | undefined,
): EstimateVersionHistoryItem[] {
  return sortEstimateVersionsNewestFirst(versions).map((row) => ({
    id: row.id,
    versionNumber: row.version_number,
    versionName: row.version_name,
    status: row.status,
    estimateType: row.estimate_type,
    createdAt: row.created_at,
    isCurrent: isCurrentEstimateVersion(row.id, currentVersionId),
    metrics: extractVersionDisplayMetrics(row),
  }));
}
