import type { DocumentInput, DocumentManifest } from '../types';
import { DRAFT_DISCLAIMER } from '../types';

/**
 * Phase 0.1 placeholder: returns a manifest skeleton recording which pack and
 * document type produced a document. Clause/addendum version tracking is wired
 * up in a later phase once the catalogs exist.
 */
export function generateDocumentManifest(input: DocumentInput): DocumentManifest {
  return {
    documentType: input.documentType,
    packKey: input.packKey,
    packVersion: '0.0.0',
    generatedAt: new Date(0).toISOString(),
    clauseVersions: {},
    addendumVersions: {},
    disclaimer: DRAFT_DISCLAIMER,
  };
}
