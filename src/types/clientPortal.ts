export interface ClientPortalRecord {
  id: string;
  projectId: string;
  contractorUserId: string;
  clientName: string;
  clientEmail: string;
  token: string;
  isActive: boolean;
  lastViewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortalAccessInput {
  enabled: boolean;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
}

export interface ClientTimelineStep {
  key: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

export interface ClientPortalDocument {
  label: string;
  url: string;
  type: 'proposal' | 'invoice' | 'qc' | 'other';
}

export interface ClientPortalUpdate {
  date: string;
  message: string;
}

export interface ClientPortalViewData {
  projectName: string;
  projectStatus: string;
  placementDate: string | null;
  jobsiteLocation: string | null;
  contractorCompany: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
  contractorLogoUrl: string | null;
  timeline: ClientTimelineStep[];
  currentPhase: string;
  nextMilestone: string;
  proposalStatus: string | null;
  paymentStatus: string | null;
  qcSummary: string;
  weatherDelayNotice: string | null;
  documents: ClientPortalDocument[];
  updates: ClientPortalUpdate[];
}
