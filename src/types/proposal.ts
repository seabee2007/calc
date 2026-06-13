import type { USAddress } from './address';
import type { ChangeOrderLineItem } from './changeOrder';
import type { PricingParams } from './pricingParams';

/** Rollup totals imported from the current project estimate (Costs & Markup source). */
export interface ImportedEstimateSummary {
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  subcontractorTotal: number;
  indirectCostTotal: number;
  directCost: number;
  overheadTotal: number;
  profitTotal: number;
  contingencyTotal: number;
  taxTotal: number;
  finalSellPrice: number;
  contingencyPercent?: number;
  overheadPercent?: number;
  profitPercent?: number;
  taxPercent?: number;
  targetMarginPercent?: number;
}

/** Pricing parameters stored on proposals (extends standard PricingParams). */
export type ProposalPricingIndirect = PricingParams;

export interface ProposalData {
  businessName: string;
  businessLogoUrl?: string;
  businessAddress?: string;
  businessAddressParts?: USAddress;
  businessPhone?: string;
  businessEmail?: string;
  businessLicenseNumber?: string;
  businessSlogan?: string;
  clientName: string;
  clientCompany?: string;
  clientAddress?: string;
  clientAddressParts?: USAddress;
  clientEmail?: string;
  clientPhone?: string;
  projectTitle: string;
  date: string;
  introduction: string;
  scope: string;
  timeline: {
    phase: string;
    start: string;
    end: string;
  }[];
  /** @deprecated Legacy flat lines — migrated to labor/material/equipment on load when empty. */
  pricing?: {
    description: string;
    amount: string;
  }[];
  laborItems?: ChangeOrderLineItem[];
  materialItems?: ChangeOrderLineItem[];
  equipmentItems?: ChangeOrderLineItem[];
  subcontractorItems?: ChangeOrderLineItem[];
  pricingIndirect?: ProposalPricingIndirect;
  /** When set, proposal totals mirror the current estimate Costs & Markup rollup. */
  importedEstimateSummary?: ImportedEstimateSummary;
  terms: string;
  preparedBy: string;
  preparedByTitle?: string;
}

/** Empty legal/sign-off fields for previews, tests, and partial drafts. */
export const EMPTY_PROPOSAL_DOCUMENT_FIELDS = {
  terms: '',
  preparedBy: '',
} as const satisfies Pick<ProposalData, 'terms' | 'preparedBy'>;
