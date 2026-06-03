import type { DocumentPack, PackCatalog } from '../types';
import {
  GENERIC_RESIDENTIAL_PACK,
  GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE,
  genericResidentialClauses,
  genericResidentialAddendums,
} from './genericResidential';
import { concreteAddendums } from './concrete';
import { stateCatalogs } from './statePacks';
import {
  GENERIC_CHANGE_ORDER_PACK,
  GENERIC_CHANGE_ORDER_TEMPLATE,
  changeOrderPackClauses,
} from './changeOrder';
import { GENERIC_RFI_PACK, GENERIC_RFI_TEMPLATE, rfiPackClauses } from './rfi';

/**
 * Pack registry. Resolves a `packKey` to its full catalog (metadata + template
 * + clause/addendum data). The Generic Residential Pack is the nationwide
 * default; state packs (CA/FL/NY locked statutory notices, TX/GA/GU draft
 * warnings) layer their notices on top of the generic catalog.
 */
const PACK_CATALOGS: Record<string, PackCatalog> = {
  [GENERIC_RESIDENTIAL_PACK.packKey]: {
    pack: GENERIC_RESIDENTIAL_PACK,
    template: GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE,
    clauses: genericResidentialClauses,
    addenda: [...genericResidentialAddendums, ...concreteAddendums],
  },
  [GENERIC_CHANGE_ORDER_PACK.packKey]: {
    pack: GENERIC_CHANGE_ORDER_PACK,
    template: GENERIC_CHANGE_ORDER_TEMPLATE,
    clauses: changeOrderPackClauses,
    addenda: [],
  },
  [GENERIC_RFI_PACK.packKey]: {
    pack: GENERIC_RFI_PACK,
    template: GENERIC_RFI_TEMPLATE,
    clauses: rfiPackClauses,
    addenda: [],
  },
  ...Object.fromEntries(stateCatalogs.map((catalog) => [catalog.pack.packKey, catalog])),
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

/** All registered pack metadata (Generic Residential first, then state packs). */
export function listPacks(): DocumentPack[] {
  return Object.values(PACK_CATALOGS).map((catalog) => catalog.pack);
}
