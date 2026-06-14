import type { CircleModuleInput, CircleModuleOutput } from '../constructionCalculatorTypes';
import {
  cubicInchesToCubicFeet,
  squareInchesToSquareFeet,
} from '../constructionDimensionMath';
import { sanitizeNonNegative } from '../constructionCalculatorValidators';

const PI = Math.PI;

export function calculateCircle(input: CircleModuleInput): CircleModuleOutput {
  let radius = input.radiusInches;
  if (radius === undefined && input.diameterInches !== undefined) {
    radius = input.diameterInches / 2;
  }
  radius = sanitizeNonNegative(radius ?? 0);
  const diameter = radius * 2;

  const areaSqIn = PI * radius * radius;
  const circumferenceInches = 2 * PI * radius;

  const output: CircleModuleOutput = {
    radiusInches: round4(radius),
    diameterInches: round4(diameter),
    areaSqIn: round4(areaSqIn),
    areaSqFt: round4(squareInchesToSquareFeet(areaSqIn)),
    circumferenceInches: round4(circumferenceInches),
  };

  if (input.heightInches !== undefined) {
    const height = sanitizeNonNegative(input.heightInches);
    const cylinderCuIn = areaSqIn * height;
    output.cylinderVolumeCuFt = round4(cubicInchesToCubicFeet(cylinderCuIn));
  }

  if (input.coneHeightInches !== undefined) {
    const coneHeight = sanitizeNonNegative(input.coneHeightInches);
    const coneCuIn = (areaSqIn * coneHeight) / 3;
    output.coneVolumeCuFt = round4(cubicInchesToCubicFeet(coneCuIn));
  }

  return output;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
