import type { EstimateGroupRollup } from '../domain/estimateLineItemTree';
import {
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
} from './estimateFormatters';

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
