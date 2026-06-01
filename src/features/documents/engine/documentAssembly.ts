import type { DocumentAssemblyResult, DocumentInput } from '../types';
import { DRAFT_DISCLAIMER } from '../types';
import { generateDocumentManifest } from './documentManifest';

/**
 * Phase 0.1 placeholder: returns an empty draft assembly. Real clause selection,
 * ordering, and rendering arrive once the clause/addendum catalogs are built.
 */
export function assembleDocument(input: DocumentInput): DocumentAssemblyResult {
  return {
    documentType: input.documentType,
    packKey: input.packKey,
    title: '',
    sections: [],
    disclaimer: DRAFT_DISCLAIMER,
    manifest: generateDocumentManifest(input),
  };
}
