import type {
  DocumentClause,
  DocumentPack,
  DocumentPackStatus,
  DocumentTemplate,
  PackCatalog,
} from '../../types';
import {
  genericResidentialClauses,
  genericResidentialClauseKeys,
  genericResidentialAddendums,
  genericResidentialAddendumKeys,
} from '../genericResidential';
import { concreteAddendums, concreteAddendumKeys } from '../concrete';
import { californiaNotices } from './notices/california';
import { floridaNotices } from './notices/florida';
import { newYorkNotices } from './notices/newYork';
import { texasNotices, georgiaNotices, guamNotices } from './notices/draftWarnings';

/**
 * State-specific legal packs. Each pack reuses the Generic Residential clause
 * and addendum catalog and APPENDS that jurisdiction's locked statutory notice
 * blocks. Notices are draft-only and require attorney review - no pack is
 * attorney reviewed, so final export stays blocked everywhere for now.
 */

const residentialAddenda = [...genericResidentialAddendums, ...concreteAddendums];
const residentialAddendumKeys = [...genericResidentialAddendumKeys, ...concreteAddendumKeys];

interface StatePackSpec {
  packKey: string;
  label: string;
  jurisdiction: string;
  status: DocumentPackStatus;
  notices: DocumentClause[];
}

function buildStateCatalog(spec: StatePackSpec): PackCatalog {
  const templateKey = `${spec.packKey}_CONTRACT`;
  const noticeKeys = spec.notices.map((n) => n.key);

  const template: DocumentTemplate = {
    templateKey,
    title: `${spec.label} (Draft)`,
    documentType: 'residential_contract',
    clauseKeys: [...genericResidentialClauseKeys, ...noticeKeys],
    addendumKeys: residentialAddendumKeys,
    version: '0.1.0',
  };

  const pack: DocumentPack = {
    packKey: spec.packKey,
    label: spec.label,
    documentType: 'residential_contract',
    status: spec.status,
    attorneyReviewed: false,
    finalExportAllowed: false,
    jurisdictions: [spec.jurisdiction],
    templateKeys: [templateKey],
    addendumKeys: residentialAddendumKeys,
    version: '0.1.0',
  };

  return {
    pack,
    template,
    clauses: [...genericResidentialClauses, ...spec.notices],
    addenda: residentialAddenda,
  };
}

const STATE_PACK_SPECS: StatePackSpec[] = [
  {
    packKey: 'CA_RESIDENTIAL',
    label: 'California Residential Contract Pack',
    jurisdiction: 'CA',
    status: 'attorney_review_required',
    notices: californiaNotices,
  },
  {
    packKey: 'FL_RESIDENTIAL',
    label: 'Florida Residential Contract Pack',
    jurisdiction: 'FL',
    status: 'attorney_review_required',
    notices: floridaNotices,
  },
  {
    packKey: 'NY_RESIDENTIAL',
    label: 'New York Residential Contract Pack',
    jurisdiction: 'NY',
    status: 'attorney_review_required',
    notices: newYorkNotices,
  },
  {
    packKey: 'TX_RESIDENTIAL',
    label: 'Texas Residential Contract Pack',
    jurisdiction: 'TX',
    status: 'draft_only',
    notices: texasNotices,
  },
  {
    packKey: 'GA_RESIDENTIAL',
    label: 'Georgia Residential Contract Pack',
    jurisdiction: 'GA',
    status: 'draft_only',
    notices: georgiaNotices,
  },
  {
    packKey: 'GU_RESIDENTIAL',
    label: 'Guam Residential Contract Pack',
    jurisdiction: 'GU',
    status: 'draft_only',
    notices: guamNotices,
  },
];

/** Fully resolved state pack catalogs, keyed for registry merge. */
export const stateCatalogs: PackCatalog[] = STATE_PACK_SPECS.map(buildStateCatalog);

/** State pack metadata (barrel export). */
export const statePacks: DocumentPack[] = stateCatalogs.map((c) => c.pack);
