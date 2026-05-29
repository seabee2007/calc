import {
  EMPTY_US_ADDRESS,
  copyUSAddress,
  sanitizeUSAddress,
  type USAddress,
} from './address';

export interface ProjectClientInfo {
  clientName: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  /** When true (default), proposal client address uses the jobsite address. */
  clientAddressSameAsJobsite?: boolean;
  clientAddress?: USAddress;
}

export const EMPTY_PROJECT_CLIENT: ProjectClientInfo = {
  clientName: '',
  clientCompany: '',
  clientPhone: '',
  clientEmail: '',
  clientAddressSameAsJobsite: true,
  clientAddress: { ...EMPTY_US_ADDRESS },
};

export function sanitizeProjectClientInfo(
  info: Partial<ProjectClientInfo> | undefined,
): ProjectClientInfo | undefined {
  if (!info?.clientName?.trim()) return undefined;

  const sameAsJobsite = info.clientAddressSameAsJobsite !== false;
  const clientAddress = sameAsJobsite
    ? undefined
    : sanitizeUSAddress(info.clientAddress ?? EMPTY_US_ADDRESS);

  return {
    clientName: info.clientName.trim(),
    clientCompany: info.clientCompany?.trim() || undefined,
    clientPhone: info.clientPhone?.trim() || undefined,
    clientEmail: info.clientEmail?.trim() || undefined,
    clientAddressSameAsJobsite: sameAsJobsite,
    clientAddress,
  };
}

export function parseClientInfoFromDb(raw: unknown): ProjectClientInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const clientName = typeof o.clientName === 'string' ? o.clientName.trim() : '';
  if (!clientName) return undefined;

  const addr = o.clientAddress as USAddress | undefined;
  return {
    clientName,
    clientCompany:
      typeof o.clientCompany === 'string' ? o.clientCompany.trim() : undefined,
    clientPhone:
      typeof o.clientPhone === 'string' ? o.clientPhone.trim() : undefined,
    clientEmail:
      typeof o.clientEmail === 'string' ? o.clientEmail.trim() : undefined,
    clientAddressSameAsJobsite: o.clientAddressSameAsJobsite !== false,
    clientAddress: addr ? copyUSAddress(addr) : undefined,
  };
}

export function clientInfoToDbPayload(
  info: ProjectClientInfo | undefined,
): Record<string, unknown> | null {
  const sanitized = sanitizeProjectClientInfo(info);
  if (!sanitized) return null;
  return { ...sanitized };
}

export function resolveClientAddressForProposal(
  clientInfo: ProjectClientInfo | undefined,
  jobsiteAddress?: USAddress,
): USAddress | undefined {
  if (!clientInfo) return jobsiteAddress;
  if (clientInfo.clientAddressSameAsJobsite !== false) {
    return jobsiteAddress;
  }
  return clientInfo.clientAddress;
}
