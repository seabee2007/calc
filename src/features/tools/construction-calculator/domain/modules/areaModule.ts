import type { AreaModuleInput, AreaModuleOutput } from '../constructionCalculatorTypes';
import {
  squareFeetToSquareMeters,
  squareFeetToSquareYards,
  squareInchesToSquareFeet,
} from '../constructionDimensionMath';
import { sanitizeNonNegative } from '../constructionCalculatorValidators';

export function calculateArea(input: AreaModuleInput): AreaModuleOutput {
  const length = sanitizeNonNegative(input.lengthInches);
  const width = sanitizeNonNegative(input.widthInches);
  const sqIn = length * width;
  const squareFeet = squareInchesToSquareFeet(sqIn);
  return {
    squareFeet: round4(squareFeet),
    squareYards: round4(squareFeetToSquareYards(squareFeet)),
    squareMeters: round4(squareFeetToSquareMeters(squareFeet)),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
