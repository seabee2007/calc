import type { DimensionParts, FractionPrecision } from './constructionCalculatorTypes';

const INCHES_PER_FOOT = 12;
const INCHES_PER_YARD = 36;
const CM_PER_INCH = 2.54;
const MM_PER_INCH = 25.4;
const METERS_PER_INCH = 0.0254;
const SQ_INCHES_PER_SQ_FT = 144;
const CU_INCHES_PER_CU_FT = 1728;
const CU_FT_PER_CU_YD = 27;

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function toDecimalInches(parts: DimensionParts): number {
  const feet = parts.feet ?? 0;
  const inches = parts.inches ?? 0;
  const numerator = parts.numerator ?? 0;
  const denominator = parts.denominator ?? 0;
  const fraction = denominator > 0 ? numerator / denominator : 0;
  return feet * INCHES_PER_FOOT + inches + fraction;
}

export function dimensionFromDecimalInches(decimalInches: number): { decimalInches: number } {
  return { decimalInches: Number.isFinite(decimalInches) ? decimalInches : 0 };
}

export function roundToPrecision(value: number, precision: FractionPrecision): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * precision) / precision;
}

export function formatFeetInchesFraction(
  decimalInches: number,
  precision: FractionPrecision = 16,
): string {
  if (!Number.isFinite(decimalInches)) return '0"';

  const negative = decimalInches < 0;
  let total = Math.abs(decimalInches);

  let feet = Math.floor(total / INCHES_PER_FOOT);
  let remainder = total - feet * INCHES_PER_FOOT;

  let wholeInches = Math.floor(remainder + 1e-9);
  let fracDecimal = remainder - wholeInches;

  let numerator = Math.round(fracDecimal * precision);
  if (numerator >= precision) {
    wholeInches += 1;
    numerator = 0;
  }
  if (wholeInches >= INCHES_PER_FOOT) {
    feet += 1;
    wholeInches -= INCHES_PER_FOOT;
  }

  if (numerator > 0) {
    const divisor = gcd(numerator, precision);
    numerator /= divisor;
    const denominator = precision / divisor;
    return buildFeetInchString(negative, feet, wholeInches, numerator, denominator);
  }

  return buildFeetInchString(negative, feet, wholeInches);
}

function buildFeetInchString(
  negative: boolean,
  feet: number,
  inches: number,
  numerator?: number,
  denominator?: number,
): string {
  const sign = negative ? '-' : '';
  const parts: string[] = [];

  if (feet > 0) {
    parts.push(`${feet}'`);
  }

  const inchParts: string[] = [];
  if (inches > 0 || numerator || (feet > 0 && !numerator)) {
    inchParts.push(String(inches));
  }
  if (numerator && denominator) {
    inchParts.push(`${numerator}/${denominator}`);
  }

  if (inchParts.length > 0) {
    parts.push(`${inchParts.join(' ')}"`);
  } else if (feet > 0) {
    parts.push(`0"`);
  } else {
    return `${sign}0"`;
  }

  return sign + parts.join(' ');
}

export function decimalInchesToDecimalFeet(decimalInches: number): number {
  return decimalInches / INCHES_PER_FOOT;
}

export function decimalFeetToDecimalInches(decimalFeet: number): number {
  return decimalFeet * INCHES_PER_FOOT;
}

export function decimalInchesToYards(decimalInches: number): number {
  return decimalInches / INCHES_PER_YARD;
}

export function yardsToDecimalInches(yards: number): number {
  return yards * INCHES_PER_YARD;
}

export function decimalInchesToMeters(decimalInches: number): number {
  return decimalInches * METERS_PER_INCH;
}

export function metersToDecimalInches(meters: number): number {
  return meters / METERS_PER_INCH;
}

export function decimalInchesToCentimeters(decimalInches: number): number {
  return decimalInches * CM_PER_INCH;
}

export function centimetersToDecimalInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function decimalInchesToMillimeters(decimalInches: number): number {
  return decimalInches * MM_PER_INCH;
}

export function millimetersToDecimalInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function squareInchesToSquareFeet(sqIn: number): number {
  return sqIn / SQ_INCHES_PER_SQ_FT;
}

export function squareFeetToSquareYards(sqFt: number): number {
  return sqFt / 9;
}

export function squareFeetToSquareMeters(sqFt: number): number {
  return sqFt * 0.092903;
}

export function cubicInchesToCubicFeet(cuIn: number): number {
  return cuIn / CU_INCHES_PER_CU_FT;
}

export function cubicFeetToCubicYards(cuFt: number): number {
  return cuFt / CU_FT_PER_CU_YD;
}

export function cubicFeetToCubicMeters(cuFt: number): number {
  return cuFt * 0.0283168;
}

export function calculateBoardFeet(
  thicknessInches: number,
  widthInches: number,
  lengthFeet: number,
): number {
  return (thicknessInches * widthInches * lengthFeet) / INCHES_PER_FOOT;
}

export function degreesFromPitch(pitchRise: number, pitchRun: number): number {
  if (pitchRun <= 0) return 0;
  return (Math.atan(pitchRise / pitchRun) * 180) / Math.PI;
}

export function pitchFromRiseRun(riseInches: number, runInches: number): { rise: number; run: number } {
  if (runInches <= 0) return { rise: 0, run: 12 };
  const risePerFoot = (riseInches / runInches) * INCHES_PER_FOOT;
  return { rise: Math.round(risePerFoot * 100) / 100, run: 12 };
}

export { INCHES_PER_FOOT, INCHES_PER_YARD, CU_FT_PER_CU_YD, SQ_INCHES_PER_SQ_FT };
