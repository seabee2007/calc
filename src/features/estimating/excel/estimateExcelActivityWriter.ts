import { getCsiDivisionByCode } from '../domain/csiDivisions';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { assignProjectActivityCode } from '../application/constructionActivityCoding';
import {
  calculateLineItemManHours,
  rollupConstructionActivity,
} from '../domain/constructionActivityCalculations';
import {
  instantiateManualConstructionActivity,
  MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
} from '../application/productionRateAssemblyBuilder';
import {
  applyResolvedLaborRateToLineItem,
  resolveLaborRateForWorkElement,
} from '../application/laborRateResolver';
import { roundToTwo } from '../domain/estimateMath';
import {
  DUPLICATE_ACTIVITY_CODE_MESSAGE,
  isDuplicateProjectActivityCodeError,
  removeProjectActivity,
} from '../application/constructionActivityService';
import { saveActivityBundle } from '../infrastructure/activityRepository';
import { loadApprovedProductionRateLibrary } from '../data/productionRates/productionRateLibrary';
import { getProductionRateLibraryEntryById } from '../data/productionRates/productionRateLibrary';
import type {
  ActivityExcelImportApplyInput,
  ActivityExcelImportApplyResult,
  EstimateExcelLineRow,
  ParsedActivityGroup,
} from './estimateExcelTypes';

function isImportableRow(row: EstimateExcelLineRow): boolean {
  return row.status === 'valid' || row.status === 'warning' || row.status === 'unpriced';
}

function mapLineItemForSave(
  li: ProjectActivityLineItem,
  projectId: string,
): Omit<ProjectActivityLineItem, 'id' | 'projectActivityId' | 'createdAt'> {
  return {
    projectId,
    productionRateId: li.productionRateId ?? null,
    sourceProductionRateKey: li.sourceProductionRateKey ?? null,
    sourceProductionRateLabel: li.sourceProductionRateLabel ?? null,
    sourceFigure: li.sourceFigure ?? null,
    sourcePage: li.sourcePage ?? null,
    sourcePdfPage: li.sourcePdfPage ?? null,
    sourceDocumentCode: li.sourceDocumentCode ?? null,
    name: li.name,
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    manHoursPerUnit: li.manHoursPerUnit,
    productionFactor: li.productionFactor,
    calculatedManHours: li.calculatedManHours,
    laborCost: li.laborCost,
    materialCost: li.materialCost,
    equipmentCost: li.equipmentCost,
    subcontractCost: li.subcontractCost ?? 0,
    totalCost: li.totalCost ?? 0,
    laborRoleId: li.laborRoleId ?? null,
    laborRoleKey: li.laborRoleKey ?? null,
    laborRoleName: li.laborRoleName ?? null,
    tradeCategory: li.tradeCategory ?? null,
    hourlyRateSnapshot: li.hourlyRateSnapshot ?? 0,
    burdenPercentSnapshot: li.burdenPercentSnapshot ?? 0,
    fullyBurdenedRateSnapshot: li.fullyBurdenedRateSnapshot ?? 0,
    billingRateSnapshot: li.billingRateSnapshot ?? 0,
    pricingSource: li.pricingSource ?? 'unset',
    pricingSnapshotAt: li.pricingSnapshotAt ?? null,
    sortOrder: li.sortOrder ?? 0,
  };
}

function mapActivityForSave(
  activity: ProjectConstructionActivity,
): Omit<ProjectConstructionActivity, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = activity;
  return rest;
}

