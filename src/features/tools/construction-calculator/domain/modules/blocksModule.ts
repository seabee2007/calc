import type { BlocksModuleInput, BlocksModuleOutput } from '../constructionCalculatorTypes';
import { squareInchesToSquareFeet } from '../constructionDimensionMath';
import { safeDivide, sanitizeNonNegative, sanitizePercent } from '../constructionCalculatorValidators';

export function calculateBlocks(input: BlocksModuleInput): BlocksModuleOutput {
  const wallLength = sanitizeNonNegative(input.wallLengthInches);
  const wallHeight = sanitizeNonNegative(input.wallHeightInches);
  const blockLength = sanitizeNonNegative(input.blockLengthInches);
  const blockHeight = sanitizeNonNegative(input.blockHeightInches);
  const wastePercent = sanitizePercent(input.wastePercent);

  const wallAreaSqIn = wallLength * wallHeight;
  const wallAreaSqFt = squareInchesToSquareFeet(wallAreaSqIn);
  const blockAreaSqIn = blockLength * blockHeight;

  const blocksPerRow = safeDivide(wallLength, blockLength);
  const rows = safeDivide(wallHeight, blockHeight);
  const blockCount = Math.ceil(blocksPerRow * rows);
  const blockCountWithWaste = Math.ceil(blockCount * (1 + wastePercent / 100));

  return {
    wallAreaSqFt: round4(wallAreaSqFt),
    blockCount,
    blockCountWithWaste,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
