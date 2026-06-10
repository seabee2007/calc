import type {
  EstimateActivityType,
  EstimateCostTotals,
  EstimateDimensionsInput,
  EstimateLineItemInput,
  EstimateLineSnapshot,
  EstimateRelationshipType,
  EstimateSnapshot,
  EstimateSnapshotMeta,
  EstimateStatus,
  EstimateType,
  EquipmentRateType,
  EstimateQuantityFormula,
  ProductionRateType,
} from '../domain/estimateTypes';
import type {
  EstimateDomainTask,
  EstimateDomainVersion,
  EstimateLineItemInsert,
  EstimateLineItemRow,
  EstimateLineItemType,
  EstimateRow,
  EstimateSummary,
  EstimateVersionInsert,
  EstimateVersionRow,
  MapCalculatedTaskToLineItemInsertParams,
  MapDomainTaskToLineItemInsertParams,
  MapEstimateSnapshotToVersionInsertParams,
} from './estimateDbTypes';
import {
  ESTIMATE_QUANTITY_FORMULAS,
  PRODUCTION_RATE_TYPES,
} from './estimateDbTypes';
import { isStoredEstimateType, normalizeEstimateMethod } from '../domain/estimateMethods';

const EMPTY_TOTALS: EstimateCostTotals = {
  directCost: 0,
  indirectCost: 0,
  overhead: 0,
  profit: 0,
  contingency: 0,
  tax: 0,
  finalSellPrice: 0,
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function isQuantityFormula(value: unknown): value is EstimateQuantityFormula {
  return (
    typeof value === 'string' &&
    (ESTIMATE_QUANTITY_FORMULAS as readonly string[]).includes(value)
  );
}

function isProductionRateType(value: unknown): value is ProductionRateType {
  return (
    typeof value === 'string' && (PRODUCTION_RATE_TYPES as readonly string[]).includes(value)
  );
}

function isEquipmentRateType(value: unknown): value is EquipmentRateType {
  return (
    typeof value === 'string' &&
    ['hour', 'day', 'week', 'month', 'lump_sum'].includes(value)
  );
}

function isActivityType(value: unknown): value is EstimateActivityType {
  return (
    typeof value === 'string' &&
    ['work', 'inspection', 'milestone', 'curing_lag', 'procurement_lead_time', 'testing'].includes(
      value,
    )
  );
}

function isRelationshipType(value: unknown): value is EstimateRelationshipType {
  return typeof value === 'string' && ['FS', 'SS', 'FF', 'SF'].includes(value);
}

function isLineItemType(value: unknown): value is EstimateLineItemType {
  return (
    typeof value === 'string' &&
    [
      'division',
      'scope',
      'assembly',
      'task',
      'material',
      'equipment',
      'subcontractor',
      'indirect',
    ].includes(value)
  );
}

function parseEstimateType(value: unknown, fallback: EstimateType): EstimateType {
  if (isStoredEstimateType(value)) {
    return normalizeEstimateMethod(value);
  }
  return normalizeEstimateMethod(fallback);
}

function isEstimateStatus(value: unknown): value is EstimateStatus {
  return (
    typeof value === 'string' &&
    ['draft', 'review', 'sent', 'accepted', 'rejected', 'superseded'].includes(value)
  );
}

function parseDimensions(value: unknown): EstimateDimensionsInput | undefined {
  const obj = parseJsonObject(value);
  const length = toNumber(obj.length, NaN);
  const width = toNumber(obj.width, NaN);
  const height = toNumber(obj.height, NaN);
  const dimensions: EstimateDimensionsInput = {};
  if (Number.isFinite(length)) dimensions.length = length;
  if (Number.isFinite(width)) dimensions.width = width;
  if (Number.isFinite(height)) dimensions.height = height;
  return Object.keys(dimensions).length > 0 ? dimensions : undefined;
}

function parseTotalsJson(value: unknown): EstimateCostTotals {
  const obj = parseJsonObject(value);
  return {
    directCost: toNumber(obj.directCost ?? obj.direct_cost),
    indirectCost: toNumber(obj.indirectCost ?? obj.indirect_cost),
    overhead: toNumber(obj.overhead),
    profit: toNumber(obj.profit),
    contingency: toNumber(obj.contingency),
    tax: toNumber(obj.tax),
    finalSellPrice: toNumber(obj.finalSellPrice ?? obj.final_sell_price),
  };
}

function parseSnapshotMeta(value: unknown, row: EstimateVersionRow): EstimateSnapshotMeta {
  const obj = parseJsonObject(value);
  const metaObj = parseJsonObject(obj.meta);
  return {
    estimateId: toOptionalString(metaObj.estimateId ?? metaObj.estimate_id) ?? row.estimate_id,
    projectId: toOptionalString(metaObj.projectId ?? metaObj.project_id) ?? row.project_id,
    version: toNumber(metaObj.version, row.version_number),
    estimateType: parseEstimateType(
      metaObj.estimateType ?? metaObj.estimate_type,
      row.estimate_type,
    ),
    status: isEstimateStatus(metaObj.status) ? metaObj.status : row.status,
    currencyCode: toOptionalString(metaObj.currencyCode ?? metaObj.currency_code) ?? 'USD',
    preparedAtIso:
      toOptionalString(metaObj.preparedAtIso ?? metaObj.prepared_at_iso) ?? row.created_at,
  };
}

export function mapEstimateRowToSummary(row: EstimateRow): EstimateSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    currentVersionId: row.current_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEstimateTotalsToJson(totals: EstimateCostTotals): Record<string, unknown> {
  return {
    directCost: totals.directCost,
    indirectCost: totals.indirectCost,
    overhead: totals.overhead,
    profit: totals.profit,
    contingency: totals.contingency,
    tax: totals.tax,
    finalSellPrice: totals.finalSellPrice,
  };
}

export function mapEstimateSnapshotToVersionInsert(
  params: MapEstimateSnapshotToVersionInsertParams,
): EstimateVersionInsert {
  const { snapshot, estimateId, projectId, versionNumber, versionName, createdBy, notes } =
    params;

  return {
    estimate_id: estimateId,
    project_id: projectId,
    version_number: versionNumber,
    version_name: versionName,
    estimate_type: snapshot.meta.estimateType,
    status: snapshot.meta.status,
    snapshot: {
      meta: snapshot.meta,
      pricing: snapshot.pricing,
      selectedDivisions: snapshot.selectedDivisions ?? [],
      lineItems: snapshot.lineItems,
      warnings: snapshot.warnings,
    },
    totals: mapEstimateTotalsToJson(snapshot.totals),
    notes: notes ?? null,
    created_by: createdBy ?? null,
  };
}

export function mapEstimateVersionRowToDomain(
  row: EstimateVersionRow,
): Omit<EstimateDomainVersion, 'lineItems'> {
  const snapshotObj = parseJsonObject(row.snapshot);
  const warnings: string[] = [];
  const totals = parseTotalsJson(row.totals);

  if (Object.keys(parseJsonObject(row.totals)).length === 0) {
    warnings.push('Version totals JSON was empty; defaulted to zero totals.');
  }

  const meta = parseSnapshotMeta(snapshotObj, row);

  return {
    id: row.id,
    estimateId: row.estimate_id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    versionName: row.version_name,
    estimateType: row.estimate_type,
    status: row.status,
    snapshot: {
      ...snapshotObj,
      meta,
      pricing: parseJsonObject(snapshotObj.pricing) as EstimateSnapshot['pricing'],
      lineItems: Array.isArray(snapshotObj.lineItems)
        ? (snapshotObj.lineItems as EstimateSnapshot['lineItems'])
        : [],
      totals,
      warnings: Array.isArray(snapshotObj.warnings)
        ? (snapshotObj.warnings as EstimateSnapshot['warnings'])
        : [],
    },
    totals: Object.keys(parseJsonObject(row.totals)).length > 0 ? totals : { ...EMPTY_TOTALS },
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    warnings,
  };
}

export function mapLineItemRowToDomainTask(
  row: EstimateLineItemRow,
  warnings: string[] = [],
): EstimateDomainTask {
  const calculatedValues = parseJsonObject(row.calculated_values);
  const quantityInput = parseJsonObject(calculatedValues.quantityInput);
  const laborInput = parseJsonObject(calculatedValues.laborInput);
  const materialInput = parseJsonObject(calculatedValues.materialInput);
  const equipmentInput = parseJsonObject(calculatedValues.equipmentInput);
  const subcontractorInput = parseJsonObject(calculatedValues.subcontractorInput);

  const formulaFromCalc = calculatedValues.quantityFormula ?? quantityInput.formula;
  const formula = isQuantityFormula(formulaFromCalc) ? formulaFromCalc : 'quantity_with_waste';

  const productionRateTypeRaw =
    row.production_rate_type ?? laborInput.productionRateType ?? laborInput.production_rate_type;
  const productionRateType = isProductionRateType(productionRateTypeRaw)
    ? productionRateTypeRaw
    : undefined;

  const equipmentRateTypeRaw = equipmentInput.rateType ?? equipmentInput.rate_type;
  const equipmentRateType = isEquipmentRateType(equipmentRateTypeRaw)
    ? equipmentRateTypeRaw
    : undefined;

  const lineItem: EstimateLineItemInput = {
    id: row.id,
    description: toOptionalString(row.description) ?? row.title,
    csiDivision: toOptionalString(row.csi_division),
    csiSection: toOptionalString(row.csi_section),
    quantity: {
      formula,
      quantity: toNumber(quantityInput.quantity, toNumber(row.quantity)),
      wastePercent: toNumber(quantityInput.wastePercent ?? quantityInput.waste_percent, toNumber(row.waste_percent)),
      dimensions: parseDimensions(quantityInput.dimensions),
      openingArea: toNumber(quantityInput.openingArea ?? quantityInput.opening_area, NaN) || undefined,
      coveragePerUnit:
        toNumber(quantityInput.coveragePerUnit ?? quantityInput.coverage_per_unit, NaN) || undefined,
    },
    labor: {
      productionRate: toNumber(laborInput.productionRate ?? laborInput.production_rate, toNumber(row.production_rate)),
      productionRateType,
      hoursPerDay: toNumber(laborInput.hoursPerDay ?? laborInput.hours_per_day, toNumber(row.hours_per_day, 8)),
      crewSize: toNumber(laborInput.crewSize ?? laborInput.crew_size, toNumber(row.crew_size)),
      parallelCrews: toNumber(laborInput.parallelCrews ?? laborInput.parallel_crews, 1) || undefined,
      difficultyFactor: toNumber(
        laborInput.difficultyFactor ?? laborInput.difficulty_factor,
        toNumber(row.difficulty_factor, 1),
      ),
      locationFactor: toNumber(
        laborInput.locationFactor ?? laborInput.location_factor,
        toNumber(row.location_factor, 1),
      ),
      laborRate: toNumber(laborInput.laborRate ?? laborInput.labor_rate, toNumber(row.labor_rate)),
      burdenPercent: toNumber(laborInput.burdenPercent ?? laborInput.burden_percent, toNumber(row.burden_percent)),
    },
    material: {
      unitCost: toNumber(materialInput.unitCost ?? materialInput.unit_cost, toNumber(row.material_cost)),
    },
    equipment: equipmentRateType
      ? {
          rate: toNumber(equipmentInput.rate, toNumber(row.equipment_cost)),
          rateType: equipmentRateType,
          usageUnits: toNumber(equipmentInput.usageUnits ?? equipmentInput.usage_units, NaN) || undefined,
        }
      : undefined,
    subcontractor: {
      cost: toNumber(
        subcontractorInput.cost,
        toNumber(row.subcontractor_cost),
      ),
    },
  };

  if (!row.csi_division && !lineItem.csiDivision) {
    warnings.push(`Line item ${row.id} is missing csi_division.`);
  }

  return {
    id: row.id,
    lineType: isLineItemType(row.line_type) ? row.line_type : 'task',
    title: row.title,
    description: toOptionalString(row.description),
    scopeName: toOptionalString(row.scope_name),
    trade: toOptionalString(row.trade),
    activity: toOptionalString(row.activity),
    position: toNumber(row.position),
    lineItem,
    overheadPercent: toNumber(row.overhead_percent),
    profitPercent: toNumber(row.profit_percent),
    contingencyPercent: toNumber(row.contingency_percent),
    taxPercent: toNumber(row.tax_percent),
    wastePercent: toNumber(row.waste_percent),
    scheduleEnabled: row.schedule_enabled ?? true,
    weatherSensitive: row.weather_sensitive ?? false,
    inspectionRequired: row.inspection_required ?? false,
    activityCode: toOptionalString(row.activity_code),
    masterActivityCode: toOptionalString(row.master_activity_code),
    activityInstance:
      typeof row.activity_instance === 'number' ? row.activity_instance : undefined,
    displayCode: toOptionalString(row.display_code),
    isCustomActivity: row.is_custom_activity ?? undefined,
    activityType: isActivityType(row.activity_type) ? row.activity_type : undefined,
    sequencingCategory: toOptionalString(row.sequencing_category),
    logicAnchor: toOptionalString(row.logic_anchor),
    workPackageCode: toOptionalString(row.work_package_code),
    divisionCode: toOptionalString(row.division_code) ?? toOptionalString(row.csi_division),
    divisionName: toOptionalString(row.division_name),
    predecessorActivityCode: toOptionalString(row.predecessor_activity_code),
    relationshipType: isRelationshipType(row.relationship_type)
      ? row.relationship_type
      : undefined,
    lagDays: typeof row.lag_days === 'number' ? row.lag_days : undefined,
    calculatedValues,
    equipmentRate: equipmentRateType
      ? toNumber(equipmentInput.rate, toNumber(row.equipment_cost))
      : undefined,
    equipmentRateType,
    equipmentUsageUnits:
      toNumber(equipmentInput.usageUnits ?? equipmentInput.usage_units, NaN) || undefined,
  };
}

export function mapLineItemRowsToEstimateVersion(
  versionRow: EstimateVersionRow,
  lineItemRows: EstimateLineItemRow[],
): EstimateDomainVersion {
  const versionBase = mapEstimateVersionRowToDomain(versionRow);
  const warnings = [...versionBase.warnings];
  const rawSnapshot = parseJsonObject(versionRow.snapshot);
  const rawSnapshotMeta = parseJsonObject(rawSnapshot.meta);
  const resetSnapshot = rawSnapshotMeta.reset === true;

  if (resetSnapshot) {
    return {
      ...versionBase,
      lineItems: [],
      warnings,
    };
  }

  const sortedRows = [...lineItemRows].sort((a, b) => a.position - b.position);

  const lineItems = sortedRows.map((row) => mapLineItemRowToDomainTask(row, warnings));

  return {
    ...versionBase,
    lineItems,
    warnings,
  };
}

function buildCalculatedValuesFromTask(task: EstimateDomainTask): Record<string, unknown> {
  const li = task.lineItem;
  return {
    ...task.calculatedValues,
    quantityFormula: li.quantity.formula,
    quantityInput: {
      formula: li.quantity.formula,
      quantity: li.quantity.quantity,
      wastePercent: li.quantity.wastePercent,
      dimensions: li.quantity.dimensions,
      openingArea: li.quantity.openingArea,
      coveragePerUnit: li.quantity.coveragePerUnit,
    },
    laborInput: li.labor,
    materialInput: li.material,
    equipmentInput: li.equipment,
    subcontractorInput: li.subcontractor,
  };
}

export function mapDomainTaskToLineItemInsert(
  params: MapDomainTaskToLineItemInsertParams,
): EstimateLineItemInsert {
  const { task, estimateVersionId, projectId, parentLineItemId } = params;
  const li = task.lineItem;

  return {
    estimate_version_id: estimateVersionId,
    project_id: projectId,
    parent_line_item_id: parentLineItemId ?? null,
    line_type: task.lineType,
    csi_division: li.csiDivision ?? null,
    csi_section: li.csiSection ?? null,
    scope_name: task.scopeName ?? null,
    title: task.title || li.description,
    description: task.description ?? li.description,
    trade: task.trade ?? null,
    activity: task.activity ?? null,
    quantity: toNumber(li.quantity.quantity),
    unit: null,
    production_rate: toNumber(li.labor?.productionRate),
    production_rate_type: li.labor?.productionRateType ?? null,
    crew_size: toNumber(li.labor?.crewSize),
    hours_per_day: toNumber(li.labor?.hoursPerDay, 8),
    labor_rate: toNumber(li.labor?.laborRate),
    burden_percent: toNumber(li.labor?.burdenPercent),
    overhead_percent: task.overheadPercent,
    profit_percent: task.profitPercent,
    contingency_percent: task.contingencyPercent,
    tax_percent: task.taxPercent,
    waste_percent: toNumber(li.quantity.wastePercent ?? task.wastePercent),
    difficulty_factor: toNumber(li.labor?.difficultyFactor, 1),
    location_factor: toNumber(li.labor?.locationFactor, 1),
    material_cost: toNumber(li.material?.unitCost),
    equipment_cost: toNumber(task.equipmentRate ?? li.equipment?.rate),
    subcontractor_cost: toNumber(li.subcontractor?.cost),
    indirect_cost: 0,
    calculated_values: buildCalculatedValuesFromTask(task),
    schedule_enabled: task.scheduleEnabled,
    weather_sensitive: task.weatherSensitive,
    inspection_required: task.inspectionRequired,
    position: task.position,
    activity_code: task.activityCode ?? null,
    master_activity_code: task.masterActivityCode ?? null,
    activity_instance: task.activityInstance ?? null,
    display_code: task.displayCode ?? task.activityCode ?? null,
    is_custom_activity: task.isCustomActivity ?? false,
    activity_type: task.activityType ?? null,
    sequencing_category: task.sequencingCategory ?? null,
    logic_anchor: task.logicAnchor ?? null,
    work_package_code: task.workPackageCode ?? null,
    division_code: task.divisionCode ?? li.csiDivision ?? null,
    division_name: task.divisionName ?? null,
    predecessor_activity_code: task.predecessorActivityCode ?? null,
    relationship_type: task.relationshipType ?? null,
    lag_days: task.lagDays ?? null,
  };
}

export function mapCalculatedTaskToLineItemInsert(
  params: MapCalculatedTaskToLineItemInsertParams,
): EstimateLineItemInsert {
  const base = mapDomainTaskToLineItemInsert({
    task: params.task,
    estimateVersionId: params.estimateVersionId,
    projectId: params.projectId,
    parentLineItemId: params.parentLineItemId,
  });

  const calculated = parseJsonObject(params.calculatedValues);
  const costs = parseJsonObject(calculated.costs);
  const metrics = parseJsonObject(calculated.metrics);

  return {
    ...base,
    material_cost: toNumber(costs.materialCost ?? costs.material_cost, base.material_cost),
    equipment_cost: toNumber(costs.equipmentCost ?? costs.equipment_cost, base.equipment_cost),
    subcontractor_cost: toNumber(
      costs.subcontractorCost ?? costs.subcontractor_cost,
      base.subcontractor_cost,
    ),
    indirect_cost: toNumber(costs.indirectCost ?? costs.indirect_cost),
    calculated_values: {
      ...buildCalculatedValuesFromTask(params.task),
      ...calculated,
      costs,
      metrics,
    },
  };
}

/** Helper for callers that already have an `EstimateLineSnapshot` from the pure engine. */
export function mapCalculatedLineSnapshotToInsert(
  params: Omit<MapCalculatedTaskToLineItemInsertParams, 'calculatedValues'> & {
    calculatedLine: EstimateLineSnapshot;
  },
): EstimateLineItemInsert {
  return mapCalculatedTaskToLineItemInsert({
    ...params,
    calculatedValues: {
      quantityFormula: params.calculatedLine.quantityFormula,
      metrics: params.calculatedLine.metrics,
      costs: params.calculatedLine.costs,
    },
  });
}

export interface MapDraftLineToLineItemInsertParams {
  task: EstimateDomainTask;
  unit: string;
  indirectCost: number;
  calculatedLine: EstimateLineSnapshot;
  estimateVersionId: string;
  projectId: string;
  position: number;
}

/** Maps a draft task plus calculated snapshot into a line-item insert row. */
export function mapDraftLineToLineItemInsert(
  params: MapDraftLineToLineItemInsertParams,
): EstimateLineItemInsert {
  const { task, unit, indirectCost, calculatedLine, estimateVersionId, projectId, position } =
    params;
  const trimmedUnit = unit.trim();

  const base = mapCalculatedLineSnapshotToInsert({
    task: { ...task, position, lineType: 'task' },
    estimateVersionId,
    projectId,
    calculatedLine,
  });

  const baseCalculated = parseJsonObject(base.calculated_values);
  const baseCosts = parseJsonObject(baseCalculated.costs);

  return {
    ...base,
    line_type: 'task',
    position,
    unit: trimmedUnit || null,
    indirect_cost: toNumber(indirectCost),
    material_cost: calculatedLine.costs.materialCost,
    equipment_cost: calculatedLine.costs.equipmentCost,
    subcontractor_cost: calculatedLine.costs.subcontractorCost,
    calculated_values: {
      ...baseCalculated,
      unit: trimmedUnit || undefined,
      quantityFormula: calculatedLine.quantityFormula,
      metrics: calculatedLine.metrics,
      costs: {
        ...baseCosts,
        ...calculatedLine.costs,
        indirectCost: toNumber(indirectCost),
      },
    },
  };
}
