import { format } from 'date-fns';
import type { CompanySettings } from '../services/companySettingsService';
import { mapChangeOrder } from '../services/changeOrderService';
import type { ChangeOrder } from '../types/changeOrder';
import type { Project } from '../types/index';
import { formatUSAddress, usAddressFromFields } from '../types/address';
import { parseClientInfoFromDb, resolveClientAddressForProposal } from '../types/projectClient';
import { formatChangeOrderMoney } from './changeOrderFinancials';

/** Client-safe project fields returned by public change order RPC. */
export interface ChangeOrderPublicProjectSnapshot {
  name: string;
  jobsiteAddress?: Project['jobsiteAddress'];
  clientInfo?: Project['clientInfo'];
  baseContractValue?: number;
  approvedChangeOrderTotal?: number;
  currentContractValue?: number;
}

/** Client-safe company fields returned by public change order RPC. */
export interface ChangeOrderPublicCompanySnapshot {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logoUrl: string | null;
}

export interface ChangeOrderPublicBundle {
  order: ChangeOrder;
  project: ChangeOrderPublicProjectSnapshot | null;
  company: ChangeOrderPublicCompanySnapshot | null;
}

export interface ChangeOrderContractValues {
  originalAmount: number | null;
  originalLabel: string;
  previousApprovedChanges: number;
  previousApprovedLabel: string;
  thisChangeOrderAmount: number;
  thisChangeOrderLabel: string;
  revisedAmount: number | null;
  revisedLabel: string;
}

export interface ChangeOrderDocumentContext {
  company: {
    name: string;
    logoUrl: string | null;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
  };
  project: {
    name: string;
    address: string;
    clientName: string;
    clientCompany: string;
    contractorName: string;
    projectNumber: string | null;
  };
  contractValues: ChangeOrderContractValues;
  documentDate: string;
}

export const CHANGE_ORDER_APPROVAL_STATEMENT =
  'By signing below, both parties acknowledge and approve this change order, including the scope, schedule impact, and pricing stated herein.';

export function buildChangeOrderContractValues(
  project: Pick<
    Project,
    'baseContractValue' | 'approvedChangeOrderTotal' | 'currentContractValue'
  > | null | undefined,
  thisChangeOrderTotal: number,
): ChangeOrderContractValues {
  const original = project?.baseContractValue;
  const hasOriginal = original != null && Number.isFinite(original);
  const previous = project?.approvedChangeOrderTotal ?? 0;
  const thisAmount = thisChangeOrderTotal;

  let revised: number | null = null;
  if (hasOriginal) {
    revised = original + previous + thisAmount;
  } else if (
    project?.currentContractValue != null &&
    Number.isFinite(project.currentContractValue)
  ) {
    revised = project.currentContractValue + thisAmount;
  }

  return {
    originalAmount: hasOriginal ? original : null,
    originalLabel: hasOriginal
      ? formatChangeOrderMoney(original)
      : 'Original contract amount not provided.',
    previousApprovedChanges: previous,
    previousApprovedLabel: formatChangeOrderMoney(previous),
    thisChangeOrderAmount: thisAmount,
    thisChangeOrderLabel: formatChangeOrderMoney(thisAmount),
    revisedAmount: revised,
    revisedLabel: revised != null ? formatChangeOrderMoney(revised) : '—',
  };
}

export function buildChangeOrderDocumentContext(input: {
  order: ChangeOrder;
  project: Project | null | undefined;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  thisChangeOrderTotal: number;
}): ChangeOrderDocumentContext {
  const { order, project, companySettings, thisChangeOrderTotal } = input;
  const jobsite = project?.jobsiteAddress;
  const clientInfo = project?.clientInfo;
  const clientAddress = resolveClientAddressForProposal(clientInfo, jobsite);
  const clientName = clientInfo?.clientName?.trim() || '—';
  const clientCompany = clientInfo?.clientCompany?.trim() || '';
  const projectAddress =
    formatUSAddress(clientAddress) ||
    formatUSAddress(jobsite) ||
    '—';

  const logoUrl =
    companySettings.logoUrl ?? companySettings.logo ?? null;

  let documentDate = format(new Date(), 'MMMM d, yyyy');
  if (order.updatedAt) {
    try {
      documentDate = format(new Date(order.updatedAt), 'MMMM d, yyyy');
    } catch {
      /* keep today */
    }
  }

  return {
    company: {
      name: companySettings.companyName?.trim() || 'Contractor',
      logoUrl,
      address: companySettings.address?.trim() || '',
      phone: companySettings.phone?.trim() || '',
      email: companySettings.email?.trim() || '',
      licenseNumber: companySettings.licenseNumber?.trim() || '',
    },
    project: {
      name: project?.name?.trim() || 'Project',
      address: projectAddress,
      clientName,
      clientCompany,
      contractorName:
        order.contractorName?.trim() ||
        companySettings.companyName?.trim() ||
        'Contractor',
      projectNumber: null,
    },
    contractValues: buildChangeOrderContractValues(project, thisChangeOrderTotal),
    documentDate,
  };
}

