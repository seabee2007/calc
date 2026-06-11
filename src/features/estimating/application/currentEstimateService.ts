import { supabase } from '../../../lib/supabase';
import { buildEstimateDraftSnapshot } from './buildEstimateDraftSnapshot';
import {
  draftLineToLineItemInput,
  sortDraftLinesByPosition,
  type EstimateDraftLine,
} from './estimateDraftLine';
import { backfillActivityCodesForDomainTasks } from './estimateActivityCoding';
import {
  buildSelectedDivisionsFromCodes,
  inferDivisionCodesFromItems,
  normalizeSelectedDivisions,
} from './estimateWorkBreakdown';
import {
  calculateQuickFeasibilityEstimate,
  type QuickFeasibilityInputs,
  type QuickFeasibilityResult,
} from './estimateQuickFeasibility';
import {
  buildConceptualEstimateCostTotals,
  buildConceptualEstimateRollup,
  recalculateScenarioTotals,
} from './conceptualEstimateCalculations';
import {
  conceptualEstimateFromAssumptions,
  conceptualEstimateToAssumptions,
} from './conceptualEstimatePersistence';
import type { ConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import { DEFAULT_ESTIMATE_METHOD, getEstimateTypeLabel, normalizeEstimateMethod, resolveSchedulingEnabled } from '../domain/estimateMethods';
import {
  estimateSettingsToAssumptions,
  normalizeEstimateSettings,
  parseEstimateSettingsFromAssumptions,
  type EstimateSettings,
} from './estimateSettings';
import type {
  EstimateCostTotals,
  EstimateModeConfig,
  EstimateSelectedDivision,
  EstimateSnapshot,
  EstimateStatus,
  EstimateType,
} from '../domain/estimateTypes';
import type {
  EstimateDomainTask,
  EstimateDomainVersion,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';

export interface CurrentEstimate {
  id: string;
  projectId: string;
  estimateType: EstimateType | null;
  estimateTypeLabel: string | null;
  schedulingEnabled: boolean;
  estimateModeConfig: EstimateModeConfig | null;
  pricingMode: string | null;
  status: EstimateStatus;
  selectedDivisions: EstimateSelectedDivision[];
  lineItems: EstimateDomainTask[];
  totals: Record<string, unknown>;
  summary: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCurrentEstimateParams {
  projectId: string;
  estimateType: EstimateType;
  createdBy?: string | null;
}

export interface SaveCurrentEstimateParams {
  estimateId?: string | null;
  projectId: string;
  estimateType: EstimateType;
  schedulingEnabled?: boolean;
  estimateModeConfig?: EstimateModeConfig | null;
  pricingMode?: string | null;
  selectedDivisions?: readonly EstimateSelectedDivision[];
  lineItems?: EstimateDomainTask[];
  totals?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  status?: EstimateStatus;
  createdBy?: string | null;
}

export interface SaveCurrentEstimateWithLineItemsParams {
  estimateId?: string | null;
  projectId: string;
  estimateType: EstimateType;
  schedulingEnabled?: boolean;
  estimateModeConfig?: EstimateModeConfig | null;
  pricingMode?: string | null;
  selectedDivisions: readonly EstimateSelectedDivision[];
  draftLines: EstimateDraftLine[];
  estimateSettings?: Partial<EstimateSettings> | null;
  existingAssumptions?: Record<string, unknown>;
  createdBy?: string | null;
}

export interface SaveCurrentQuickFeasibilityParams {
  estimateId?: string | null;
  projectId: string;
  inputs: QuickFeasibilityInputs;
  result: QuickFeasibilityResult;
  createdBy?: string | null;
}

export interface SaveCurrentConceptualEstimateParams {
  estimateId?: string | null;
  projectId: string;
  payload: ConceptualEstimatePayload;
  estimateSettings?: Partial<EstimateSettings> | null;
  existingAssumptions?: Record<string, unknown>;
  schedulingEnabled?: boolean;
  estimateModeConfig?: EstimateModeConfig | null;
  pricingMode?: string | null;
  createdBy?: string | null;
}

const EMPTY_TOTALS: EstimateCostTotals = {
  directCost: 0,
  indirectCost: 0,
  overhead: 0,
  profit: 0,
  contingency: 0,
  tax: 0,
  finalSellPrice: 0,
};

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function failure<T>(error: string): RepositoryResult<T> {
  return { data: null, error };
}

function toErrorMessage(error: { message: string } | null | undefined): string {
  return error?.message || 'An unknown database error occurred.';
}

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseTotals(value: unknown): EstimateCostTotals {
  const record = parseRecord(value);
  return {
    directCost: Number(record.directCost ?? 0) || 0,
    indirectCost: Number(record.indirectCost ?? 0) || 0,
    overhead: Number(record.overhead ?? 0) || 0,
    profit: Number(record.profit ?? 0) || 0,
    contingency: Number(record.contingency ?? 0) || 0,
    tax: Number(record.tax ?? 0) || 0,
    finalSellPrice: Number(record.finalSellPrice ?? 0) || 0,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export function currentEstimateToSummary(estimate: CurrentEstimate) {
  return {
    id: estimate.id,
    projectId: estimate.projectId,
    name: 'Project Estimate',
    status: estimate.status,
    currentVersionId: null,
    createdBy: estimate.createdBy,
    createdAt: estimate.createdAt,
    updatedAt: estimate.updatedAt,
  };
}

function domainTaskFromUnknown(value: unknown, index: number): EstimateDomainTask | null {
  const record = parseRecord(value);
  const lineItem = parseRecord(record.lineItem);
  if (!lineItem.id && !record.id) return null;
  return {
    ...(record as unknown as EstimateDomainTask),
    id: String(record.id ?? lineItem.id),
    position: Number(record.position ?? index) || index,
    lineType: 'task',
    lineItem: {
      ...(lineItem as EstimateDomainTask['lineItem']),
      id: String(lineItem.id ?? record.id),
      description: String(lineItem.description ?? record.title ?? ''),
      quantity:
        lineItem.quantity && typeof lineItem.quantity === 'object'
          ? (lineItem.quantity as EstimateDomainTask['lineItem']['quantity'])
          : { quantity: Number(lineItem.quantity ?? 0) || 0 },
    },
    calculatedValues: parseRecord(record.calculatedValues),
    scheduleEnabled: record.scheduleEnabled !== false,
    weatherSensitive: record.weatherSensitive === true,
    inspectionRequired: record.inspectionRequired === true,
  };
}

export function currentEstimateToDomainVersion(estimate: CurrentEstimate): EstimateDomainVersion {
  const estimateType = normalizeEstimateMethod(
    (estimate.estimateType ?? DEFAULT_ESTIMATE_METHOD) as EstimateType,
  );
  const totals = parseTotals(estimate.totals);
  const summary = parseRecord(estimate.summary);
  const assumptions = parseRecord(estimate.assumptions);
  const quickFeasibility = parseRecord(assumptions.quickFeasibility);
  const conceptualEstimate = conceptualEstimateFromAssumptions(assumptions);

  return {
    id: estimate.id,
    estimateId: estimate.id,
    projectId: estimate.projectId,
    versionNumber: 1,
    versionName: 'Current Estimate',
    estimateType,
    status: estimate.status,
    snapshot: {
      meta: {
        estimateId: estimate.id,
        projectId: estimate.projectId,
        version: 1,
        estimateType,
        status: estimate.status,
        currencyCode: 'USD',
        preparedAtIso: estimate.updatedAt,
      },
      selectedDivisions: estimate.selectedDivisions,
      lineItems: parseArray(summary.lineItems) as EstimateSnapshot['lineItems'],
      totals,
      warnings: [],
      ...(quickFeasibility ? { quickFeasibility } : {}),
      ...(conceptualEstimate ? { conceptualEstimate } : {}),
      ...(assumptions.type ? { type: assumptions.type } : {}),
      ...(assumptions.totals ? { totals: assumptions.totals as EstimateSnapshot['totals'] } : {}),
      ...(assumptions.labor ? { labor: assumptions.labor } : {}),
      ...(assumptions.schedule ? { schedule: assumptions.schedule } : {}),
      ...(assumptions.assumptions ? { assumptions: assumptions.assumptions } : {}),
    },
    totals,
    notes: null,
    createdBy: estimate.createdBy,
    createdAt: estimate.createdAt,
    lineItems: estimate.lineItems,
    warnings: [],
  };
}

function hasMeaningfulCurrentEstimate(row: Record<string, unknown>): boolean {
  const hasType = typeof row.estimate_type === 'string' && row.estimate_type.trim() !== '';
  const hasDivisions = parseArray(row.selected_divisions).length > 0;
  const hasLineItems = parseArray(row.line_items).length > 0;
  const totals = parseRecord(row.totals);
  const hasTotals = Object.keys(totals).length > 0;
  return hasType || hasDivisions || hasLineItems || hasTotals;
}

function parseEstimateModeConfig(value: unknown): EstimateModeConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as EstimateModeConfig;
}

function buildEstimateTypePayloadFields(params: {
  estimateType: EstimateType;
  schedulingEnabled?: boolean | null;
  estimateModeConfig?: EstimateModeConfig | null;
  pricingMode?: string | null;
}) {
  const estimateType = normalizeEstimateMethod(params.estimateType);
  return {
    estimate_type: estimateType,
    estimate_type_label: getEstimateTypeLabel(estimateType),
    scheduling_enabled: resolveSchedulingEnabled(estimateType, params.schedulingEnabled ?? null),
    estimate_mode_config: params.estimateModeConfig ?? null,
    pricing_mode: params.pricingMode ?? null,
  };
}

function mapEstimateRowToCurrentEstimate(row: Record<string, unknown>): CurrentEstimate | null {
  if (!hasMeaningfulCurrentEstimate(row)) return null;

  const selectedDivisions = normalizeSelectedDivisions(
    parseArray(row.selected_divisions).map(
      (item) => parseRecord(item) as Partial<EstimateSelectedDivision>,
    ),
  );
  const lineItems = backfillActivityCodesForDomainTasks(
    parseArray(row.line_items).flatMap((item, index) => {
      const task = domainTaskFromUnknown(item, index);
      return task ? [task] : [];
    }),
  );
  const totals = parseRecord(row.totals);
  const hasPersistedWork =
    selectedDivisions.length > 0 || lineItems.length > 0 || Object.keys(totals).length > 0;
  const rawEstimateType =
    typeof row.estimate_type === 'string' && row.estimate_type.trim() !== ''
      ? normalizeEstimateMethod(row.estimate_type as EstimateType)
      : null;
  const estimateType = rawEstimateType ?? (hasPersistedWork ? 'detailed' : null);
  const createdAt = typeof row.created_at === 'string' ? row.created_at : nowIso();
  const schedulingEnabled = resolveSchedulingEnabled(
    estimateType,
    typeof row.scheduling_enabled === 'boolean' ? row.scheduling_enabled : null,
  );

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    estimateType,
    estimateTypeLabel:
      typeof row.estimate_type_label === 'string' && row.estimate_type_label.trim() !== ''
        ? row.estimate_type_label
        : estimateType
          ? getEstimateTypeLabel(estimateType)
          : null,
    schedulingEnabled,
    estimateModeConfig: parseEstimateModeConfig(row.estimate_mode_config),
    pricingMode: typeof row.pricing_mode === 'string' ? row.pricing_mode : null,
    status: (typeof row.status === 'string' ? row.status : 'draft') as EstimateStatus,
    selectedDivisions,
    lineItems,
    totals,
    summary: parseRecord(row.summary),
    assumptions: parseRecord(row.assumptions),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    createdAt,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : createdAt,
  };
}

export function buildDomainTasksFromDraftLines(params: {
  draftLines: EstimateDraftLine[];
  estimateId: string;
  projectId: string;
  estimateType: EstimateType;
  selectedDivisions?: readonly EstimateSelectedDivision[];
  estimateSettings?: Partial<EstimateSettings> | null;
}): EstimateDomainTask[] {
  const estimateSettings = normalizeEstimateSettings(
    params.estimateSettings ??
      parseEstimateSettingsFromAssumptions({}),
  );
  const snapshot = buildEstimateDraftSnapshot({
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber: 1,
    estimateType: params.estimateType,
    status: 'draft',
    draftLines: [...params.draftLines],
    selectedDivisions: [...(params.selectedDivisions ?? [])],
    estimateSettings,
  });
  return lineItemsFromDraftSnapshot(params.draftLines, snapshot);
}

function lineItemsFromDraftSnapshot(
  draftLines: EstimateDraftLine[],
  snapshot: EstimateSnapshot,
): EstimateDomainTask[] {
  const sorted = sortDraftLinesByPosition(draftLines);
  return sorted.map((draftLine, index) => {
    const input = draftLineToLineItemInput(draftLine);
    const calculatedLine =
      snapshot.lineItems.find((line) => line.id === input.id) ?? snapshot.lineItems[index];
    return {
      ...draftLine.task,
      id: input.id,
      lineType: 'task',
      position: index,
      lineItem: input,
      calculatedValues: {
        ...draftLine.task.calculatedValues,
        unit: draftLine.unit || undefined,
        quantityFormula: calculatedLine?.quantityFormula,
        metrics: calculatedLine?.metrics,
        costs: {
          ...(calculatedLine?.costs ?? {}),
          indirectCost: draftLine.indirectCost,
        },
      },
    };
  });
}

async function findCurrentEstimateRow(projectId: string): Promise<RepositoryResult<Record<string, unknown> | null>> {
  console.log('[Estimate Load] projectId', projectId);
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return failure(toErrorMessage(error));
  console.log('[Estimate Load] result', data);
  console.log('[Estimate Load] hasSavedEstimate', Boolean(data?.id));
  return success(data ? (data as Record<string, unknown>) : null);
}

async function saveEstimateRow(
  payload: Record<string, unknown>,
): Promise<RepositoryResult<CurrentEstimate>> {
  const projectId = String(payload.project_id ?? '');
  const existingId = typeof payload.id === 'string' ? payload.id : null;
  let targetId = existingId;
  console.log('[Estimate Save] projectId', projectId);
  console.log('[Estimate Save] payload', payload);

  if (!targetId) {
    const existingResult = await findCurrentEstimateRow(projectId);
    if (existingResult.error) return failure(existingResult.error);
    targetId = existingResult.data?.id ? String(existingResult.data.id) : null;
  }

  if (targetId) {
    const updatePayload = { ...payload };
    delete updatePayload.id;
    const { data, error } = await supabase
      .from('estimates')
      .update(updatePayload)
      .eq('id', targetId)
      .select('*')
      .single();

    if (error) return failure(toErrorMessage(error));
    console.log('[Estimate Save] result', data);
    const estimate = mapEstimateRowToCurrentEstimate(data as Record<string, unknown>);
    if (!estimate) return failure('Saved estimate row was empty.');
    return success(estimate);
  }

  const { data, error } = await supabase
    .from('estimates')
    .insert(payload)
    .select('*')
    .single();

  if (error) return failure(toErrorMessage(error));
  console.log('[Estimate Save] result', data);
  const estimate = mapEstimateRowToCurrentEstimate(data as Record<string, unknown>);
  if (!estimate) return failure('Saved estimate row was empty.');
  return success(estimate);
}

export async function getCurrentEstimate(
  projectId: string,
): Promise<CurrentEstimate | null> {
  const result = await findCurrentEstimateRow(projectId);
  if (result.error) throw new Error(result.error);
  if (!result.data) return null;
  return mapEstimateRowToCurrentEstimate(result.data);
}

export async function createCurrentEstimate(
  params: CreateCurrentEstimateParams,
): Promise<RepositoryResult<CurrentEstimate>> {
  return saveCurrentEstimate({
    projectId: params.projectId,
    estimateType: params.estimateType,
    selectedDivisions: [],
    lineItems: [],
    totals: EMPTY_TOTALS,
    summary: { lineItems: [] },
    assumptions: {},
    status: 'draft',
    createdBy: params.createdBy ?? null,
  });
}

export async function saveCurrentEstimate(
  params: SaveCurrentEstimateParams,
): Promise<RepositoryResult<CurrentEstimate>> {
  const estimateType = normalizeEstimateMethod(params.estimateType);
  const selectedDivisions = normalizeSelectedDivisions([...(params.selectedDivisions ?? [])]);

  return saveEstimateRow({
    ...(params.estimateId ? { id: params.estimateId } : {}),
    project_id: params.projectId,
    name: 'Project Estimate',
    status: params.status ?? 'draft',
    ...buildEstimateTypePayloadFields({
      estimateType,
      schedulingEnabled: params.schedulingEnabled,
      estimateModeConfig: params.estimateModeConfig,
      pricingMode: params.pricingMode,
    }),
    selected_divisions: selectedDivisions,
    line_items: params.lineItems ?? [],
    totals: params.totals ?? EMPTY_TOTALS,
    summary: params.summary ?? { lineItems: [] },
    assumptions: params.assumptions ?? {},
    created_by: params.createdBy ?? null,
    updated_at: nowIso(),
  });
}

export async function saveCurrentEstimateWithLineItems(
  params: SaveCurrentEstimateWithLineItemsParams,
): Promise<RepositoryResult<CurrentEstimate>> {
  const estimateType = normalizeEstimateMethod(params.estimateType);
  const inferredDivisions = buildSelectedDivisionsFromCodes(
    inferDivisionCodesFromItems(params.draftLines, []),
    { source: 'inferred' },
  );
  const selectedDivisions = normalizeSelectedDivisions([
    ...params.selectedDivisions,
    ...inferredDivisions,
  ]);
  const estimateSettings = normalizeEstimateSettings(
    params.estimateSettings ??
      parseEstimateSettingsFromAssumptions(params.existingAssumptions ?? {}),
  );
  const snapshot = buildEstimateDraftSnapshot({
    estimateId: params.estimateId ?? 'current',
    projectId: params.projectId,
    versionNumber: 1,
    estimateType,
    status: 'draft',
    draftLines: [...params.draftLines],
    selectedDivisions,
    estimateSettings,
  });
  const lineItems = lineItemsFromDraftSnapshot(params.draftLines, snapshot);
  const assumptions = estimateSettingsToAssumptions(
    estimateSettings,
    params.existingAssumptions ?? {},
  );

  return saveEstimateRow({
    ...(params.estimateId ? { id: params.estimateId } : {}),
    project_id: params.projectId,
    name: 'Project Estimate',
    status: 'draft',
    ...buildEstimateTypePayloadFields({
      estimateType,
      schedulingEnabled: params.schedulingEnabled,
      estimateModeConfig: params.estimateModeConfig,
      pricingMode: params.pricingMode,
    }),
    selected_divisions: selectedDivisions,
    line_items: lineItems,
    totals: snapshot.totals,
    summary: {
      lineItems: snapshot.lineItems,
      warnings: snapshot.warnings,
      savedAt: nowIso(),
    },
    assumptions,
    created_by: params.createdBy ?? null,
    updated_at: nowIso(),
  });
}

export async function saveCurrentConceptualEstimate(
  params: SaveCurrentConceptualEstimateParams,
): Promise<RepositoryResult<CurrentEstimate>> {
  const settings = normalizeEstimateSettings(params.estimateSettings);
  const payload: ConceptualEstimatePayload = {
    ...params.payload,
    scenarios: recalculateScenarioTotals(params.payload, settings),
  };
  const rollup = buildConceptualEstimateRollup(payload, settings);
  const costTotals = buildConceptualEstimateCostTotals(rollup);
  const totals = {
    ...costTotals,
    conceptualEstimate: true,
    subtotal: rollup.subtotal,
    escalationTotal: rollup.escalationTotal,
    contingencyPercent: rollup.contingencyPercent,
    totalRiskExposure: rollup.totalRiskExposure,
    recommendedContingencyPercent: rollup.recommendedContingencyPercent,
    aggregateConfidence: rollup.aggregateConfidence,
  };
  const markupSnapshot = estimateSettingsToAssumptions(
    settings,
    params.existingAssumptions ?? {},
  );
  const conceptualAssumptions = conceptualEstimateToAssumptions(payload, {
    estimateSettings: markupSnapshot.estimateSettings,
  });
  const assumptions = {
    ...(params.existingAssumptions ?? {}),
    ...conceptualAssumptions,
    estimateSettings: markupSnapshot.estimateSettings,
  };

  return saveEstimateRow({
    ...(params.estimateId ? { id: params.estimateId } : {}),
    project_id: params.projectId,
    name: 'Project Estimate',
    status: 'draft',
    ...buildEstimateTypePayloadFields({
      estimateType: 'conceptual',
      schedulingEnabled: params.schedulingEnabled,
      estimateModeConfig: params.estimateModeConfig,
      pricingMode: params.pricingMode,
    }),
    selected_divisions: [],
    line_items: [],
    totals,
    summary: {
      savedAt: nowIso(),
      conceptualEstimate: true,
      confidenceSummary: rollup.aggregateConfidence,
      lastUpdated: nowIso(),
    },
    assumptions,
    created_by: params.createdBy ?? null,
    updated_at: nowIso(),
  });
}

export async function saveCurrentQuickFeasibilityEstimate(
  params: SaveCurrentQuickFeasibilityParams,
): Promise<RepositoryResult<CurrentEstimate>> {
  const result = params.result.isValid
    ? params.result
    : calculateQuickFeasibilityEstimate(params.inputs);
  if (!result.isValid) {
    return failure(result.validationMessages[0] ?? 'Quick feasibility estimate is incomplete.');
  }

  const breakdown = result.breakdown;
  const totals = {
    finalSellPrice: breakdown.totals.totalEstimate,
    totalEstimate: breakdown.totals.totalEstimate,
    directCost:
      breakdown.totals.materialCost +
      breakdown.totals.laborCost +
      breakdown.totals.equipmentCost,
    laborCost: breakdown.totals.laborCost,
    materialCost: breakdown.totals.materialCost,
    equipmentCost: breakdown.totals.equipmentCost,
    overhead: breakdown.totals.overhead,
    profit: breakdown.totals.profit,
    contingency: 0,
    tax: 0,
    laborHours: breakdown.labor.laborHours,
    manDays: breakdown.labor.manDays,
    crewDays: breakdown.labor.crewDays,
    estimatedCrewSize: breakdown.labor.estimatedCrewSize,
    plannedDurationDays: breakdown.schedule.plannedDurationDays,
    quickFeasibility: true,
  };
  const assumptions = {
    type: 'quick_feasibility',
    inputs: params.inputs,
    totals: breakdown.totals,
    labor: breakdown.labor,
    schedule: breakdown.schedule,
    assumptions: breakdown.assumptions,
    quickFeasibility: {
      projectType: params.inputs.projectType,
      locationCode: params.inputs.locationCode,
      squareFeet: params.inputs.areaSF,
      basePricePerSf: params.inputs.basePricePerSf,
      basePricePerSfOverridden: params.inputs.basePricePerSfOverridden,
      finishLevel: params.inputs.finishLevel,
      complexity: params.inputs.complexityLevel,
      siteCondition: params.inputs.siteCondition,
      mepIntensity: params.inputs.mepIntensity,
      manualLocationAdjustmentFactor: params.inputs.manualLocationAdjustmentFactor,
      contingencyPercent: params.inputs.contingencyPercent,
      likelyTotal: result.likelyTotal,
      totals: breakdown.totals,
      labor: breakdown.labor,
      schedule: breakdown.schedule,
      breakdownAssumptions: breakdown.assumptions,
      assumptions: result.assumptions,
      warnings: result.warnings,
    },
  };

  return saveEstimateRow({
    ...(params.estimateId ? { id: params.estimateId } : {}),
    project_id: params.projectId,
    name: 'Project Estimate',
    status: 'draft',
    ...buildEstimateTypePayloadFields({
      estimateType: 'quick',
      schedulingEnabled: false,
    }),
    selected_divisions: [],
    line_items: [],
    totals,
    summary: {
      savedAt: nowIso(),
      quickFeasibility: true,
    },
    assumptions,
    created_by: params.createdBy ?? null,
    updated_at: nowIso(),
  });
}

export async function resetCurrentEstimate(projectId: string): Promise<RepositoryResult<null>> {
  const { error } = await supabase
    .from('estimates')
    .delete()
    .eq('project_id', projectId);

  if (error) return failure(toErrorMessage(error));
  return success(null);
}

export const currentEstimateTestExports = {
  mapEstimateRowToCurrentEstimate,
  currentEstimateToDomainVersion,
  lineItemsFromDraftSnapshot,
};
