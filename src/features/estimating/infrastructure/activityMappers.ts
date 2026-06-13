/**
 * Maps between database rows (snake_case) and domain types (camelCase).
 */
import type {
  ActivityLineItemTemplate,
  ConstructionActivityTemplate,
  ProductionRate,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import type {
  ActivityLineItemTemplateRow,
  ConstructionActivityTemplateRow,
  ProductionRateRow,
  ProjectActivityLineItemRow,
  ProjectConstructionActivityRow,
} from './activityDbTypes';

// ---------------------------------------------------------------------------
// Reference table mappers
// ---------------------------------------------------------------------------

export function mapProductionRateFromRow(row: ProductionRateRow): ProductionRate {
  return {
    id: row.id,
    divisionCode: row.division_code,
    divisionName: row.division_name,
    masterFormatCode: row.masterformat_code,
    workElementLineNumber: row.work_element_line_number,
    description: row.description,
    unit: row.unit,
    rateType: row.rate_type,
    manHoursPerUnit: row.man_hours_per_unit ?? undefined,
    equipmentHoursPerUnit: row.equipment_hours_per_unit ?? undefined,
    quantityPerUnit: row.quantity_per_unit ?? undefined,
    minimumCrewSize: row.minimum_crew_size ?? undefined,
    crewComposition: row.crew_composition ?? undefined,
    sourceManual: row.source_manual,
    sourceEdition: row.source_edition,
    sourceDivision: row.source_division ?? '',
    sourceFigure: row.source_figure ?? '',
    sourcePage: row.source_page ?? '',
    sourcePdfPage: row.source_pdf_page ?? undefined,
    sourceNotes: row.source_notes ?? [],
    directLaborOnly: row.direct_labor_only,
    militaryAdjusted: row.military_adjusted,
    civilianConversionMultiplier: row.civilian_conversion_multiplier ?? undefined,
    tags: row.tags ?? [],
    applicableActivityTypes: row.applicable_activity_types ?? [],
    importBatchId: row.import_batch_id ?? '',
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    isActive: row.is_active,
    supersededById: row.superseded_by_id ?? undefined,
  };
}

export function mapActivityTemplateFromRow(
  row: ConstructionActivityTemplateRow,
): ConstructionActivityTemplate {
  return {
    id: row.id,
    divisionId: row.division_id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    scheduleEnabled: row.schedule_enabled,
    defaultCrewSize: row.default_crew_size,
    defaultHoursPerDay: row.default_hours_per_day,
    defaultProductionFactor: row.default_production_factor,
  };
}

export function mapLineItemTemplateFromRow(
  row: ActivityLineItemTemplateRow,
): ActivityLineItemTemplate {
  return {
    id: row.id,
    constructionActivityTemplateId: row.construction_activity_template_id,
    name: row.name,
    unit: row.unit,
    productionRateId: row.production_rate_id,
    defaultManHoursPerUnit: row.default_man_hours_per_unit,
    sortOrder: row.sort_order,
  };
}

// ---------------------------------------------------------------------------
// Project table mappers
// ---------------------------------------------------------------------------

export function mapProjectActivityFromRow(
  row: ProjectConstructionActivityRow,
): ProjectConstructionActivity {
  return {
    id: row.id,
    projectId: row.project_id,
    estimateId: row.estimate_id ?? undefined,
    activityTemplateId: row.activity_template_id ?? null,
    sourceTemplateKey: row.source_template_key ?? null,
    divisionCode: row.division_code,
    divisionName: row.division_name,
    activityCode: row.activity_code,
    title: row.title,
    baseTitle: row.base_title ?? undefined,
    instanceLabel: row.instance_label ?? undefined,
    location: row.location ?? undefined,
    drawingReference: row.drawing_reference ?? undefined,
    phase: row.phase ?? undefined,
    notes: row.notes ?? undefined,
    activitySequence: row.activity_sequence ?? undefined,
    instanceSequence: row.instance_sequence ?? undefined,
    description: row.description ?? undefined,
    scheduleEnabled: row.schedule_enabled,
    crewSize: row.crew_size,
    hoursPerDay: row.hours_per_day,
    productionFactor: row.production_factor,
    calculatedManHours: row.calculated_man_hours,
    calculatedManDays: row.calculated_man_days,
    calculatedDurationDays: row.calculated_duration_days,
    durationDaysOverride: row.duration_days_override ?? undefined,
    effectiveDurationDays: row.effective_duration_days,
    totalLaborCost: row.total_labor_cost,
    totalMaterialCost: row.total_material_cost,
    totalEquipmentCost: row.total_equipment_cost,
    totalSubcontractCost: row.total_subcontract_cost,
    totalCost: row.total_cost,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProjectLineItemFromRow(
  row: ProjectActivityLineItemRow,
): ProjectActivityLineItem {
  return {
    id: row.id,
    projectActivityId: row.project_activity_id,
    projectId: row.project_id,
    productionRateId: row.production_rate_id ?? null,
    sourceProductionRateKey: row.source_production_rate_key ?? null,
    sourceProductionRateLabel: row.source_production_rate_label ?? null,
    sourceFigure: row.source_figure ?? null,
    sourcePage: row.source_page ?? null,
    sourcePdfPage: row.source_pdf_page ?? null,
    sourceDocumentCode: row.source_document_code ?? null,
    name: row.name,
    description: row.description ?? undefined,
    quantity: row.quantity,
    unit: row.unit,
    manHoursPerUnit: row.man_hours_per_unit,
    productionFactor: row.production_factor,
    calculatedManHours: row.calculated_man_hours,
    laborCost: row.labor_cost,
    materialCost: row.material_cost,
    equipmentCost: row.equipment_cost,
    subcontractCost: row.subcontract_cost,
    totalCost: row.total_cost,
    laborRoleId: row.labor_role_id ?? null,
    laborRoleKey: row.labor_role_key ?? null,
    laborRoleName: row.labor_role_name ?? null,
    tradeCategory: row.trade_category ?? null,
    hourlyRateSnapshot: row.hourly_rate_snapshot ?? EMPTY_LABOR_PRICING_SNAPSHOT.hourlyRateSnapshot,
    burdenPercentSnapshot: row.burden_percent_snapshot ?? EMPTY_LABOR_PRICING_SNAPSHOT.burdenPercentSnapshot,
    fullyBurdenedRateSnapshot:
      row.fully_burdened_rate_snapshot ?? EMPTY_LABOR_PRICING_SNAPSHOT.fullyBurdenedRateSnapshot,
    billingRateSnapshot: row.billing_rate_snapshot ?? EMPTY_LABOR_PRICING_SNAPSHOT.billingRateSnapshot,
    pricingSource:
      (row.pricing_source as ProjectActivityLineItem['pricingSource']) ??
      EMPTY_LABOR_PRICING_SNAPSHOT.pricingSource,
    pricingSnapshotAt: row.pricing_snapshot_at ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Domain → insert payload
// ---------------------------------------------------------------------------

export function mapProjectActivityToInsert(
  activity: ProjectConstructionActivity,
): Record<string, unknown> {
  return {
    project_id: activity.projectId,
    estimate_id: activity.estimateId ?? null,
    // activity_template_id is a FK to construction_activity_templates(id).
    // Only set it when we have a confirmed DB UUID — never a registry key.
    activity_template_id: activity.activityTemplateId ?? null,
    // source_template_key holds the local TypeScript registry key.
    source_template_key: activity.sourceTemplateKey ?? null,
    division_code: activity.divisionCode,
    division_name: activity.divisionName,
    activity_code: activity.activityCode,
    title: activity.title,
    base_title: activity.baseTitle ?? null,
    instance_label: activity.instanceLabel ?? null,
    location: activity.location ?? null,
    drawing_reference: activity.drawingReference ?? null,
    phase: activity.phase ?? null,
    notes: activity.notes ?? null,
    activity_sequence: activity.activitySequence ?? null,
    instance_sequence: activity.instanceSequence ?? null,
    description: activity.description ?? null,
    schedule_enabled: activity.scheduleEnabled,
    crew_size: activity.crewSize,
    hours_per_day: activity.hoursPerDay,
    production_factor: activity.productionFactor,
    calculated_man_hours: activity.calculatedManHours,
    calculated_man_days: activity.calculatedManDays,
    calculated_duration_days: activity.calculatedDurationDays,
    duration_days_override: activity.durationDaysOverride ?? null,
    effective_duration_days: activity.effectiveDurationDays,
    total_labor_cost: activity.totalLaborCost,
    total_material_cost: activity.totalMaterialCost,
    total_equipment_cost: activity.totalEquipmentCost,
    total_subcontract_cost: activity.totalSubcontractCost,
    total_cost: activity.totalCost,
    warnings: [],
    sort_order: activity.sortOrder ?? 0,
  };
}

export function mapProjectLineItemToInsert(
  li: ProjectActivityLineItem,
): Record<string, unknown> {
  return {
    project_activity_id: li.projectActivityId,
    project_id: li.projectId,
    // production_rate_id is a FK — only set when a real DB row exists.
    production_rate_id: li.productionRateId ?? null,
    source_production_rate_key: li.sourceProductionRateKey ?? null,
    source_production_rate_label: li.sourceProductionRateLabel ?? null,
    source_figure: li.sourceFigure ?? null,
    source_page: li.sourcePage ?? null,
    source_pdf_page: li.sourcePdfPage ?? null,
    source_document_code: li.sourceDocumentCode ?? null,
    name: li.name,
    description: li.description ?? null,
    quantity: li.quantity,
    unit: li.unit,
    man_hours_per_unit: li.manHoursPerUnit,
    production_factor: li.productionFactor,
    calculated_man_hours: li.calculatedManHours,
    labor_cost: li.laborCost,
    material_cost: li.materialCost,
    equipment_cost: li.equipmentCost,
    subcontract_cost: li.subcontractCost ?? 0,
    total_cost: li.totalCost ?? 0,
    labor_role_id: li.laborRoleId ?? null,
    labor_role_key: li.laborRoleKey ?? null,
    labor_role_name: li.laborRoleName ?? null,
    trade_category: li.tradeCategory ?? null,
    hourly_rate_snapshot: li.hourlyRateSnapshot ?? 0,
    burden_percent_snapshot: li.burdenPercentSnapshot ?? 0,
    fully_burdened_rate_snapshot: li.fullyBurdenedRateSnapshot ?? 0,
    billing_rate_snapshot: li.billingRateSnapshot ?? 0,
    pricing_source: li.pricingSource ?? 'unset',
    pricing_snapshot_at: li.pricingSnapshotAt ?? null,
    sort_order: li.sortOrder ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Activity resource mappers
// ---------------------------------------------------------------------------

import type {
  ActivityMaterialResource,
  ActivityEquipmentResource,
  ActivityResourceSnapshot,
  CompanyCostLibraryItem,
} from '../domain/constructionActivityTypes';
import type {
  ActivityMaterialResourceRow,
  ActivityEquipmentResourceRow,
  ActivityMaterialResourceInsert,
  ActivityEquipmentResourceInsert,
  CompanyCostLibraryItemRow,
  CompanyCostLibraryItemInsert,
} from './activityDbTypes';

function parseSnapshot(raw: Record<string, unknown> | null): ActivityResourceSnapshot | undefined {
  if (!raw) return undefined;
  return {
    sourceName: String(raw['sourceName'] ?? ''),
    originalName: String(raw['originalName'] ?? ''),
    originalUnit: String(raw['originalUnit'] ?? ''),
    originalDefaultUnitCost: Number(raw['originalDefaultUnitCost'] ?? 0),
    category: raw['category'] != null ? String(raw['category']) : undefined,
    subcategory: raw['subcategory'] != null ? String(raw['subcategory']) : undefined,
    csiDivision: raw['csiDivision'] != null ? String(raw['csiDivision']) : undefined,
    csiSection: raw['csiSection'] != null ? String(raw['csiSection']) : undefined,
    notes: raw['notes'] != null ? String(raw['notes']) : undefined,
    selectedAt: String(raw['selectedAt'] ?? ''),
  };
}

export function mapMaterialResourceFromRow(row: ActivityMaterialResourceRow): ActivityMaterialResource {
  return {
    id: row.id,
    activityId: row.project_activity_id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    quantity: row.quantity,
    unit: row.unit,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    sourceProvider: row.source_provider,
    sourceSnapshot: parseSnapshot(row.source_snapshot),
    sourceId: row.source_id ?? undefined,
    companyLibraryItemId: row.company_library_item_id ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMaterialResourceToInsert(
  resource: Omit<ActivityMaterialResource, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): ActivityMaterialResourceInsert {
  return {
    project_activity_id: resource.activityId,
    project_id: resource.projectId,
    user_id: userId,
    name: resource.name,
    description: resource.description ?? null,
    category: resource.category ?? null,
    subcategory: resource.subcategory ?? null,
    quantity: resource.quantity,
    unit: resource.unit,
    unit_cost: resource.unitCost,
    total_cost: resource.totalCost,
    source_provider: resource.sourceProvider,
    source_id: resource.sourceId ?? null,
    company_library_item_id: resource.companyLibraryItemId ?? null,
    source_snapshot: resource.sourceSnapshot
      ? (resource.sourceSnapshot as unknown as Record<string, unknown>)
      : null,
    sort_order: resource.sortOrder ?? 0,
  };
}

export function mapEquipmentResourceFromRow(row: ActivityEquipmentResourceRow): ActivityEquipmentResource {
  return {
    id: row.id,
    activityId: row.project_activity_id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    quantity: row.quantity,
    unit: row.unit,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    sourceProvider: row.source_provider,
    sourceSnapshot: parseSnapshot(row.source_snapshot),
    sourceId: row.source_id ?? undefined,
    companyLibraryItemId: row.company_library_item_id ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEquipmentResourceToInsert(
  resource: Omit<ActivityEquipmentResource, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): ActivityEquipmentResourceInsert {
  return {
    project_activity_id: resource.activityId,
    project_id: resource.projectId,
    user_id: userId,
    name: resource.name,
    description: resource.description ?? null,
    category: resource.category ?? null,
    subcategory: resource.subcategory ?? null,
    quantity: resource.quantity,
    unit: resource.unit,
    unit_cost: resource.unitCost,
    total_cost: resource.totalCost,
    source_provider: resource.sourceProvider,
    source_id: resource.sourceId ?? null,
    company_library_item_id: resource.companyLibraryItemId ?? null,
    source_snapshot: resource.sourceSnapshot
      ? (resource.sourceSnapshot as unknown as Record<string, unknown>)
      : null,
    sort_order: resource.sortOrder ?? 0,
  };
}

export function mapCompanyCostLibraryItemFromRow(row: CompanyCostLibraryItemRow): CompanyCostLibraryItem {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    unit: row.unit,
    defaultUnitCost: row.default_unit_cost,
    sourceProvider: row.source_provider,
    sourceId: row.source_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCompanyCostLibraryItemToInsert(
  item: Omit<CompanyCostLibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
): CompanyCostLibraryItemInsert {
  return {
    user_id: item.userId,
    type: item.type,
    name: item.name,
    description: item.description ?? null,
    category: item.category ?? null,
    subcategory: item.subcategory ?? null,
    unit: item.unit,
    default_unit_cost: item.defaultUnitCost,
    source_provider: item.sourceProvider,
    source_id: item.sourceId ?? null,
    notes: item.notes ?? null,
    is_active: true,
  };
}
