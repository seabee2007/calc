export type FractionPrecision = 2 | 4 | 8 | 16 | 32 | 64;

export const FRACTION_PRECISIONS: FractionPrecision[] = [2, 4, 8, 16, 32, 64];

export const DEFAULT_FRACTION_PRECISION: FractionPrecision = 16;

export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export interface DimensionParts {
  feet?: number;
  inches?: number;
  numerator?: number;
  denominator?: number;
}

export interface DimensionValue {
  decimalInches: number;
  parts?: DimensionParts;
}

export interface ScalarValue {
  value: number;
}

export type CalculatorOperand = DimensionValue | ScalarValue;

export type CalculatorOperator = '+' | '-' | '×' | '÷';

export type CalculatorToken =
  | { type: 'dimension'; value: DimensionValue }
  | { type: 'scalar'; value: number }
  | { type: 'operator'; operator: CalculatorOperator };

export type EvaluationResult =
  | { kind: 'dimension'; value: DimensionValue }
  | { kind: 'scalar'; value: number };

export interface CalculatorTapeEntry {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'ft'
  | 'in'
  | 'frac'
  | '+'
  | '-'
  | '×'
  | '÷'
  | 'clear'
  | 'backspace'
  | 'equals';

export type LengthUnit = 'ft-in' | 'decimal-ft' | 'yd' | 'm' | 'cm' | 'mm';

export type AreaUnit = 'sq-ft' | 'sq-yd' | 'sq-m';

export type VolumeUnit = 'cu-ft' | 'cu-yd' | 'cu-m';

// --- Module I/O types ---

export interface AreaModuleInput {
  lengthInches: number;
  widthInches: number;
}

export interface AreaModuleOutput {
  squareFeet: number;
  squareYards: number;
  squareMeters: number;
}

export interface VolumeModuleInput {
  lengthInches: number;
  widthInches: number;
  heightInches: number;
}

export interface VolumeModuleOutput {
  cubicFeet: number;
  cubicYards: number;
  cubicMeters: number;
}

export interface BoardFeetModuleInput {
  thicknessInches: number;
  widthInches: number;
  lengthFeet: number;
}

export interface BoardFeetModuleOutput {
  boardFeet: number;
}

export interface ConcreteModuleInput {
  lengthInches: number;
  widthInches: number;
  depthInches: number;
  wastePercent: number;
}

export interface ConcreteModuleOutput {
  cubicFeet: number;
  cubicYards: number;
  cubicYardsWithWaste: number;
}

export interface BlocksModuleInput {
  wallLengthInches: number;
  wallHeightInches: number;
  blockLengthInches: number;
  blockHeightInches: number;
  wastePercent: number;
}

export interface BlocksModuleOutput {
  wallAreaSqFt: number;
  blockCount: number;
  blockCountWithWaste: number;
}

export interface DrywallModuleInput {
  wallLengthInches: number;
  wallHeightInches: number;
  sheetWidthInches: number;
  sheetHeightInches: number;
  wastePercent: number;
}

export interface DrywallModuleOutput {
  wallAreaSqFt: number;
  sheetCount: number;
  sheetCountWithWaste: number;
}

export interface StairsModuleInput {
  totalRiseInches: number;
  riserCount: number;
  treadDepthInches: number;
  precision: FractionPrecision;
}

export interface StairsModuleOutput {
  riserHeightInches: number;
  riserHeightFormatted: string;
  treadCount: number;
  totalRunInches: number;
  totalRunFormatted: string;
  angleDegrees: number;
  warnings: string[];
}

export interface RightTriangleModuleInput {
  riseInches?: number;
  runInches?: number;
  diagonalInches?: number;
  pitchRise?: number;
  pitchRun?: number;
  angleDegrees?: number;
}

export interface RightTriangleModuleOutput {
  riseInches: number;
  runInches: number;
  diagonalInches: number;
  pitchRise: number;
  pitchRun: number;
  angleDegrees: number;
  commonRafterLengthInches: number;
}

export interface CircleModuleInput {
  diameterInches?: number;
  radiusInches?: number;
  heightInches?: number;
  coneHeightInches?: number;
}

export interface CircleModuleOutput {
  radiusInches: number;
  diameterInches: number;
  areaSqIn: number;
  areaSqFt: number;
  circumferenceInches: number;
  cylinderVolumeCuFt?: number;
  coneVolumeCuFt?: number;
}

export interface CostPerUnitInput {
  quantity: number;
  unitCost: number;
}

export interface CostPerUnitOutput {
  totalCost: number;
}

export type CalculatorFunctionTab =
  | 'core'
  | 'area'
  | 'volume'
  | 'board-feet'
  | 'concrete'
  | 'blocks'
  | 'drywall'
  | 'stairs'
  | 'triangle'
  | 'circle'
  | 'conversions';

export function isDimensionValue(operand: CalculatorOperand): operand is DimensionValue {
  return 'decimalInches' in operand;
}

export function isScalarValue(operand: CalculatorOperand): operand is ScalarValue {
  return 'value' in operand && !('decimalInches' in operand);
}
