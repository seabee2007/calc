import {
  ASSUMPTION_IMPACTS,
  CONFIDENCE_LEVELS,
  CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE,
  CONCEPTUAL_LINE_ITEM_TYPES,
  DESIGN_STAGES,
  RISK_LEVELS,
  SOURCE_BASIS_VALUES,
  SYSTEM_CATEGORIES,
  createEmptyConceptualEstimatePayload,
  type ConceptualAllowanceNote,
  type ConceptualAssumption,
  type ConceptualEstimateLineItem,
  type ConceptualEstimatePayload,
  type ConceptualEstimateRevision,
  type ConceptualEstimateScenario,
  type ConceptualExclusion,
  type ConceptualRisk,
} from '../domain/conceptualEstimateTypes';
import { applyLineItemAmount } from './conceptualEstimateCalculations';

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function parseTimestamps(record: Record<string, unknown>): { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return {
    createdAt: parseString(record.createdAt, now),
    updatedAt: parseString(record.updatedAt, now),
  };
}

function parseLineItem(value: unknown): ConceptualEstimateLineItem | null {
  const record = parseRecord(value);
  const title = parseString(record.title).trim();
  if (!title) return null;
  const timestamps = parseTimestamps(record);
  const type = parseEnum(record.type, CONCEPTUAL_LINE_ITEM_TYPES, 'lump_sum');
  const item: ConceptualEstimateLineItem = {
    id: parseString(record.id, `cli-${Date.now()}`),
    estimateId: parseNullableString(record.estimateId),
    type,
    divisionCode: parseNullableString(record.divisionCode),
    divisionName: parseNullableString(record.divisionName),
    systemCategory: record.systemCategory
      ? parseEnum(record.systemCategory, SYSTEM_CATEGORIES, 'other')
      : null,
    title,
    description: parseNullableString(record.description),
    quantity: parseNullableNumber(record.quantity),
    unit: parseNullableString(record.unit),
    unitCost: parseNullableNumber(record.unitCost),
    amount: parseNumber(record.amount),
    confidenceLevel: parseEnum(record.confidenceLevel, CONFIDENCE_LEVELS, 'medium'),
    sourceBasis: record.sourceBasis
      ? parseEnum(record.sourceBasis, SOURCE_BASIS_VALUES, 'estimator_judgment')
      : null,
    escalationPercent: parseNullableNumber(record.escalationPercent),
    notes: parseNullableString(record.notes),
    ...timestamps,
  };
  return applyLineItemAmount(item);
}

function parseAssumption(value: unknown): ConceptualAssumption | null {
  const record = parseRecord(value);
  const title = parseString(record.title).trim();
  if (!title) return null;
  const timestamps = parseTimestamps(record);
  return {
    id: parseString(record.id, `asm-${Date.now()}`),
    title,
    description: parseString(record.description),
    impact: parseEnum(record.impact, ASSUMPTION_IMPACTS, 'cost'),
    relatedDivision: parseNullableString(record.relatedDivision),
    relatedSystem: parseNullableString(record.relatedSystem),
    ...timestamps,
  };
}

function parseExclusion(value: unknown): ConceptualExclusion | null {
  const record = parseRecord(value);
  const title = parseString(record.title).trim();
  if (!title) return null;
  const timestamps = parseTimestamps(record);
  return {
    id: parseString(record.id, `exc-${Date.now()}`),
    title,
    description: parseString(record.description),
    reason: parseString(record.reason),
    potentialCostImpact: parseNullableNumber(record.potentialCostImpact),
    ...timestamps,
  };
}

function parseAllowanceNote(value: unknown): ConceptualAllowanceNote | null {
  const record = parseRecord(value);
  const title = parseString(record.title).trim();
  if (!title) return null;
  const timestamps = parseTimestamps(record);
  return {
    id: parseString(record.id, `aln-${Date.now()}`),
    title,
    includedAmount: parseNumber(record.includedAmount),
    description: parseString(record.description),
    responsibility: parseNullableString(record.responsibility),
    ...timestamps,
  };
}

function parseRisk(value: unknown): ConceptualRisk | null {
  const record = parseRecord(value);
  const title = parseString(record.title).trim();
  if (!title) return null;
  const timestamps = parseTimestamps(record);
  return {
    id: parseString(record.id, `risk-${Date.now()}`),
    title,
    description: parseString(record.description),
    probability: parseEnum(record.probability, RISK_LEVELS, 'medium'),
    impact: parseEnum(record.impact, RISK_LEVELS, 'medium'),
    costExposure: parseNumber(record.costExposure),
    mitigation: parseNullableString(record.mitigation),
    includedInContingency: parseBoolean(record.includedInContingency, true),
    ...timestamps,
  };
}

