import type { USAddress } from './address';
import type { ChangeOrderLineItem } from './changeOrder';
import type { PricingParams } from './pricingParams';

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
  terms: string;
  preparedBy: string;
  preparedByTitle?: string;
}

/** Empty legal/sign-off fields for previews, tests, and partial drafts. */
export const EMPTY_PROPOSAL_DOCUMENT_FIELDS = {
  terms: '',
  preparedBy: '',
} as const satisfies Pick<ProposalData, 'terms' | 'preparedBy'>;