function enhanceLineItemFromExcelRow(
  item: ProjectActivityLineItem,
  row: EstimateExcelLineRow,
  projectLaborRates: ActivityExcelImportApplyInput['projectLaborRates'],
): ProjectActivityLineItem {
  const quantity = row.quantity ?? item.quantity;
  let manHoursPerUnit = row.manHoursPerUnit ?? item.manHoursPerUnit;
  let productionRateId = item.productionRateId;
  let sourceProductionRateKey = item.sourceProductionRateKey;
  let sourceProductionRateLabel = item.sourceProductionRateLabel;
  let pricingSource = item.pricingSource;

  const rateId = row.productionRateId?.trim();
  if (rateId) {
    const entry = getProductionRateLibraryEntryById(rateId);
    if (entry) {
      productionRateId = null;
      sourceProductionRateKey = entry.id;
      sourceProductionRateLabel = entry.activityName;
      manHoursPerUnit = entry.manHoursPerUnit ?? 0;
      pricingSource = 'production_rate';
    } else if (manHoursPerUnit > 0) {
      pricingSource = 'manual';
    } else {
      pricingSource = 'unset';
    }
  } else if (manHoursPerUnit > 0) {
    pricingSource = 'manual';
  } else {
    pricingSource = 'unset';
  }

  const calculatedManHours = calculateLineItemManHours(
    quantity,
    manHoursPerUnit,
    item.productionFactor,
  );
  const materialCost = roundToTwo((row.materialUnitCost ?? 0) * quantity);
  const equipmentCost = roundToTwo((row.equipmentUnitCost ?? 0) * quantity);
  const subcontractCost = roundToTwo((row.subcontractorUnitCost ?? 0) * quantity);

  let enhanced: ProjectActivityLineItem = {
    ...item,
    name: row.lineItemDescription.trim(),
    description: row.lineItemDescription.trim(),
    unit: (row.unit ?? item.unit).trim(),
    quantity,
    manHoursPerUnit,
    calculatedManHours,
    productionRateId,
    sourceProductionRateKey,
    sourceProductionRateLabel,
    materialCost,
    equipmentCost,
    subcontractCost,
    pricingSource,
  };

  if (calculatedManHours > 0) {
    const resolved = resolveLaborRateForWorkElement({
      workElement: {
        activityName: row.lineItemDescription.trim(),
        description: row.lineItemDescription.trim(),
      },
      projectLaborRates,
      preferredRoleId: row.laborRole?.trim() || null,
    });
    if (resolved.projectRate) {
      enhanced = {
        ...applyResolvedLaborRateToLineItem(enhanced, resolved),
        pricingSource: pricingSource === 'unset' ? 'manual' : pricingSource,
      };
    }
  }

  enhanced.totalCost = roundToTwo(
    enhanced.laborCost + enhanced.materialCost + enhanced.equipmentCost + enhanced.subcontractCost,
  );
  return enhanced;
}

function rollupActivity(
  activity: ProjectConstructionActivity,
  lineItems: ProjectActivityLineItem[],
): ProjectConstructionActivity {
  const rollup = rollupConstructionActivity(activity, lineItems);
  return {
    ...activity,
    calculatedManHours: rollup.totalManHours,
    calculatedManDays: rollup.totalManDays,
    calculatedDurationDays: rollup.calculatedDurationDays,
    effectiveDurationDays: rollup.effectiveDurationDays,
    totalLaborCost: rollup.totalLaborCost,
    totalMaterialCost: rollup.totalMaterialCost,
    totalEquipmentCost: rollup.totalEquipmentCost,
    totalSubcontractCost: rollup.totalSubcontractCost,
    totalCost: rollup.totalDirectCost,
  };
}

