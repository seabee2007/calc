import type { DocumentInput, DocumentManifest } from '../types';
import { DRAFT_DISCLAIMER } from '../types';
import { DEFAULT_PACK_KEY, getPackCatalog } from '../packs/registry';
import { getPriceModel, getProjectType, getAcceptedAddendumKeys } from './inputUtils';
import { buildManifest, selectAddenda, selectClauses } from './documentAssembly';

/**
 * Generate the document manifest standalone (same selection logic the assembly
 * engine uses): records pack version, generation time, and the exact clause /
 * addendum versions that would be assembled for this input.
 */
export function generateDocumentManifest(input: DocumentInput): DocumentManifest {
  const catalog = getPackCatalog(input.packKey) ?? getPackCatalog(DEFAULT_PACK_KEY);
  if (!catalog) {
    return {
      documentType: input.documentType,
      packKey: input.packKey,
      packVersion: '0.0.0',
      generatedAt:
        typeof input.facts.generatedAt === 'string'
          ? input.facts.generatedAt
          : new Date().toISOString(),
      clauseVersions: {},
      addendumVersions: {},
      disclaimer: DRAFT_DISCLAIMER,
    };
  }

  const projectType = getProjectType(input);
  const priceModel = getPriceModel(input);
  const acceptedKeys = getAcceptedAddendumKeys(input);

  const clauses = selectClauses(catalog, projectType, priceModel);
  const addenda = selectAddenda(catalog, projectType, priceModel, acceptedKeys);

  return buildManifest(input, catalog, clauses, addenda);
}
