import type {
  DocumentAddendum,
  DocumentAssemblyResult,
  DocumentClause,
  DocumentInput,
  DocumentManifest,
  DocumentSection,
  PackCatalog,
  PriceModel,
  ProjectType,
} from '../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES, DRAFT_DISCLAIMER } from '../types';
import { DEFAULT_PACK_KEY, getPackCatalog } from '../packs/registry';
import {
  getAcceptedAddendumKeys,
  getPriceModel,
  getProjectType,
  toRenderData,
} from './inputUtils';
import { renderTemplate } from './templateRenderer';

function clauseApplies(
  clause: DocumentClause,
  projectType: ProjectType | undefined,
  priceModel: PriceModel | undefined,
): boolean {
  const projectOk = projectType === undefined || clause.applicableProjectTypes.includes(projectType);
  const priceOk = priceModel === undefined || clause.applicablePriceModels.includes(priceModel);
  return projectOk && priceOk;
}

/**
 * Select clauses for the document in canonical template order, filtered by the
 * resolved project type and price model. Unknown project type / price model
 * (incomplete draft input) does not filter on that dimension.
 */
export function selectClauses(
  catalog: PackCatalog,
  projectType: ProjectType | undefined,
  priceModel: PriceModel | undefined,
): DocumentClause[] {
  const byKey = new Map(catalog.clauses.map((clause) => [clause.key, clause]));
  return catalog.template.clauseKeys
    .map((key) => byKey.get(key))
    .filter((clause): clause is DocumentClause => clause !== undefined)
    .filter((clause) => clauseApplies(clause, projectType, priceModel));
}

/**
 * Select addenda in template order. An addendum is included when it is either:
 *   - explicitly accepted by the contractor (`acceptedKeys`), or
 *   - narrowly applicable (project-type- or price-model-specific) and the
 *     resolved project type / price model matches.
 * Broadly-applicable addenda (apply to everything) are opt-in only.
 */
export function selectAddenda(
  catalog: PackCatalog,
  projectType: ProjectType | undefined,
  priceModel: PriceModel | undefined,
  acceptedKeys: string[],
): DocumentAddendum[] {
  const byKey = new Map(catalog.addenda.map((addendum) => [addendum.key, addendum]));
  const accepted = new Set(acceptedKeys);

  return catalog.template.addendumKeys
    .map((key) => byKey.get(key))
    .filter((addendum): addendum is DocumentAddendum => addendum !== undefined)
    .filter((addendum) => {
      if (accepted.has(addendum.key)) return true;

      const matchesProject =
        projectType === undefined || addendum.applicableProjectTypes.includes(projectType);
      const matchesPrice =
        priceModel === undefined || addendum.applicablePriceModels.includes(priceModel);
      if (!matchesProject || !matchesPrice) return false;

      const narrowProject = addendum.applicableProjectTypes.length < ALL_PROJECT_TYPES.length;
      const narrowPrice = addendum.applicablePriceModels.length < ALL_PRICE_MODELS.length;
      const autoByProject = narrowProject && projectType !== undefined;
      const autoByPrice = narrowPrice && priceModel !== undefined;
      return autoByProject || autoByPrice;
    });
}

export function buildManifest(
  input: DocumentInput,
  catalog: PackCatalog,
  clauses: DocumentClause[],
  addenda: DocumentAddendum[],
): DocumentManifest {
  const generatedAt =
    typeof input.facts.generatedAt === 'string'
      ? input.facts.generatedAt
      : new Date().toISOString();

  const clauseVersions: Record<string, string> = {};
  for (const clause of clauses) clauseVersions[clause.key] = clause.version;

  const addendumVersions: Record<string, string> = {};
  for (const addendum of addenda) addendumVersions[addendum.key] = addendum.version;

  return {
    documentType: input.documentType,
    packKey: catalog.pack.packKey,
    packVersion: catalog.pack.version,
    generatedAt,
    clauseVersions,
    addendumVersions,
    disclaimer: DRAFT_DISCLAIMER,
  };
}

function emptyResult(input: DocumentInput): DocumentAssemblyResult {
  return {
    documentType: input.documentType,
    packKey: input.packKey,
    title: '',
    sections: [],
    disclaimer: DRAFT_DISCLAIMER,
    manifest: {
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
    },
  };
}

/**
 * Deterministically assemble a draft document: resolve the active pack, select
 * applicable clauses and addenda, interpolate their templates from structured
 * input, and emit ordered sections plus a clause/addendum version manifest.
 */
export function assembleDocument(input: DocumentInput): DocumentAssemblyResult {
  const catalog = getPackCatalog(input.packKey) ?? getPackCatalog(DEFAULT_PACK_KEY);
  if (!catalog) return emptyResult(input);

  const projectType = getProjectType(input);
  const priceModel = getPriceModel(input);
  const acceptedKeys = getAcceptedAddendumKeys(input);
  const data = toRenderData(input);

  const clauses = selectClauses(catalog, projectType, priceModel);
  const addenda = selectAddenda(catalog, projectType, priceModel, acceptedKeys);

  const clauseSections: DocumentSection[] = clauses.map((clause) => ({
    clauseKey: clause.key,
    title: clause.title,
    body: renderTemplate(clause.bodyTemplate, data),
  }));

  const addendumSections: DocumentSection[] = addenda.map((addendum) => ({
    clauseKey: addendum.key,
    title: addendum.title,
    body: renderTemplate(addendum.bodyTemplate, data),
  }));

  return {
    documentType: input.documentType,
    packKey: catalog.pack.packKey,
    title: catalog.template.title,
    sections: [...clauseSections, ...addendumSections],
    disclaimer: DRAFT_DISCLAIMER,
    manifest: buildManifest(input, catalog, clauses, addenda),
  };
}
