import type { CompanySettings } from './companySettingsService';
import type { Project } from '../types/index';
import { formatUSAddress } from '../types/address';
import { resolveClientAddressForProposal } from '../types/projectClient';
import type { DocumentType } from '../features/documents/types';

export interface ProjectDocumentProjectSnapshot {
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  projectAddress: string | null;
  capturedAt: string;
}

export interface ProjectDocumentCompanySnapshot {
  companyName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  logoUrl: string | null;
  capturedAt: string;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  return '';
}

export function buildProjectSnapshot(project: Project | null): ProjectDocumentProjectSnapshot {
  const capturedAt = new Date().toISOString();
  if (!project) {
    return {
      projectId: null,
      projectName: null,
      clientName: null,
      projectAddress: null,
      capturedAt,
    };
  }

  const clientInfo = project.clientInfo;
  const jobsite = project.jobsiteAddress;
  const clientAddress = resolveClientAddressForProposal(clientInfo, jobsite);
  let projectAddress: string | null = null;
  if (clientAddress && Object.values(clientAddress).some((v) => String(v).trim())) {
    projectAddress = formatUSAddress(clientAddress) || null;
  } else if (jobsite) {
    projectAddress = formatUSAddress(jobsite) || null;
  }

  return {
    projectId: project.id,
    projectName: project.name?.trim() || null,
    clientName: clientInfo?.clientName?.trim() || null,
    projectAddress,
    capturedAt,
  };
}

/** Reconstruct minimal company settings from a stored document row snapshot. */
export function companySettingsFromDocumentSnapshot(
  snap: Record<string, unknown> | null | undefined,
): CompanySettings {
  const s = snap ?? {};
  return {
    companyName: (s.companyName as string) ?? '',
    address: (s.address as string) ?? '',
    phone: (s.phone as string) ?? '',
    email: (s.email as string) ?? '',
    licenseNumber: (s.licenseNumber as string) ?? '',
    logoUrl: (s.logoUrl as string) ?? null,
    logo: (s.logoUrl as string) ?? null,
  } as CompanySettings;
}

export function buildCompanySnapshot(
  company: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null },
): ProjectDocumentCompanySnapshot {
  return {
    companyName: company.companyName?.trim() || null,
    address: company.address?.trim() || null,
    phone: company.phone?.trim() || null,
    email: company.email?.trim() || null,
    licenseNumber: company.licenseNumber?.trim() || null,
    logoUrl: company.logoUrl ?? company.logo ?? null,
    capturedAt: new Date().toISOString(),
  };
}

/** Extract display document number from builder answers by document type. */
export function extractDocumentNumber(
  documentType: DocumentType | string,
  answers: Record<string, unknown>,
): string | null {
  const keysByType: Record<string, string[]> = {
    rfi: ['rfiNumber', 'displayNumber'],
    far: ['farNumber', 'displayNumber'],
    submittal: ['submittalNumber', 'displayNumber'],
    daily_report: ['reportNumber', 'displayNumber'],
    qc_report: ['reportNumber', 'displayNumber'],
    warranty_letter: ['documentNumber', 'displayNumber'],
    punch_list: ['punchListNumber', 'displayNumber'],
    change_order: ['changeOrderNumber', 'displayNumber'],
    residential_contract: ['contractNumber', 'displayNumber'],
  };
  const keys = keysByType[documentType] ?? ['displayNumber', 'documentNumber'];
  for (const key of keys) {
    const v = str(answers[key]);
    if (v) return v;
  }
  return null;
}

/** Workflow status from answers (builder field), not contract_documents.status. */
export function extractBuilderWorkflowStatus(answers: Record<string, unknown>): string {
  const raw = str(answers.status);
  if (!raw) return 'Draft';
  return raw;
}
