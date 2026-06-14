import type { DrywallModuleInput, DrywallModuleOutput } from '../constructionCalculatorTypes';
import { squareInchesToSquareFeet } from '../constructionDimensionMath';
import { safeDivide, sanitizeNonNegative, sanitizePercent } from '../constructionCalculatorValidators';

export function calculateDrywall(input: DrywallModuleInput): DrywallModuleOutput {
  const wallLength = sanitizeNonNegative(input.wallLengthInches);
  const wallHeight = sanitizeNonNegative(input.wallHeightInches);
  const sheetWidth = sanitizeNonNegative(input.sheetWidthInches);
  const sheetHeight = sanitizeNonNegative(input.sheetHeightInches);
  const wastePercent = sanitizePercent(input.wastePercent);

  const wallAreaSqIn = wallLength * wallHeight;
  const wallAreaSqFt = squareInchesToSquareFeet(wallAreaSqIn);
  const sheetAreaSqIn = sheetWidth * sheetHeight;
  const sheetCount = sheetAreaSqIn > 0 ? Math.ceil(safeDivide(wallAreaSqIn, sheetAreaSqIn)) : 0;
  const sheetCountWithWaste = Math.ceil(sheetCount * (1 + wastePercent / 100));

  return {
    wallAreaSqFt: round4(wallAreaSqFt),
    sheetCount,
    sheetCountWithWaste,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
