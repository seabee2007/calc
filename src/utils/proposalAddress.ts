import type { ProposalData } from '../types/proposal';
import type { Project } from '../types';
import {
  EMPTY_US_ADDRESS,
  copyUSAddress,
  formatUSAddress,
  hasProjectJobsite,
  isUSAddressGeocodable,
  parseLegacyUSAddress,
  type USAddress,
} from '../types/address';
import { resolveClientAddressForProposal } from '../types/projectClient';

function formattedLine(parts: USAddress | undefined, legacy?: string): string {
  if (parts && isUSAddressGeocodable(parts)) {
    return formatUSAddress(parts);
  }
  return legacy?.trim() ?? '';
}

/** Normalize saved/legacy proposal JSON into structured address parts. */
export function hydrateProposalAddresses(data: ProposalData): ProposalData {
  const businessAddressParts =
    data.businessAddressParts ?? parseLegacyUSAddress(data.businessAddress ?? '');
  const clientAddressParts =
    data.clientAddressParts ?? parseLegacyUSAddress(data.clientAddress ?? '');

  return {
    ...data,
    businessAddressParts,
    clientAddressParts,
    businessAddress: formattedLine(businessAddressParts, data.businessAddress),
    clientAddress: formattedLine(clientAddressParts, data.clientAddress),
  };
}

/** Persist structured parts and formatted strings together. */
export function syncProposalAddressesForSave(data: ProposalData): ProposalData {
  const businessAddressParts = data.businessAddressParts ?? { ...EMPTY_US_ADDRESS };
  const clientAddressParts = data.clientAddressParts ?? { ...EMPTY_US_ADDRESS };

  return {
    ...data,
    businessAddressParts,
    clientAddressParts,
    businessAddress: formattedLine(businessAddressParts),
    clientAddress: formattedLine(clientAddressParts),
  };
}

export function displayClientAddress(data: ProposalData): string {
  return formattedLine(data.clientAddressParts, data.clientAddress);
}

/**
 * Pre-fill proposal client address from the project jobsite when the client block is empty.
 * Used in guided workflow so step 3 has the address from project creation.
 */
export function mergeProjectJobsiteIntoClientAddress(
  data: ProposalData,
  jobsite?: Partial<USAddress> | null,
): ProposalData {
  const hydrated = hydrateProposalAddresses(data);
  if (!jobsite || !hasProjectJobsite(jobsite)) return hydrated;
  if (isUSAddressGeocodable(hydrated.clientAddressParts)) return hydrated;

  const clientParts = copyUSAddress(jobsite);
  return {
    ...hydrated,
    clientAddressParts: clientParts,
    clientAddress: formatUSAddress(clientParts),
  };
}

export function mergeProjectIntoProposalFields(
  data: ProposalData,
  project:
    | Pick<Project, 'name' | 'description' | 'jobsiteAddress' | 'clientInfo'>
    | undefined,
): ProposalData {
  if (!project) return data;

  let next = hydrateProposalAddresses(data);
  const ci = project.clientInfo;

  if (project.name?.trim() && !next.projectTitle?.trim()) {
    next.projectTitle = `${project.name.trim()} Concrete Work`;
  }

  if (ci?.clientName?.trim() && !next.clientName?.trim()) {
    next.clientName = ci.clientName.trim();
  }
  if (ci?.clientCompany?.trim() && !next.clientCompany?.trim()) {
    next.clientCompany = ci.clientCompany.trim();
  }

  const clientAddr = resolveClientAddressForProposal(ci, project.jobsiteAddress);
  next = mergeProjectJobsiteIntoClientAddress(next, clientAddr);

  const scopeText = project.description?.trim();
  if (scopeText) {
    if (!next.scope?.trim()) {
      next.scope = scopeText;
    }
    if (!next.introduction?.trim()) {
      const title = project.name?.trim() || 'your project';
      next.introduction = `We are pleased to submit this proposal for ${title}. ${scopeText}`;
    }
  }

  return next;
}

export function displayBusinessAddress(data: ProposalData): string {
  return formattedLine(data.businessAddressParts, data.businessAddress);
}