function numOrUndefined(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseChangeOrderPublicProject(
  raw: unknown,
): ChangeOrderPublicProjectSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return null;

  return {
    name,
    jobsiteAddress: usAddressFromFields({
      jobsiteStreet: String(row.jobsite_street ?? ''),
      jobsiteStreet2: String(row.jobsite_street2 ?? ''),
      jobsiteCity: String(row.jobsite_city ?? ''),
      jobsiteState: String(row.jobsite_state ?? ''),
      jobsiteZip: String(row.jobsite_zip ?? ''),
    }),
    clientInfo: parseClientInfoFromDb(row.client_info),
    baseContractValue: numOrUndefined(row.base_contract_value),
    approvedChangeOrderTotal: numOrUndefined(row.approved_change_order_total),
    currentContractValue: numOrUndefined(row.current_contract_value),
  };
}

export function parseChangeOrderPublicCompany(
  raw: unknown,
): ChangeOrderPublicCompanySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const companyName =
    typeof row.company_name === 'string' ? row.company_name.trim() : '';
  if (!companyName) return null;

  return {
    companyName,
    address: typeof row.address === 'string' ? row.address.trim() : '',
    phone: typeof row.phone === 'string' ? row.phone.trim() : '',
    email: typeof row.email === 'string' ? row.email.trim() : '',
    licenseNumber:
      typeof row.license_number === 'string' ? row.license_number.trim() : '',
    logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
  };
}

/**
 * Parses RPC response from get_change_order_by_public_token.
 * Supports jsonb bundle (new) and flat change_orders row (legacy fallback).
 */
export function parseChangeOrderPublicBundle(
  data: unknown,
): ChangeOrderPublicBundle | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;

  if ('change_order' in row && row.change_order && typeof row.change_order === 'object') {
    const order = mapChangeOrder(row.change_order as Record<string, unknown>);
    return {
      order,
      project: parseChangeOrderPublicProject(row.project),
      company: parseChangeOrderPublicCompany(row.company),
    };
  }

  if ('id' in row && 'project_id' in row) {
    return {
      order: mapChangeOrder(row),
      project: null,
      company: null,
    };
  }

  return null;
}

export function buildChangeOrderDocumentContextFromPublic(input: {
  order: ChangeOrder;
  project: ChangeOrderPublicProjectSnapshot | null;
  company: ChangeOrderPublicCompanySnapshot | null;
}): ChangeOrderDocumentContext {
  const { order, project, company } = input;
  const projectForContext: Project | null = project
    ? ({
        id: order.projectId,
        name: project.name,
        description: '',
        jobsiteAddress: project.jobsiteAddress,
        clientInfo: project.clientInfo,
        baseContractValue: project.baseContractValue,
        approvedChangeOrderTotal: project.approvedChangeOrderTotal,
        currentContractValue: project.currentContractValue,
        createdAt: '',
        updatedAt: '',
        calculations: [],
      } as Project)
    : null;

  return buildChangeOrderDocumentContext({
    order,
    project: projectForContext,
    companySettings: {
      companyName: company?.companyName ?? order.contractorName ?? 'Contractor',
      address: company?.address ?? '',
      phone: company?.phone ?? '',
      email: company?.email ?? '',
      licenseNumber: company?.licenseNumber ?? '',
      logoUrl: company?.logoUrl ?? null,
    },
    thisChangeOrderTotal: order.total,
  });
}

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrder['status'], string> = {
  draft: 'Draft',
  sent: 'Sent to client',
  viewed: 'Viewed by client',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};
