import type { StairsModuleInput, StairsModuleOutput } from '../constructionCalculatorTypes';
import { formatFeetInchesFraction } from '../constructionDimensionMath';
import { evaluateRiserHeight } from '../constructionCalculatorEngine';
import { safeDivide, sanitizeNonNegative } from '../constructionCalculatorValidators';

const MAX_RISER_HEIGHT_IN = 7.75;
const MIN_RISER_HEIGHT_IN = 4;
const MAX_TREAD_DEPTH_IN = 14;
const MIN_TREAD_DEPTH_IN = 9;

export function calculateStairs(input: StairsModuleInput): StairsModuleOutput {
  const totalRise = sanitizeNonNegative(input.totalRiseInches);
  const riserCount = Math.max(1, Math.round(sanitizeNonNegative(input.riserCount)));
  const treadDepth = sanitizeNonNegative(input.treadDepthInches);
  const precision = input.precision;

  const riserHeightInches = evaluateRiserHeight(totalRise, riserCount);
  const treadCount = Math.max(0, riserCount - 1);
  const totalRunInches = treadCount * treadDepth;
  const angleDegrees =
    totalRunInches > 0
      ? (Math.atan(totalRise / totalRunInches) * 180) / Math.PI
      : 0;

  const warnings: string[] = [];
  if (riserHeightInches > MAX_RISER_HEIGHT_IN) {
    warnings.push(`Riser height ${formatFeetInchesFraction(riserHeightInches, precision)} exceeds typical ${MAX_RISER_HEIGHT_IN}" maximum.`);
  }
  if (riserHeightInches < MIN_RISER_HEIGHT_IN) {
    warnings.push(`Riser height ${formatFeetInchesFraction(riserHeightInches, precision)} is below typical ${MIN_RISER_HEIGHT_IN}" minimum.`);
  }
  if (treadDepth > MAX_TREAD_DEPTH_IN) {
    warnings.push(`Tread depth exceeds typical ${MAX_TREAD_DEPTH_IN}" maximum.`);
  }
  if (treadDepth < MIN_TREAD_DEPTH_IN && treadDepth > 0) {
    warnings.push(`Tread depth is below typical ${MIN_TREAD_DEPTH_IN}" minimum.`);
  }

  return {
    riserHeightInches: round4(riserHeightInches),
    riserHeightFormatted: formatFeetInchesFraction(riserHeightInches, precision),
    treadCount,
    totalRunInches: round4(totalRunInches),
    totalRunFormatted: formatFeetInchesFraction(totalRunInches, precision),
    angleDegrees: round4(angleDegrees),
    warnings,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
