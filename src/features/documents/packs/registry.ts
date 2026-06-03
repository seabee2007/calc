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
import { GENERIC_FAR_PACK, GENERIC_FAR_TEMPLATE, farPackClauses } from './far';
import {
  GENERIC_SUBMITTAL_PACK,
  GENERIC_SUBMITTAL_TEMPLATE,
  submittalPackClauses,
} from './submittal';
import {
  GENERIC_DAILY_REPORT_PACK,
  GENERIC_DAILY_REPORT_TEMPLATE,
  dailyReportPackClauses,
} from './dailyReport';
import {
  GENERIC_QC_REPORT_PACK,
  GENERIC_QC_REPORT_TEMPLATE,
  qcReportPackClauses,
} from './qcReport';
import {
  GENERIC_WARRANTY_CLOSEOUT_PACK,
  GENERIC_WARRANTY_CLOSEOUT_TEMPLATE,
  warrantyCloseoutPackClauses,
} from './warrantyCloseout';
import {
  GENERIC_PUNCH_LIST_PACK,
  GENERIC_PUNCH_LIST_TEMPLATE,
  punchListPackClauses,
} from './punchList';

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
  [GENERIC_FAR_PACK.packKey]: {
    pack: GENERIC_FAR_PACK,
    template: GENERIC_FAR_TEMPLATE,
    clauses: farPackClauses,
    addenda: [],
  },
  [GENERIC_SUBMITTAL_PACK.packKey]: {
    pack: GENERIC_SUBMITTAL_PACK,
    template: GENERIC_SUBMITTAL_TEMPLATE,
    clauses: submittalPackClauses,
    addenda: [],
  },
  [GENERIC_DAILY_REPORT_PACK.packKey]: {
    pack: GENERIC_DAILY_REPORT_PACK,
    template: GENERIC_DAILY_REPORT_TEMPLATE,
    clauses: dailyReportPackClauses,
    addenda: [],
  },
  [GENERIC_QC_REPORT_PACK.packKey]: {
    pack: GENERIC_QC_REPORT_PACK,
    template: GENERIC_QC_REPORT_TEMPLATE,
    clauses: qcReportPackClauses,
    addenda: [],
  },
  [GENERIC_WARRANTY_CLOSEOUT_PACK.packKey]: {
    pack: GENERIC_WARRANTY_CLOSEOUT_PACK,
    template: GENERIC_WARRANTY_CLOSEOUT_TEMPLATE,
    clauses: warrantyCloseoutPackClauses,
    addenda: [],
  },
  [GENERIC_PUNCH_LIST_PACK.packKey]: {
    pack: GENERIC_PUNCH_LIST_PACK,
    template: GENERIC_PUNCH_LIST_TEMPLATE,
    clauses: punchListPackClauses,
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
