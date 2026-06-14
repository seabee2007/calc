import type { ConcreteModuleInput, ConcreteModuleOutput } from '../constructionCalculatorTypes';
import {
  cubicFeetToCubicYards,
  cubicInchesToCubicFeet,
} from '../constructionDimensionMath';
import { sanitizeNonNegative, sanitizePercent } from '../constructionCalculatorValidators';

export function calculateConcrete(input: ConcreteModuleInput): ConcreteModuleOutput {
  const length = sanitizeNonNegative(input.lengthInches);
  const width = sanitizeNonNegative(input.widthInches);
  const depth = sanitizeNonNegative(input.depthInches);
  const wastePercent = sanitizePercent(input.wastePercent);

  const cuIn = length * width * depth;
  const cubicFeet = cubicInchesToCubicFeet(cuIn);
  const cubicYards = cubicFeetToCubicYards(cubicFeet);
  const cubicYardsWithWaste = cubicYards * (1 + wastePercent / 100);

  return {
    cubicFeet: round4(cubicFeet),
    cubicYards: round4(cubicYards),
    cubicYardsWithWaste: round4(cubicYardsWithWaste),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
