/** Shared pricing parameters for proposals and change orders (standard model). */

export type TaxSystem = 'none' | 'sales_tax' | 'gross_receipts_tax' | 'vat';

export type TaxApplication =
  | 'materials_only'
  | 'materials_and_equipment'
  | 'entire_project';

export type PricingModel = 'legacy' | 'standard';

export interface PricingParams {
  pricingModel?: PricingModel;
  wasteFactorPercent: number;
  contingencyPercent: number;
  overheadPercent: number;
  targetMarginPercent: number;
  feesAmount: number;
  permitsAmount: number;
  taxSystem: TaxSystem;
  taxRatePercent: number;
  taxApplication: TaxApplication;
  /** Legacy only */
  profitPercent?: number;
  markupPercent?: number;
}

export interface CompanyTaxDefaults {
  taxSystem?: TaxSystem;
  taxRatePercent?: number;
  taxApplication?: TaxApplication;
}