async function saveImportedGroup(
  input: ActivityExcelImportApplyInput,
  group: ParsedActivityGroup,
  existingActivities: ProjectConstructionActivity[],
): Promise<{
  saved: boolean;
  activity?: ProjectConstructionActivity;
  lineItemCount: number;
  skippedCount: number;
  warnings: string[];
  error?: string;
}> {
  const importableRows = group.lineRows.filter(isImportableRow);
  const skippedCount = group.lineRows.length - importableRows.length;
  if (importableRows.length === 0) {
    return { saved: false, lineItemCount: 0, skippedCount, warnings: [] };
  }

  const division = getCsiDivisionByCode(group.divisionCode);
  const divisionName = group.divisionName.trim() || division?.name || group.divisionCode;
  const assigned = assignProjectActivityCode({
    existingActivities,
    divisionCode: group.divisionCode,
    sourceTemplateKey: MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
    identity: { activityName: group.activityName },
    preserveActivityCode: group.activityCode,
  });

  const instantiation = instantiateManualConstructionActivity({
    projectId: input.projectId,
    estimateId: input.estimateId,
    divisionCode: group.divisionCode,
    divisionName,
    lineItems: importableRows.map((row) => ({
      description: row.lineItemDescription,
      unit: row.unit ?? '',
      quantity: row.quantity ?? 0,
      manHoursPerUnit: row.manHoursPerUnit ?? 0,
      laborRoleId: row.laborRole?.trim() || null,
    })),
    identity: { activityName: group.activityName, notes: importableRows[0]?.notes ?? null },
    assigned,
    crewSize: group.crewSize,
    scheduleEnabled: group.scheduleEnabled,
    projectLaborRates: input.projectLaborRates,
    sourceTemplateKey: MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
  });

  const enhancedLineItems = instantiation.projectLineItems.map((item, index) =>
    enhanceLineItemFromExcelRow(item, importableRows[index]!, input.projectLaborRates),
  );
  const rolledActivity = rollupActivity(instantiation.projectActivity, enhancedLineItems);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saveResult = await saveActivityBundle(
      mapActivityForSave(rolledActivity),
      enhancedLineItems.map((item) => mapLineItemForSave(item, input.projectId)),
    );
    if (!saveResult.error && saveResult.data) {
      return {
        saved: true,
        activity: saveResult.data.activity,
        lineItemCount: enhancedLineItems.length,
        skippedCount,
        warnings: instantiation.rollup.warnings,
      };
    }
    if (!isDuplicateProjectActivityCodeError(saveResult.error) || attempt === 1) {
      return {
        saved: false,
        lineItemCount: 0,
        skippedCount,
        warnings: [],
        error: saveResult.error ?? DUPLICATE_ACTIVITY_CODE_MESSAGE,
      };
    }
  }

  return {
    saved: false,
    lineItemCount: 0,
    skippedCount,
    warnings: [],
    error: DUPLICATE_ACTIVITY_CODE_MESSAGE,
  };
}

export async function applyActivityExcelImport(
  input: ActivityExcelImportApplyInput,
): Promise<ActivityExcelImportApplyResult> {
  await loadApprovedProductionRateLibrary();

  const warnings: string[] = [];
  let existingActivities = [...input.existingActivities];
  let importedActivityCount = 0;
  let importedLineItemCount = 0;
  let skippedCount = 0;

  if (input.mode === 'replace') {
    for (const activity of existingActivities) {
      const result = await removeProjectActivity(activity.id);
      if (result.error) {
        return {
          importedActivityCount: 0,
          importedLineItemCount: 0,
          skippedCount: 0,
          warnings,
          error: result.error,
        };
      }
    }
    existingActivities = [];
  }

  for (const group of input.groups) {
    const result = await saveImportedGroup(input, group, existingActivities);
    skippedCount += result.skippedCount;
    warnings.push(...result.warnings);
    if (result.error) {
      return {
        importedActivityCount,
        importedLineItemCount,
        skippedCount,
        warnings,
        error: result.error,
      };
    }
    if (result.saved && result.activity) {
      existingActivities = [...existingActivities, result.activity];
      importedActivityCount += 1;
      importedLineItemCount += result.lineItemCount;
    }
  }

  return {
    importedActivityCount,
    importedLineItemCount,
    skippedCount,
    warnings,
    error: null,
  };
}

export function filterImportableGroups(groups: ParsedActivityGroup[]): ParsedActivityGroup[] {
  return groups.filter((group) => group.importable);
}
