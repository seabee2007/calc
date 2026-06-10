/**
 * Types for the Seabee production-rate import pipeline.
 *
 * Pipeline:
 *   Manual PDF → extracted CSV → reviewed JSON → buildProductionRateSeed → TypeScript seeds → DB
 *
 * The reviewed JSON files are the source of truth.
 * TypeScript seeds are generated output from those files.
 */

/** Rate type determines which rate field(s) are required. */
export type RateType =
  | 'labor_production'      // man-hours per unit — manHoursPerUnit required
  | 'equipment_production'  // equipment hours per unit — equipmentHoursPerUnit required
  | 'weight_measure'        // weight or measure factor — quantityPerUnit required
  | 'material_quantity';    // material quantity factor — quantityPerUnit required

/** Crew composition breakdown by Seabee trade. */
export interface CrewComposition {
  builder?: number;
  electrician?: number;
  equipmentOperator?: number;
  steelworker?: number;
  utilitiesman?: number;
  laborer?: number;
  welder?: number;
}

/**
 * One production-rate entry as it appears in a reviewed JSON file.
 * This is the raw reviewed form — validation rules enforce that the
 * correct rate field is present for each rateType.
 */
export interface ReviewedProductionRateEntry {
  /** Source-based ID: "{divCode}-{masterFormatSection}-{lineNumber}" */
  id: string;

  masterFormatCode: string;
  workElementLineNumber: string;
  description: string;
  unit: string;
  rateType: RateType;

  manHoursPerUnit?: number;
  equipmentHoursPerUnit?: number;
  quantityPerUnit?: number;

  minimumCrewSize?: number;
  crewComposition?: CrewComposition;

  sourceFigure: string;
  sourcePage: string;
  sourcePdfPage?: number;
  sourceNotes?: string[];

  directLaborOnly: boolean;
  militaryAdjusted: boolean;
  civilianConversionMultiplier?: number;

  tags: string[];
  applicableActivityTypes: string[];
}

/** Batch metadata that applies to all rates in one reviewed JSON file. */
export interface ReviewedRateBatchMeta {
  sourceManual: string;
  sourceEdition: string;
  divisionCode: string;
  divisionName: string;
  importedAt: string;
  reviewedBy: string;
  notes?: string;
  checksum?: string;
}

/** Shape of each reviewed JSON file. */
export interface ReviewedRateFile {
  batchMeta: ReviewedRateBatchMeta;
  rates: ReviewedProductionRateEntry[];
}

/** A validation error for a single rate entry. */
export interface RateValidationError {
  id: string;
  field: string;
  message: string;
}

/** Result returned by validateProductionRates. */
export interface RateValidationResult {
  valid: boolean;
  errors: RateValidationError[];
  warnings: RateValidationWarning[];
  validCount: number;
  errorCount: number;
}

export interface RateValidationWarning {
  id: string;
  field: string;
  message: string;
}

/** Recognised measurement units from the Seabee manual. */
export const RECOGNISED_UNITS = new Set([
  'SF', 'SY', 'LF', 'CYD', 'CY', 'CF', 'EA', 'Each',
  'Ton', 'LB', 'Acre', 'Feet', 'Foot', 'MBF',
  'Bank CYD', 'Loose CYD', 'Square',
]);

/** Division codes carried in the manual. */
export const KNOWN_DIVISION_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '21', '22', '23', '26', '27',
  '31', '32', '33', '34',
]);
