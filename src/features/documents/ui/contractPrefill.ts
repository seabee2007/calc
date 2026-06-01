import type { Project } from '../../../types';
import {
  EMPTY_US_ADDRESS,
  formatUSAddress,
  parseLegacyUSAddress,
  sanitizeUSAddress,
} from '../../../types/address';
import type { USAddress } from '../../../types/address';
import { resolveClientAddressForProposal } from '../../../types/projectClient';
import { formatUSPhoneNumber } from '../../../utils/phoneFormat';
import type { SavedProposal } from '../../../lib/proposalService';
import type { ContractAnswers } from './contractInput';

export type ContractPrefillSource = 'project' | 'proposal' | 'company';

export interface ContractPrefillResult {
  values: ContractAnswers;
  sources: Partial<Record<string, ContractPrefillSource>>;
  notes: Partial<Record<string, string>>;
}

function put(
  result: ContractPrefillResult,
  key: string,
  value: unknown,
  source: ContractPrefillSource,
  note?: string,
): void {
  if (value === undefined || value === null || value === '') return;
  result.values[key] = value;
  result.sources[key] = source;
  if (note) result.notes[key] = note;
}

function putAddress(
  result: ContractPrefillResult,
  prefix: 'ownerMailingAddress' | 'propertyAddress' | 'contractorAddress',
  address: Partial<USAddress> | undefined,
  source: ContractPrefillSource,
): void {
  const addr = { ...EMPTY_US_ADDRESS, ...address };
  put(result, `${prefix}Street`, addr.street, source);
  put(result, `${prefix}Street2`, addr.street2, source);
  put(result, `${prefix}City`, addr.city, source);
  put(result, `${prefix}State`, addr.state, source);
  put(result, `${prefix}Zip`, addr.zip, source);
}

function latestProposal(proposals: SavedProposal[]): SavedProposal | undefined {
  return [...proposals].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
}

function acceptedProposal(proposals: SavedProposal[]): SavedProposal | undefined {
  return [...proposals]
    .filter((p) => p.status === 'accepted' || Boolean(p.accepted_at))
    .sort((a, b) => {
      const aTime = new Date(a.accepted_at ?? a.updated_at).getTime();
      const bTime = new Date(b.accepted_at ?? b.updated_at).getTime();
      return bTime - aTime;
    })[0];
}

