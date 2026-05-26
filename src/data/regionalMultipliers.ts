import type { USAddress } from '../types/address';
import { isGuamAddressString } from '../types/address';

export type RegionalMultiplierKey = 'continentalUS' | 'guam' | 'hawaii' | 'alaska';

export const REGIONAL_MULTIPLIERS: Record<RegionalMultiplierKey, number> = {
  continentalUS: 1.0,
  guam: 1.55,
  hawaii: 1.65,
  alaska: 1.75,
};

export const REGIONAL_MULTIPLIER_LABELS: Record<RegionalMultiplierKey, string> = {
  continentalUS: 'Continental US',
  guam: 'Guam',
  hawaii: 'Hawaii',
  alaska: 'Alaska',
};

/** Pick rebar/material regional multiplier from jobsite address. */
export function regionalMultiplierKeyFromAddress(
  address?: USAddress | null,
): RegionalMultiplierKey {
  if (!address) return 'continentalUS';

  const state = (address.state ?? '').trim().toUpperCase();
  if (state === 'GU') return 'guam';
  if (state === 'HI') return 'hawaii';
  if (state === 'AK') return 'alaska';

  const zip = (address.zip ?? '').trim();
  if (/^969\d{2}/.test(zip)) return 'guam';

  const blob = [address.street, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(' ');
  if (isGuamAddressString(blob)) return 'guam';

  return 'continentalUS';
}

export function getRegionalMultiplier(key: RegionalMultiplierKey): number {
  return REGIONAL_MULTIPLIERS[key];
}