function parseScenario(value: unknown): ConceptualEstimateScenario | null {
  const record = parseRecord(value);
  const name = parseString(record.name).trim();
  if (!name) return null;
  const timestamps = parseTimestamps(record);
  const lineItemIds = Array.isArray(record.lineItemIds)
    ? record.lineItemIds.map((id) => String(id))
    : [];
  return {
    id: parseString(record.id, `scenario-${Date.now()}`),
    name,
    description: parseNullableString(record.description),
    lineItemIds,
    subtotal: parseNumber(record.subtotal),
    contingency: parseNumber(record.contingency),
    total: parseNumber(record.total),
    notes: parseNullableString(record.notes),
    ...timestamps,
  };
}

function parseRevision(value: unknown): ConceptualEstimateRevision {
  const record = parseRecord(value);
  const defaults = createEmptyConceptualEstimatePayload().revision;
  return {
    name: parseString(record.name, defaults.name),
    date: parseString(record.date, defaults.date),
    notes: parseNullableString(record.notes),
    basisOfEstimate: parseNullableString(record.basisOfEstimate),
    designStage: parseEnum(record.designStage, DESIGN_STAGES, defaults.designStage),
  };
}

export function conceptualEstimateFromAssumptions(
  assumptions: Record<string, unknown> | null | undefined,
): ConceptualEstimatePayload | null {
  if (!isConceptualEstimateAssumptions(assumptions)) {
    return null;
  }

  const defaults = createEmptyConceptualEstimatePayload();
  const lineItems = Array.isArray(assumptions.lineItems)
    ? assumptions.lineItems.flatMap((item) => {
        const parsed = parseLineItem(item);
        return parsed ? [parsed] : [];
      })
    : defaults.lineItems;

  const conceptualAssumptions = Array.isArray(assumptions.assumptions)
    ? assumptions.assumptions.flatMap((item) => {
        const parsed = parseAssumption(item);
        return parsed ? [parsed] : [];
      })
    : defaults.assumptions;

  const exclusions = Array.isArray(assumptions.exclusions)
    ? assumptions.exclusions.flatMap((item) => {
        const parsed = parseExclusion(item);
        return parsed ? [parsed] : [];
      })
    : defaults.exclusions;

  const allowanceNotes = Array.isArray(assumptions.allowanceNotes)
    ? assumptions.allowanceNotes.flatMap((item) => {
        const parsed = parseAllowanceNote(item);
        return parsed ? [parsed] : [];
      })
    : defaults.allowanceNotes;

  const risks = Array.isArray(assumptions.risks)
    ? assumptions.risks.flatMap((item) => {
        const parsed = parseRisk(item);
        return parsed ? [parsed] : [];
      })
    : defaults.risks;

  const scenarios = Array.isArray(assumptions.scenarios)
    ? assumptions.scenarios.flatMap((item) => {
        const parsed = parseScenario(item);
        return parsed ? [parsed] : [];
      })
    : defaults.scenarios;

  return {
    lineItems,
    assumptions: conceptualAssumptions,
    exclusions,
    allowanceNotes,
    risks,
    scenarios,
    revision: parseRevision(assumptions.revision),
    contingencyPercent: parseNumber(assumptions.contingencyPercent, defaults.contingencyPercent),
    selectedScenarioId: parseNullableString(assumptions.selectedScenarioId),
  };
}

export function conceptualEstimateToAssumptions(
  payload: ConceptualEstimatePayload,
  markupSettings?: Record<string, unknown> | null,
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    type: CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE,
    ...(metadata ? { metadata } : {}),
    lineItems: payload.lineItems,
    assumptions: payload.assumptions,
    exclusions: payload.exclusions,
    allowanceNotes: payload.allowanceNotes,
    risks: payload.risks,
    scenarios: payload.scenarios,
    revision: payload.revision,
    contingencyPercent: payload.contingencyPercent,
    selectedScenarioId: payload.selectedScenarioId ?? null,
    ...(markupSettings ? { markupSettings } : {}),
  };
}

export function isConceptualEstimateAssumptions(
  assumptions: Record<string, unknown> | null | undefined,
): boolean {
  if (!assumptions) return false;
  if (assumptions.type === CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE) return true;
  return (
    Array.isArray(assumptions.lineItems) ||
    Array.isArray(assumptions.exclusions) ||
    Array.isArray(assumptions.allowanceNotes) ||
    Array.isArray(assumptions.risks) ||
    Array.isArray(assumptions.scenarios) ||
    Boolean(parseRecord(assumptions.revision).name)
  );
}
