import { getCsiDivisionLabel } from '../domain/csiDivisions';
import type { EstimateGroupRollup } from '../domain/estimateLineItemTree';
import { UNASSIGNED_DIVISION_LABEL } from '../domain/estimateLineItemTree';
import {
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
} from './estimateFormatters';

/** Display CSI division for line items and group headers. */
export function formatCsiDivisionDisplay(code?: string | null): string {
  const trimmed = code?.trim();
  if (!trimmed) return UNASSIGNED_DIVISION_LABEL;
  return getCsiDivisionLabel(trimmed) || trimmed;
}

export function formatDivisionGroupTitle(label: string): string {
  if (!label || label === UNASSIGNED_DIVISION_LABEL) return UNASSIGNED_DIVISION_LABEL;
  return label;
}

export function formatGroupRollupSummary(rollup: EstimateGroupRollup): string {
  const parts = [
    `${rollup.itemCount} task${rollup.itemCount === 1 ? '' : 's'}`,
    rollup.laborHours > 0 ? formatEstimateHours(rollup.laborHours) : null,
    rollup.directCost > 0 ? formatEstimateCurrency(rollup.directCost) : null,
    rollup.sellPrice > 0 ? formatEstimateCurrency(rollup.sellPrice) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '0 tasks';
}

export function formatGroupRollupCompact(rollup: EstimateGroupRollup): string {
  return [
    formatEstimateCurrency(rollup.directCost),
    rollup.laborHours > 0 ? formatEstimateHours(rollup.laborHours) : '0 hr',
  ].join(' · ');
}

export function formatRollupStripCounts(counts: {
  divisionCount: number;
  scopeCount: number;
  taskCount: number;
}): string {
  return `${counts.divisionCount} division${counts.divisionCount === 1 ? '' : 's'} · ${counts.scopeCount} scope${counts.scopeCount === 1 ? '' : 's'} · ${counts.taskCount} task${counts.taskCount === 1 ? '' : 's'}`;
}

export function formatRollupStripTotals(rollup: EstimateGroupRollup): string {
  return `${formatEstimateCurrency(rollup.directCost)} direct · ${formatEstimateCurrency(rollup.sellPrice)} total`;
}

export function formatManDays(value: number): string {
  return value > 0 ? formatEstimateNumber(value, { decimals: 2 }) : '0';
}
