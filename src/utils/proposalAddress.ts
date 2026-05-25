import type { ProposalData } from '../types/proposal';
import {
  EMPTY_US_ADDRESS,
  formatUSAddress,
  isUSAddressGeocodable,
  parseLegacyUSAddress,
  type USAddress,
} from '../types/address';

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

export function displayBusinessAddress(data: ProposalData): string {
  return formattedLine(data.businessAddressParts, data.businessAddress);
}
