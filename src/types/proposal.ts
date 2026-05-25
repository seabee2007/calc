import type { USAddress } from './address';

export interface ProposalData {
  businessName: string;
  businessLogoUrl?: string;      // optional logo
  /** Formatted line for PDF/templates (synced from businessAddressParts). */
  businessAddress?: string;
  businessAddressParts?: USAddress;
  businessPhone?: string;        // phone number
  businessEmail?: string;        // email address
  businessLicenseNumber?: string; // license number
  businessSlogan?: string;       // company motto/slogan
  clientName: string;
  clientCompany?: string;
  /** Formatted line for PDF/templates (synced from clientAddressParts). */
  clientAddress?: string;
  clientAddressParts?: USAddress;
  projectTitle: string;
  date: string;                  // e.g. "June 1, 2025"
  introduction: string;          // opening paragraph
  scope: string;                 // scope of work details
  timeline: {                    // for a simple table
    phase: string;
    start: string;
    end: string;
  }[];
  pricing: {                     // pricing breakdown
    description: string;
    amount: string;              // e.g. "$5,000"
  }[];
  terms: string;                 // any legal terms / notes
  preparedBy: string;            // your name/title
  preparedByTitle?: string;      // e.g. "Senior Estimator"
} 