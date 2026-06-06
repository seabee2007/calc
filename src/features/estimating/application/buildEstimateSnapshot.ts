import {
  buildEstimateLineSnapshot,
  buildEstimateTotals,
  normalizeEstimatePricingInput,
} from '../domain/estimateSnapshot';
import type { EstimateSnapshot, EstimateSnapshotInput } from '../domain/estimateTypes';
import { validateEstimateSnapshotInput } from '../domain/estimateValidation';

export function buildEstimateSnapshot(input: EstimateSnapshotInput): EstimateSnapshot {
  const warnings = validateEstimateSnapshotInput(input);
  const pricing = normalizeEstimatePricingInput(input.pricing);
  const lineItems = input.lineItems.map((line) => buildEstimateLineSnapshot(line));
  const totals = buildEstimateTotals(lineItems, pricing);

  return {
    meta: input.meta,
    pricing,
    lineItems,
    selectedDivisions: input.selectedDivisions,
    totals,
    warnings,
  };
}

