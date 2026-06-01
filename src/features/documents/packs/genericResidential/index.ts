import type { DocumentPack } from '../../types';

/**
 * Default nationwide residential pack. Draft-only: final export is blocked
 * until an attorney-reviewed pack is active for the target jurisdiction.
 */
export const GENERIC_RESIDENTIAL_PACK: DocumentPack = {
  packKey: 'GENERIC_RESIDENTIAL',
  label: 'Generic Residential Contract Pack',
  documentType: 'residential_contract',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: false,
  jurisdictions: ['US'],
  templateKeys: [],
  addendumKeys: [],
  version: '0.1.0',
};
