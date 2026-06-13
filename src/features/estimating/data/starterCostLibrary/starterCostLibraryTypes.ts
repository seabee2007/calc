/**
 * Types for the Arden Starter Cost Library — static seed data only.
 * These items are editable defaults. Verify local pricing before submitting proposals.
 */

export type StarterCostItemType = 'material' | 'equipment';

/** Indicates how confident the default cost is. "placeholder" means the user MUST enter a real price. */
export type StarterCostConfidence = 'placeholder' | 'low' | 'medium' | 'high';

export interface StarterCostLibraryItem {
  /** Stable string ID (not a UUID). Example: "material-concrete-ready-mix-concrete-ready-mix-concrete-4000-psi-normal-weight" */
  id: string;
  type: StarterCostItemType;
  category: string;
  subcategory: string;
  csiDivision: string;
  csiSection: string;
  name: string;
  description: string;
  unit: string;
  commonUnits: string[];
  defaultUnitCost: number;
  costConfidence: StarterCostConfidence;
  pricingRequired: boolean;
  tags: string[];
  notes: string;
}
