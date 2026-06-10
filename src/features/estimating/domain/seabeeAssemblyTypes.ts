/**
 * Activity Assembly types for the Seabee estimating system.
 *
 * An assembly is a curated bundle of a ConstructionActivityTemplate + ActivityLineItemTemplates
 * paired with user-facing quantity input specs and the formula that maps those inputs to each
 * line item's unit quantity.
 *
 * This layer sits between raw production-rate library records and the estimator UI.
 * Users pick an assembly, enter high-level quantities (e.g. "Slab Area: 2,000 SF"),
 * and the system fans those out to individual line item quantities automatically.
 */

/** One user-facing quantity field the assembly asks for. */
export interface QuantityInputSpec {
  /** Stable key — used as the key in user input maps. */
  id: string;
  label: string;
  unit: string;
  description?: string;
  defaultValue?: number;
  /** Human-readable hint, e.g. "length × width" or "perimeter × 1.05". */
  formulaHint?: string;
}

/** Maps one user input to one line item template's quantity. */
export interface AssemblyLineItemSpec {
  /** Must match ActivityLineItemTemplate.id */
  lineItemTemplateId: string;
  /** Must match QuantityInputSpec.id */
  quantityInputId: string;
  /** Applied after the user input, e.g. 1.05 for 5 % waste. Default = 1. */
  quantityMultiplier?: number;
  /** Human-readable formula shown in the UI. */
  quantityFormulaHint?: string;
}

/**
 * A complete, user-selectable activity assembly.
 *
 * Combines a ConstructionActivityTemplate with curated quantity inputs and
 * line-item quantity mappings so users can enter high-level measurements
 * and get a fully instantiated project activity.
 */
export interface ActivityAssemblySpec {
  id: string;
  divisionCode: string;
  divisionName: string;
  /** Must match ConstructionActivityTemplate.id */
  activityTemplateId: string;
  displayName: string;
  description?: string;
  /** What to ask the user. */
  quantityInputs: QuantityInputSpec[];
  /** How user inputs map to each line item's quantity. */
  lineItemQuantityMap: AssemblyLineItemSpec[];
  defaultCrewSize: number;
  defaultHoursPerDay: number;
  defaultProductionFactor?: number;
  /** Key rates shown in the summary section of the UI. */
  keyProductionRateIds?: string[];
}

/**
 * User inputs for an assembly — keyed by QuantityInputSpec.id.
 * Missing keys default to 0 (with warning in rollup).
 */
export type AssemblyUserInputs = Record<string, number>;

/** All assemblies for one division. */
export interface DivisionAssemblyGroup {
  divisionCode: string;
  divisionName: string;
  assemblies: ActivityAssemblySpec[];
}