function firstPositive(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function legacyJobsiteString(project: Project): string | undefined {
  const placement = project.placementOrder?.jobsiteAddress;
  if (typeof placement === 'string' && placement.trim()) return placement.trim();
  return undefined;
}

/** Normalize jobsite address from structured fields, with a narrow legacy-string fallback for zip. */
export function resolveProjectJobsiteAddress(project: Project): USAddress | undefined {
  const structured = project.jobsiteAddress
    ? sanitizeUSAddress(project.jobsiteAddress)
    : undefined;
  const hasStructuredParts = Boolean(
    structured?.street || structured?.city || structured?.state || structured?.zip,
  );
  if (structured && hasStructuredParts) {
    if (structured.zip) return structured;
    const legacy = legacyJobsiteString(project);
    if (legacy) {
      const parsed = parseLegacyUSAddress(legacy);
      if (parsed.zip) {
        return sanitizeUSAddress({ ...structured, zip: parsed.zip });
      }
    }
    return structured;
  }

  const legacy = legacyJobsiteString(project);
  if (legacy) {
    const parsed = parseLegacyUSAddress(legacy);
    const formatted = formatUSAddress(parsed);
    if (formatted) return parsed;
  }

  return structured;
}

/** Fingerprint for prefill re-run when project jobsite data enriches after initial load. */
export function jobsitePrefillFingerprint(project: Project | undefined): string {
  if (!project) return '';
  const jobsite = resolveProjectJobsiteAddress(project);
  return [
    jobsite?.street ?? '',
    jobsite?.street2 ?? '',
    jobsite?.city ?? '',
    jobsite?.state ?? '',
    jobsite?.zip ?? '',
  ].join('|');
}

function inferProjectType(project: Project): string | undefined {
  const text = `${project.name} ${project.description}`.toLowerCase();
  if (text.includes('roof')) return 'roofing';
  if (text.includes('deck')) return 'deck';
  if (text.includes('fence')) return 'fence';
  if (text.includes('adu')) return 'adu';
  if (text.includes('insurance') || text.includes('restoration')) return 'insurance_restoration';
  if (text.includes('concrete') || text.includes('slab') || text.includes('driveway')) {
    return 'concrete';
  }
  return undefined;
}

export function buildContractPrefillFromProject(
  project: Project | undefined,
  proposals: SavedProposal[] = [],
): ContractPrefillResult {
  const result: ContractPrefillResult = { values: {}, sources: {}, notes: {} };
  if (!project) return result;

  const clientInfo = project.clientInfo;
  const jobsite = resolveProjectJobsiteAddress(project);
  const clientAddress = resolveClientAddressForProposal(clientInfo, jobsite);

  put(result, 'projectName', project.name, 'project', 'Imported from selected project');
  put(result, 'projectType', inferProjectType(project), 'project', 'Imported from selected project');
  put(
    result,
    'scopeSummary',
    project.description,
    'project',
    'Imported from project details. Review before sending.',
  );

  put(result, 'ownerFullName', clientInfo?.clientName, 'project', 'Imported from selected project');
  put(
    result,
    'ownerPhone',
    clientInfo?.clientPhone ? formatUSPhoneNumber(clientInfo.clientPhone) : undefined,
    'project',
    'Imported from selected project',
  );
  put(result, 'ownerEmail', clientInfo?.clientEmail, 'project', 'Imported from selected project');
  putAddress(result, 'ownerMailingAddress', clientAddress, 'project');
  putAddress(result, 'propertyAddress', jobsite, 'project');

  const accepted = acceptedProposal(proposals);
  const latest = latestProposal(proposals);
  const proposalForScope = accepted ?? latest;
  put(
    result,
    'scopeSummary',
    proposalForScope?.data?.scope || result.values.scopeSummary,
    proposalForScope?.data?.scope ? 'proposal' : 'project',
    proposalForScope?.data?.scope
      ? 'Imported from project details. Review before sending.'
      : 'Imported from project details. Review before sending.',
  );

  const acceptedTotal = firstPositive(accepted?.total_amount);
  const latestTotal = firstPositive(latest?.total_amount);
  const projectTotal = firstPositive(project.currentContractValue, project.baseContractValue);
  if (acceptedTotal) {
    put(result, 'priceModel', 'fixed_price', 'proposal');
    put(result, 'contractPrice', acceptedTotal, 'proposal', 'Imported from accepted proposal');
  } else if (latestTotal) {
    put(result, 'priceModel', 'fixed_price', 'proposal');
    put(result, 'contractPrice', latestTotal, 'proposal', 'Imported from latest proposal');
  } else if (projectTotal) {
    put(result, 'priceModel', 'fixed_price', 'project');
    put(result, 'contractPrice', projectTotal, 'project', 'Imported from project details');
  }

  return result;
}

export function buildContractCompanyPrefill(company: {
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
}): ContractPrefillResult {
  const result: ContractPrefillResult = { values: {}, sources: {}, notes: {} };
  put(result, 'contractorLegalName', company.legalName, 'company');
  put(result, 'contractorPhone', company.phone ? formatUSPhoneNumber(company.phone) : undefined, 'company');
  put(result, 'contractorEmail', company.email, 'company');
  put(result, 'contractorLicenseNumber', company.licenseNumber, 'company');
  if (company.address) {
    putAddress(result, 'contractorAddress', parseLegacyUSAddress(company.address), 'company');
    put(result, 'contractorAddressLegacy', formatUSAddress(parseLegacyUSAddress(company.address)), 'company');
  }
  return result;
}
