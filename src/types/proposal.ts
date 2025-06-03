export interface ProposalData {
  businessName: string;
  businessLogoUrl?: string;      // optional logo
  businessAddress?: string;
  businessPhone?: string;        // phone number
  businessEmail?: string;        // email address
  businessLicenseNumber?: string; // license number
  businessSlogan?: string;       // company motto/slogan
  clientName: string;
  clientCompany?: string;
  clientAddress?: string;
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