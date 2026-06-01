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
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES, DRAFT_DISCLAIMER, ENGINE_VERSION } from '../types';
import type { QuestionVisibilityRule } from '../types';
import { DEFAULT_PACK_KEY, getPackCatalog } from '../packs/registry';
import {
  answerMatches,
  getAcceptedAddendumKeys,
  getPriceModel,
  getProjectType,
  getQuestionnaireMode,
  getRecommendationDecisions,
  toRenderData,
} from './inputUtils';
import { hashSections } from './hash';
import { renderTemplate } from './templateRenderer';

/**
 * Layered selection precedence (mirrors the report's rule model):
 *   1. jurisdiction / pack    - which catalog is active (registry)
 *   2. project-type layer     - `applicableProjectTypes`
 *   3. pricing layer          - `applicablePriceModels` (e.g. only the selected
 *                               pricing clause renders)
 *   4. risk / answer layer    - `includeWhen` gates optional clauses + addenda
 *   5. notice-formatting layer- locked `state_notice` clauses append in order
 *   6. hard-stop layer        - compliance engine blocks final export
 * Selection here implements layers 2-5; layer 6 lives in complianceEngine.
 */

function clauseApplies(
  clause: DocumentClause,
  projectType: ProjectType | undefined,
  priceModel: PriceModel | undefined,
): boolean {
  const projectOk = projectType === undefined || clause.applicableProjectTypes.includes(projectType);
  const priceOk = priceModel === undefined || clause.applicablePriceModels.includes(priceModel);
  return projectOk && priceOk;
}

/** Answer-driven inclusion: absent rules => always-on; otherwise ALL must match. */
function includeWhenSatisfied(
  rules: QuestionVisibilityRule[] | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every((rule) => answerMatches(answers[rule.questionKey], rule.equals));
}

/**
 * Select clauses for the document in canonical template order, filtered by the
 * resolved project type, price model, and answer-driven `includeWhen` rules.
 * Unknown project type / price model (incomplete draft input) does not filter
 * on that dimension.
 */
export function selectClauses(
  catalog: PackCatalog,
  projectType: ProjectType | undefined,
  priceModel: PriceModel | undefined,
  answers: Record<string, unknown> = {},
): DocumentClause[] {
  const byKey = new Map(catalog.clauses.map((clause) => [clause.key, clause]));
  return catalog.template.clauseKeys
    .map((key) => byKey.get(key))
    .filter((clause): clause is DocumentClause => clause !== undefined)
    .filter((clause) => clauseApplies(clause, projectType, priceModel))
    .filter((clause) => includeWhenSatisfied(clause.includeWhen, answers));
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
  answers: Record<string, unknown> = {},
): DocumentAddendum[] {
  const byKey = new Map(catalog.addenda.map((addendum) => [addendum.key, addendum]));
  const accepted = new Set(acceptedKeys);

  return catalog.template.addendumKeys
    .map((key) => byKey.get(key))
    .filter((addendum): addendum is DocumentAddendum => addendum !== undefined)
    .filter((addendum) => {
      // Explicit acceptance always wins.
      if (accepted.has(addendum.key)) return true;

      // Answer-driven addenda (e.g. design-build) include on a matching answer.
      if (addendum.includeWhen && includeWhenSatisfied(addendum.includeWhen, answers)) {
        return true;
      }

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
  sections: DocumentSection[],
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
    engineVersion: ENGINE_VERSION,
    generatedAt,
    mode: getQuestionnaireMode(input),
    inputSnapshot: {
      packKey: input.packKey,
      answers: input.answers,
      facts: input.facts,
    },
    clauseVersions,
    addendumVersions,
    recommendationDecisions: getRecommendationDecisions(input),
    outputHash: hashSections(sections),
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
      engineVersion: ENGINE_VERSION,
      generatedAt:
        typeof input.facts.generatedAt === 'string'
          ? input.facts.generatedAt
          : new Date().toISOString(),
      mode: getQuestionnaireMode(input),
      inputSnapshot: {
        packKey: input.packKey,
        answers: input.answers,
        facts: input.facts,
      },
      clauseVersions: {},
      addendumVersions: {},
      recommendationDecisions: getRecommendationDecisions(input),
      outputHash: hashSections([]),
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

  const clauses = selectClauses(catalog, projectType, priceModel, data);
  const addenda = selectAddenda(catalog, projectType, priceModel, acceptedKeys, data);

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

  const sections = [...clauseSections, ...addendumSections];

  return {
    documentType: input.documentType,
    packKey: catalog.pack.packKey,
    title: catalog.template.title,
    sections,
    disclaimer: DRAFT_DISCLAIMER,
    manifest: buildManifest(input, catalog, clauses, addenda, sections),
  };
}
