import type { VolumeModuleInput, VolumeModuleOutput } from '../constructionCalculatorTypes';
import {
  cubicFeetToCubicMeters,
  cubicFeetToCubicYards,
  cubicInchesToCubicFeet,
} from '../constructionDimensionMath';
import { sanitizeNonNegative } from '../constructionCalculatorValidators';

export function calculateVolume(input: VolumeModuleInput): VolumeModuleOutput {
  const length = sanitizeNonNegative(input.lengthInches);
  const width = sanitizeNonNegative(input.widthInches);
  const height = sanitizeNonNegative(input.heightInches);
  const cuIn = length * width * height;
  const cubicFeet = cubicInchesToCubicFeet(cuIn);
  return {
    cubicFeet: round4(cubicFeet),
    cubicYards: round4(cubicFeetToCubicYards(cubicFeet)),
    cubicMeters: round4(cubicFeetToCubicMeters(cubicFeet)),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
