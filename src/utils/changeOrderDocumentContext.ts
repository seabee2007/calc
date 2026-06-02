import { format } from 'date-fns';
import type { CompanySettings } from '../services/companySettingsService';
import type { ChangeOrder } from '../types/changeOrder';
import type { Project } from '../types/index';
import { formatUSAddress } from '../types/address';
import { resolveClientAddressForProposal } from '../types/projectClient';
import { formatChangeOrderMoney } from './changeOrderFinancials';

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

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrder['status'], string> = {
  draft: 'Draft',
  sent: 'Sent to client',
  viewed: 'Viewed by client',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};
