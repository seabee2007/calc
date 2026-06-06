import {
  buildEstimateLineSnapshot,
  buildEstimateTotals,
  normalizeEstimatePricingInput,
} from '../domain/estimateSnapshot';
import type { EstimateSnapshot, EstimateSnapshotInput } from '../domain/estimateTypes';
import { validateEstimateSnapshotInput } from '../domain/estimateValidation';
import {
  buildEstimateTotalsFromSettings,
  normalizeEstimateSettings,
} from './estimateSettings';

export function buildEstimateSnapshot(input: EstimateSnapshotInput): EstimateSnapshot {
  const warnings = validateEstimateSnapshotInput(input);
  const pricing = normalizeEstimatePricingInput(input.pricing);
  const estimateSettings = normalizeEstimateSettings(input.estimateSettings);
  const lineItems = input.lineItems.map((line) => buildEstimateLineSnapshot(line));
  const totals = input.estimateSettings
    ? buildEstimateTotalsFromSettings(lineItems, estimateSettings)
    : buildEstimateTotals(lineItems, pricing);

  return {
    meta: input.meta,
    pricing,
    estimateSettings,
    lineItems,
    selectedDivisions: input.selectedDivisions,
    totals,
    warnings,
  };
}

