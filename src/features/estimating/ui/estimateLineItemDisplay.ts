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
    `${rollup.itemCount} activit${rollup.itemCount === 1 ? 'y' : 'ies'}`,
    rollup.laborHours > 0 ? formatEstimateHours(rollup.laborHours) : null,
    rollup.directCost > 0 ? formatEstimateCurrency(rollup.directCost) : null,
    rollup.sellPrice > 0 ? formatEstimateCurrency(rollup.sellPrice) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '0 activities';
}

/** Division header: task count, sell price, labor hours. */
export function formatDivisionRollupHeader(rollup: EstimateGroupRollup): string {
  const parts: string[] = [
    `${rollup.itemCount} activit${rollup.itemCount === 1 ? 'y' : 'ies'}`,
  ];

  if (rollup.sellPrice > 0) {
    parts.push(formatEstimateCurrency(rollup.sellPrice));
  }
  if (rollup.laborHours > 0) {
    parts.push(formatEstimateHours(rollup.laborHours));
  }

  return parts.join(' · ');
}

/** Scope header: task count; subtotal when multiple tasks in scope. */
export function formatScopeRollupHeader(rollup: EstimateGroupRollup): string {
  const count = `${rollup.itemCount} activit${rollup.itemCount === 1 ? 'y' : 'ies'}`;

  if (rollup.itemCount > 1 && rollup.sellPrice > 0) {
    return `${count} · ${formatEstimateCurrency(rollup.sellPrice)}`;
  }

  return count;
}

export function formatRollupStripCounts(counts: {
  divisionCount: number;
  scopeCount: number;
  taskCount: number;
}): string {
  return `${counts.divisionCount} division${counts.divisionCount === 1 ? '' : 's'} · ${counts.scopeCount} work package${counts.scopeCount === 1 ? '' : 's'} · ${counts.taskCount} activit${counts.taskCount === 1 ? 'y' : 'ies'}`;
}

export function formatRollupStripTotals(rollup: EstimateGroupRollup): string {
  return `${formatEstimateCurrency(rollup.directCost)} direct · ${formatEstimateCurrency(rollup.sellPrice)} total`;
}

export function formatManDays(value: number): string {
  return value > 0 ? formatEstimateNumber(value, { decimals: 2 }) : '0';
}

export function formatDraftSummaryStrip(totals: {
  lineCount: number;
  laborHours: number;
  manDays: number;
  crewDays: number;
  sellPrice: number;
}): string {
  const parts = [
    `${totals.lineCount} draft activit${totals.lineCount === 1 ? 'y' : 'ies'}`,
    totals.laborHours > 0 ? formatEstimateHours(totals.laborHours) : null,
    totals.manDays > 0 ? `${formatManDays(totals.manDays)} man-days` : null,
    totals.crewDays > 0 ? `${formatManDays(totals.crewDays)} crew-days` : null,
    totals.sellPrice > 0 ? formatEstimateCurrency(totals.sellPrice) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '0 draft activities';
}
