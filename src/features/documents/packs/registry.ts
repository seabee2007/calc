import type { DocumentPack, PackCatalog } from '../types';
import {
  GENERIC_RESIDENTIAL_PACK,
  GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE,
  genericResidentialClauses,
  genericResidentialAddendums,
} from './genericResidential';
import { concreteAddendums } from './concrete';

/**
 * Pack registry. Resolves a `packKey` to its full catalog (metadata + template
 * + concrete clause/addendum data). Only the Generic Residential Pack is wired
 * up today; state and specialty packs register here in later phases.
 */
const PACK_CATALOGS: Record<string, PackCatalog> = {
  [GENERIC_RESIDENTIAL_PACK.packKey]: {
    pack: GENERIC_RESIDENTIAL_PACK,
    template: GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE,
    clauses: genericResidentialClauses,
    addenda: [...genericResidentialAddendums, ...concreteAddendums],
  },
};

export const DEFAULT_PACK_KEY = GENERIC_RESIDENTIAL_PACK.packKey;

export function getPackCatalog(packKey: string): PackCatalog | undefined {
  return PACK_CATALOGS[packKey];
}

export function getPack(packKey: string): DocumentPack | undefined {
  return PACK_CATALOGS[packKey]?.pack;
}

export function listPackKeys(): string[] {
  return Object.keys(PACK_CATALOGS);
}
