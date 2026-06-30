import {
  instantiateAndSaveFromProductionRateAssembly,
  instantiateAndSaveManualActivity,
  type SaveManualActivityInput,
} from '../../estimating/application/constructionActivityService';
import type { ActivityInstanceIdentityInput } from '../../estimating/application/constructionActivityCoding';
import { assignProjectActivityCode } from '../../estimating/application/constructionActivityCoding';
import {
  instantiateManualConstructionActivity,
  instantiateProductionRateAssembly,
  type ManualDraftLineItemInput,
  type ProductionRateAssemblyGroup,
} from '../../estimating/application/productionRateAssemblyBuilder';
import {
  areProductionRateUnitsCompatible,
  convertQuantityForProductionRateUnit,
} from '../../estimating/application/matchQuantityToProductionRates';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../../estimating/domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../../estimating/domain/laborRateTypes';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import {
  fetchProjectActivities,
  saveActivityBundleWithResources,
  updateProjectLineItemFromDesignPreview,
  type SavedActivityBundle,
  type SavedActivityBundleWithResources,
} from '../../estimating/infrastructure/activityRepository';
import {
  markDesignQuantityItemsImported,
  markDesignQuantityItemsCommitted,
  replaceDesignQuantityItems,
} from '../services/designBuilderService';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import type { DesignBuilderScheduleGroupRule } from './designBuilderImportRules';
import type {
  DesignQuantityDestination,
  DesignScopePackage,
  DesignScopePackageQuantity,
} from './designScopeTypes';

export interface PersistDesignEstimatePreviewInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  lines: readonly DesignEstimatePreviewLine[];
}

export async function persistDesignEstimatePreview(
  input: PersistDesignEstimatePreviewInput,
): Promise<RepositoryResult<DesignQuantityItem[]>> {
  return replaceDesignQuantityItems(
    input.designModelId,
    input.lines.map((line) => ({
      designModelId: line.designModelId,
      designObjectId: line.designObjectId,
      projectId: input.projectId,
      estimateId: input.estimateId ?? null,
      quantityType: line.quantityType,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      formula: line.formula,
      parameterSnapshot: line.parameterSnapshot,
      metadata: {
        previewLineId: line.id,
        source: line.source,
        confidence: line.confidence,
      },
    })),
  );
}

export interface CommitDesignEstimatePreviewInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  previewLines: readonly DesignEstimatePreviewLine[];
  persistedQuantityItems: readonly DesignQuantityItem[];
  existingActivities: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
  productionRates: readonly ProductionRateLibraryEntry[];
  assignments: readonly DesignBuilderImportCommitAssignment[];
}

export interface CommitDesignEstimatePreviewResult {
  bundles: SavedActivityBundle[];
  committedQuantityItems: DesignQuantityItem[];
}

export interface CommitDesignScopePackagesInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  packages: readonly DesignScopePackage[];
  existingActivities: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
  productionRates: readonly ProductionRateLibraryEntry[];
}

export interface CommitDesignScopePackagesResult {
  bundles: SavedActivityBundleWithResources[];
  committedQuantityItems: DesignQuantityItem[];
}

export type DesignBuilderImportResolvedStatus =
  | 'auto_matched'
  | 'verified_rate'
  | 'manual_override'
  | 'excluded';

export interface DesignBuilderImportCommitAssignment {
  previewLineId: string;
  status: DesignBuilderImportResolvedStatus;
  productionRateId?: string | null;
  scheduleGroup: DesignBuilderScheduleGroupRule;
  matchConfidence?: number | null;
  matchReason?: string | null;
  manualOverride?: {
    manHoursPerUnit: number;
    reason: string;
    sourceNote: string;
  } | null;
}

export async function commitDesignScopePackages(
  input: CommitDesignScopePackagesInput,
): Promise<RepositoryResult<CommitDesignScopePackagesResult>> {
  if (input.packages.length === 0) {
    return { data: null, error: 'Build scope packages before creating activities.' };
  }

  const productionRateById = new Map(input.productionRates.map((rate) => [rate.id, rate]));

  const loadedActivities = await fetchProjectActivities(input.projectId, input.estimateId ?? undefined);
  if (loadedActivities.error || !loadedActivities.data) {
    return {
      data: null,
      error: loadedActivities.error ?? 'Could not load existing activities before Design Builder import.',
    };
  }

  const existingActivities = mergeActivities(loadedActivities.data, input.existingActivities);
  const bundles: SavedActivityBundleWithResources[] = [];
  const committedQuantityItems: DesignQuantityItem[] = [];
  const pendingImportUpdates: Parameters<typeof markDesignQuantityItemsImported>[0]['updates'] = [];

  for (const scopePackage of input.packages) {
    const includedQuantities = scopePackage.quantities.filter(
      (quantity) => quantity.classification.includeByDefault,
    );
    const laborQuantities = includedQuantities.filter(
      (quantity) => quantity.classification.destination === 'activity_line_item',
    );

    if (laborQuantities.length === 0) {
      pendingImportUpdates.push(
        ...scopePackage.quantities.flatMap((quantity) =>
          designQuantityImportUpdate({
            quantity,
            scopePackageKey: scopePackage.key,
          }),
        ),
      );
      continue;
    }

    const validationError = validateLaborQuantities(laborQuantities, productionRateById);
    if (validationError) return { data: null, error: validationError };

    const sourceTemplateKey = `design_scope:${scopePackage.key}`;
    const identity: ActivityInstanceIdentityInput = {
      activityName: scopePackage.title,
      instanceLabel: 'Parametric',
      location: scopePackage.locationLabel,
      notes: buildScopeActivityNotes(scopePackage),
    };
    const assigned = assignProjectActivityCode({
      existingActivities: mergeActivities(existingActivities, bundles.map((bundle) => bundle.activity)),
      divisionCode: scopePackage.divisionCode,
      sourceTemplateKey,
      identity,
    });

    const hasManualOverride = laborQuantities.some(
      (quantity) => quantity.assignmentStatus === 'manual_override',
    );
    const instantiation = hasManualOverride
      ? instantiateManualConstructionActivity({
          projectId: input.projectId,
          estimateId: input.estimateId ?? undefined,
          divisionCode: scopePackage.divisionCode,
          divisionName: scopePackage.divisionName,
          lineItems: laborQuantities.map((quantity) =>
            manualLineItemForScopeQuantity(quantity, productionRateById),
          ),
          identity,
          assigned,
          crewSize: 4,
          hoursPerDay: 8,
          scheduleEnabled: scopePackage.scheduleEnabled,
          projectLaborRates: input.projectLaborRates,
          sourceTemplateKey,
        })
      : instantiateProductionRateAssembly({
          projectId: input.projectId,
          estimateId: input.estimateId ?? undefined,
          group: buildScopeProductionRateGroup(scopePackage, laborQuantities, productionRateById),
          selectedLineItems: laborQuantities.map((quantity) => {
            const rate = productionRateById.get(quantity.selectedProductionRateId ?? '')!;
            return {
              rate,
              quantity: convertQuantityForProductionRateUnit(
                quantity.line.quantity,
                quantity.line.unit,
                rate.unitOfMeasure,
              ),
              assignmentStatus:
                quantity.assignmentStatus === 'auto_matched' ? 'auto_matched' : 'verified_rate',
              matchConfidence: quantity.candidates.find(
                (candidate) => candidate.productionRateId === rate.id,
              )?.confidence ?? null,
              matchReason: quantity.candidates.find(
                (candidate) => candidate.productionRateId === rate.id,
              )?.matchReason ?? null,
            };
          }),
          identity,
          assigned,
          crewSize: suggestScopeCrewSize(laborQuantities, productionRateById),
          hoursPerDay: 8,
          scheduleEnabled: scopePackage.scheduleEnabled,
          projectLaborRates: input.projectLaborRates,
        });

    const materialQuantities = includedQuantities.filter(
      (quantity) => quantity.classification.destination === 'material_resource',
    );
    const equipmentQuantities = includedQuantities.filter(
      (quantity) => quantity.classification.destination === 'equipment_resource',
    );
    const saveResult = await saveActivityBundleWithResources({
      activity: {
        ...instantiation.projectActivity,
        sourceTemplateKey,
        description: scopePackage.category,
      },
      lineItems: instantiation.projectLineItems.map((lineItem) =>
        mapScopeLineItemForSave(lineItem, input.projectId),
      ),
      materials: materialQuantities.map((quantity, index) =>
        resourceForQuantity({
          quantity,
          projectId: input.projectId,
          category: scopePackage.category,
          sortOrder: index,
        }),
      ),
      equipment: equipmentQuantities.map((quantity, index) =>
        resourceForQuantity({
          quantity,
          projectId: input.projectId,
          category: scopePackage.category,
          sortOrder: index,
        }),
      ),
    });

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not create Design Builder scope activity.' };
    }

    bundles.push(saveResult.data);

    pendingImportUpdates.push(
      ...laborQuantities.flatMap((quantity, index) =>
        designQuantityImportUpdate({
          quantity,
          scopePackageKey: scopePackage.key,
          estimateActivityId: saveResult.data!.activity.id,
          estimateLineId: saveResult.data!.lineItems[index]?.id ?? null,
        }),
      ),
      ...materialQuantities.flatMap((quantity, index) =>
        designQuantityImportUpdate({
          quantity,
          scopePackageKey: scopePackage.key,
          estimateActivityId: saveResult.data!.activity.id,
          materialResourceId: saveResult.data!.materials[index]?.id ?? null,
        }),
      ),
      ...equipmentQuantities.flatMap((quantity, index) =>
        designQuantityImportUpdate({
          quantity,
          scopePackageKey: scopePackage.key,
          estimateActivityId: saveResult.data!.activity.id,
          equipmentResourceId: saveResult.data!.equipment[index]?.id ?? null,
        }),
      ),
      ...scopePackage.quantities
        .filter((quantity) => !includedQuantities.includes(quantity))
        .flatMap((quantity) =>
          designQuantityImportUpdate({
            quantity,
            scopePackageKey: scopePackage.key,
            estimateActivityId: saveResult.data!.activity.id,
          }),
        ),
      ...includedQuantities
        .filter(
          (quantity) =>
            quantity.classification.destination !== 'activity_line_item' &&
            quantity.classification.destination !== 'material_resource' &&
            quantity.classification.destination !== 'equipment_resource',
        )
        .flatMap((quantity) =>
          designQuantityImportUpdate({
            quantity,
            scopePackageKey: scopePackage.key,
            estimateActivityId: saveResult.data!.activity.id,
          }),
        ),
    );
  }

  const markResult = await markDesignQuantityItemsImported({ updates: pendingImportUpdates });
  if (markResult.error || !markResult.data) {
    return {
      data: null,
      error: markResult.error ?? 'Could not mark Design Builder quantities as imported.',
    };
  }
  committedQuantityItems.push(...markResult.data);

  return { data: { bundles, committedQuantityItems }, error: null };
}

export async function commitDesignEstimatePreview(
  input: CommitDesignEstimatePreviewInput,
): Promise<RepositoryResult<CommitDesignEstimatePreviewResult>> {
  if (input.previewLines.length === 0) {
    return { data: null, error: 'Generate an estimate preview before committing.' };
  }

  const persistedByPreviewId = new Map(
    input.persistedQuantityItems.map((item) => [String(item.metadata.previewLineId ?? item.quantityType), item]),
  );
  const uncommittedLines: DesignEstimatePreviewLine[] = [];
  const committedQuantityItems: DesignQuantityItem[] = [];

  for (const line of input.previewLines) {
    const quantityItem = persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType);
    if (quantityItem?.estimateLineId) {
      const updateResult = await updateProjectLineItemFromDesignPreview(quantityItem.estimateLineId, {
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
      });
      if (updateResult.error || !updateResult.data) {
        return {
          data: null,
          error: updateResult.error ?? 'Could not update linked Design Builder estimate line.',
        };
      }
      committedQuantityItems.push(quantityItem);
    } else {
      uncommittedLines.push(line);
    }
  }

  if (uncommittedLines.length === 0) {
    return { data: { bundles: [], committedQuantityItems }, error: null };
  }

  const assignmentByPreviewId = new Map(
    input.assignments.map((assignment) => [assignment.previewLineId, assignment]),
  );
  const includedEntries: Array<{
    line: DesignEstimatePreviewLine;
    quantityItem: DesignQuantityItem | undefined;
    assignment: DesignBuilderImportCommitAssignment;
  }> = [];

  for (const line of uncommittedLines) {
    const assignment = assignmentByPreviewId.get(line.id);
    if (!assignment) {
      return {
        data: null,
        error: `Resolve or exclude "${line.description}" before creating estimate activities.`,
      };
    }
    if (assignment.status === 'excluded') continue;

    if (assignment.status === 'manual_override') {
      const manual = assignment.manualOverride;
      if (
        !manual ||
        manual.manHoursPerUnit <= 0 ||
        !manual.reason.trim() ||
        !manual.sourceNote.trim()
      ) {
        return {
          data: null,
          error: `Manual override for "${line.description}" requires MH/unit, reason, and source note.`,
        };
      }
    } else if (!assignment.productionRateId) {
      return {
        data: null,
        error: `Assign an approved production rate to "${line.description}" before creating activities.`,
      };
    }

    includedEntries.push({
      line,
      quantityItem: persistedByPreviewId.get(line.id) ?? persistedByPreviewId.get(line.quantityType),
      assignment,
    });
  }

  if (includedEntries.length === 0) {
    return { data: { bundles: [], committedQuantityItems }, error: null };
  }

  const productionRateById = new Map(input.productionRates.map((rate) => [rate.id, rate]));
  const bundles: SavedActivityBundle[] = [];
  const productionEntries = includedEntries.filter(
    (entry) => entry.assignment.status === 'auto_matched' || entry.assignment.status === 'verified_rate',
  );
  const manualEntries = includedEntries.filter(
    (entry) => entry.assignment.status === 'manual_override',
  );

  for (const group of groupAssignedEntries(productionEntries)) {
    const rates = group.entries.map((entry) => productionRateById.get(entry.assignment.productionRateId ?? ''));
    if (rates.some((rate) => !rate)) {
      const missing = group.entries.find((entry) => !productionRateById.get(entry.assignment.productionRateId ?? ''));
      return {
        data: null,
        error: `Selected production rate for "${missing?.line.description ?? 'Design Builder quantity'}" was not found.`,
      };
    }

    const resolvedRates = rates as ProductionRateLibraryEntry[];
    for (let index = 0; index < group.entries.length; index += 1) {
      const entry = group.entries[index];
      const rate = resolvedRates[index];
      if (rate.divisionCode !== entry.line.divisionCode) {
        return {
          data: null,
          error: `Selected production rate for "${entry.line.description}" is not in Division ${entry.line.divisionCode}.`,
        };
      }
      if ((rate.manHoursPerUnit ?? 0) <= 0) {
        return {
          data: null,
          error: `Selected production rate for "${entry.line.description}" has no positive MH/unit.`,
        };
      }
      if (!areProductionRateUnitsCompatible(entry.line.unit, rate.unitOfMeasure)) {
        return {
          data: null,
          error: `Selected production rate unit ${rate.unitOfMeasure} is not compatible with ${entry.line.unit} for "${entry.line.description}".`,
        };
      }
    }
    const assemblyGroup = buildProductionRateGroup(group.scheduleGroup, resolvedRates);
    const saveResult = await instantiateAndSaveFromProductionRateAssembly({
      projectId: input.projectId,
      estimateId: input.estimateId ?? undefined,
      group: assemblyGroup,
      selectedLineItems: group.entries.map((entry) => {
        const rate = productionRateById.get(entry.assignment.productionRateId ?? '')!;
        return {
          rateId: rate.id,
          quantity: convertQuantityForProductionRateUnit(
            entry.line.quantity,
            entry.line.unit,
            rate.unitOfMeasure,
          ),
          assignmentStatus: entry.assignment.status,
          matchConfidence: entry.assignment.matchConfidence ?? null,
          matchReason: entry.assignment.matchReason ?? null,
        };
      }),
      scheduleEnabled: true,
      identity: buildIdentityFromScheduleGroup(group.scheduleGroup),
      existingActivities: input.existingActivities,
      projectLaborRates: input.projectLaborRates,
      sourceTemplateKey: `design_builder:${group.scheduleGroup.key}`,
    });

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not commit Design Builder preview.' };
    }

    bundles.push(saveResult.data);
    for (let index = 0; index < group.entries.length; index += 1) {
      const { quantityItem } = group.entries[index];
      const estimateLine = saveResult.data.lineItems[index];
      if (!estimateLine || !quantityItem) continue;

      const markResult = await markDesignQuantityItemsCommitted({
        quantityItemIds: [quantityItem.id],
        estimateLineId: estimateLine.id,
      });
      if (markResult.error || !markResult.data) {
        return { data: null, error: markResult.error ?? 'Could not link Design Builder quantity to estimate line.' };
      }
      committedQuantityItems.push(...markResult.data);
    }
  }

  for (const group of groupAssignedEntries(manualEntries)) {
    const saveResult = await instantiateAndSaveManualActivity({
      divisionCode: group.scheduleGroup.divisionCode,
      divisionName: group.scheduleGroup.divisionName,
      lineItems: group.entries.map(({ line, assignment }) => ({
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        manHoursPerUnit: assignment.manualOverride?.manHoursPerUnit ?? 0,
        manualProductionRateReason: assignment.manualOverride?.reason ?? null,
        manualProductionRateSourceNote: assignment.manualOverride?.sourceNote ?? null,
        productionRateMatchReason: assignment.matchReason ?? 'Manual Design Builder production-rate override.',
      })),
      projectId: input.projectId,
      estimateId: input.estimateId ?? undefined,
      scheduleEnabled: true,
      identity: buildIdentityFromScheduleGroup({
        ...group.scheduleGroup,
        title: `${group.scheduleGroup.title} - Manual Overrides`,
      }),
      existingActivities: input.existingActivities,
      projectLaborRates: input.projectLaborRates,
      sourceTemplateKey: `design_builder:${group.scheduleGroup.key}:manual`,
    } satisfies SaveManualActivityInput);

    if (saveResult.error || !saveResult.data) {
      return { data: null, error: saveResult.error ?? 'Could not commit Design Builder manual override.' };
    }

    bundles.push(saveResult.data);
    for (let index = 0; index < group.entries.length; index += 1) {
      const { quantityItem } = group.entries[index];
      const estimateLine = saveResult.data.lineItems[index];
      if (!estimateLine || !quantityItem) continue;
      const markResult = await markDesignQuantityItemsCommitted({
        quantityItemIds: [quantityItem.id],
        estimateLineId: estimateLine.id,
      });
      if (markResult.error || !markResult.data) {
        return { data: null, error: markResult.error ?? 'Could not link Design Builder quantity to estimate line.' };
      }
      committedQuantityItems.push(...markResult.data);
    }
  }

  return { data: { bundles, committedQuantityItems }, error: null };
}

type AssignedEntry = {
  line: DesignEstimatePreviewLine;
  quantityItem: DesignQuantityItem | undefined;
  assignment: DesignBuilderImportCommitAssignment;
};

function validateLaborQuantities(
  quantities: readonly DesignScopePackageQuantity[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): string | null {
  for (const quantity of quantities) {
    if (quantity.assignmentStatus === 'manual_override') {
      const manual = quantity.manualOverride;
      if (
        !manual ||
        manual.manHoursPerUnit <= 0 ||
        !manual.reason.trim() ||
        !manual.sourceNote.trim()
      ) {
        return `Manual override for "${quantity.line.description}" requires MH/unit, reason, and source note.`;
      }
      continue;
    }

    const rate = productionRateById.get(quantity.selectedProductionRateId ?? '');
    if (!rate) {
      return `Assign an approved production rate to "${quantity.line.description}" before creating activities.`;
    }
    if (rate.divisionCode !== quantity.line.divisionCode) {
      return `Selected production rate for "${quantity.line.description}" is not in Division ${quantity.line.divisionCode}.`;
    }
    if ((rate.manHoursPerUnit ?? 0) <= 0) {
      return `Selected production rate for "${quantity.line.description}" has no positive MH/unit.`;
    }
    if (!areProductionRateUnitsCompatible(quantity.line.unit, rate.unitOfMeasure)) {
      return `Selected production rate unit ${rate.unitOfMeasure} is not compatible with ${quantity.line.unit} for "${quantity.line.description}".`;
    }
  }
  return null;
}

function buildScopeProductionRateGroup(
  scopePackage: DesignScopePackage,
  laborQuantities: readonly DesignScopePackageQuantity[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): ProductionRateAssemblyGroup {
  const rates = laborQuantities.map((quantity) => productionRateById.get(quantity.selectedProductionRateId ?? '')!);
  return {
    divisionCode: scopePackage.divisionCode,
    divisionName: scopePackage.divisionName,
    category: scopePackage.category,
    rates,
    defaultTitle: scopePackage.title,
    suggestedCrewSize: suggestScopeCrewSize(laborQuantities, productionRateById),
    suggestedHoursPerDay: 8,
  };
}

function suggestScopeCrewSize(
  laborQuantities: readonly DesignScopePackageQuantity[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): number {
  const crewSizes = laborQuantities
    .map((quantity) => productionRateById.get(quantity.selectedProductionRateId ?? '')?.crewSize)
    .filter((value): value is number => value != null && value > 0);
  return crewSizes.length > 0 ? Math.max(...crewSizes) : 4;
}

function manualLineItemForScopeQuantity(
  quantity: DesignScopePackageQuantity,
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): ManualDraftLineItemInput {
  if (quantity.assignmentStatus === 'manual_override') {
    return {
      description: quantity.line.description,
      unit: quantity.line.unit,
      quantity: quantity.line.quantity,
      manHoursPerUnit: quantity.manualOverride?.manHoursPerUnit ?? 0,
      manualProductionRateReason: quantity.manualOverride?.reason ?? null,
      manualProductionRateSourceNote: quantity.manualOverride?.sourceNote ?? null,
      productionRateMatchReason: 'Manual Design Builder production-rate override.',
    };
  }

  const rate = productionRateById.get(quantity.selectedProductionRateId ?? '');
  return {
    description: rate?.activityName ?? quantity.line.description,
    unit: rate?.unitOfMeasure ?? quantity.line.unit,
    quantity: rate
      ? convertQuantityForProductionRateUnit(quantity.line.quantity, quantity.line.unit, rate.unitOfMeasure)
      : quantity.line.quantity,
    manHoursPerUnit: rate?.manHoursPerUnit ?? 0,
    productionRateMatchReason:
      quantity.candidates.find((candidate) => candidate.productionRateId === rate?.id)?.matchReason ??
      'Verified Design Builder production-rate assignment.',
  };
}

function mapScopeLineItemForSave(
  li: ProjectActivityLineItem,
  projectId: string,
): Omit<ProjectActivityLineItem, 'id' | 'projectActivityId' | 'createdAt'> & { id?: string } {
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
    productionRateAssignmentStatus: li.productionRateAssignmentStatus ?? null,
    productionRateMatchConfidence: li.productionRateMatchConfidence ?? null,
    productionRateMatchReason: li.productionRateMatchReason ?? null,
    manualProductionRateReason: li.manualProductionRateReason ?? null,
    manualProductionRateSourceNote: li.manualProductionRateSourceNote ?? null,
    sortOrder: li.sortOrder ?? 0,
  };
}

function resourceForQuantity(params: {
  quantity: DesignScopePackageQuantity;
  projectId: string;
  category: string;
  sortOrder: number;
}): Omit<ActivityMaterialResource, 'id' | 'activityId' | 'createdAt' | 'updatedAt'> &
  Omit<ActivityEquipmentResource, 'id' | 'activityId' | 'createdAt' | 'updatedAt'> {
  const line = params.quantity.line;
  return {
    projectId: params.projectId,
    name: line.description,
    description: `${line.quantityType} from Design Builder`,
    category: params.category,
    subcategory: line.quantityType,
    quantity: line.quantity,
    unit: line.unit,
    unitCost: 0,
    totalCost: 0,
    sourceProvider: 'manual',
    sourceSnapshot: {
      sourceName: 'Arden Design Builder',
      originalName: line.description,
      originalUnit: line.unit,
      originalDefaultUnitCost: 0,
      category: params.category,
      subcategory: line.quantityType,
      csiDivision: line.divisionCode,
      notes: line.formula,
      selectedAt: new Date().toISOString(),
    },
    sortOrder: params.sortOrder,
  };
}

function designQuantityImportUpdate(params: {
  quantity: DesignScopePackageQuantity;
  scopePackageKey: string;
  estimateActivityId?: string | null;
  estimateLineId?: string | null;
  materialResourceId?: string | null;
  equipmentResourceId?: string | null;
}): Parameters<typeof markDesignQuantityItemsImported>[0]['updates'] {
  const quantityItem = params.quantity.persistedQuantityItem;
  if (!quantityItem) return [];

  return [
    {
      quantityItemId: quantityItem.id,
      estimateActivityId: params.estimateActivityId ?? null,
      estimateLineId: params.estimateLineId ?? null,
      materialResourceId: params.materialResourceId ?? null,
      equipmentResourceId: params.equipmentResourceId ?? null,
      importDestination: params.quantity.classification.destination,
      importStatus: importStatusForDestination(params.quantity.classification.destination),
      scopePackageKey: params.scopePackageKey,
      importReviewReason: params.quantity.classification.reason,
    },
  ];
}

function importStatusForDestination(
  destination: DesignQuantityDestination,
): 'imported' | 'reference_only' | 'excluded' | 'review_required' {
  switch (destination) {
    case 'activity_line_item':
    case 'material_resource':
    case 'equipment_resource':
      return 'imported';
    case 'reference_only':
    case 'quality_check':
      return 'reference_only';
    case 'rollup':
    case 'placeholder':
    case 'excluded':
      return 'excluded';
    default:
      return 'review_required';
  }
}

function buildScopeActivityNotes(scopePackage: DesignScopePackage): string {
  const references = scopePackage.quantities
    .filter((quantity) =>
      ['reference_only', 'quality_check', 'rollup', 'placeholder', 'excluded'].includes(
        quantity.classification.destination,
      ),
    )
    .map(
      (quantity) =>
        `${quantity.line.description}: ${quantity.line.quantity} ${quantity.line.unit}${
          quantity.classification.reason ? ` (${quantity.classification.reason})` : ''
        }`,
    );
  return [
    'Generated from Arden Design Builder scope package. Verify quantities, production rates, and structural requirements before pricing.',
    references.length > 0 ? `Reference/excluded quantities: ${references.join('; ')}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function mergeActivities(
  ...groups: Array<readonly ProjectConstructionActivity[] | null | undefined>
): ProjectConstructionActivity[] {
  const byId = new Map<string, ProjectConstructionActivity>();
  for (const group of groups) {
    for (const activity of group ?? []) {
      byId.set(activity.id || activity.activityCode, activity);
    }
  }
  return [...byId.values()];
}

function groupAssignedEntries(entries: readonly AssignedEntry[]): Array<{
  scheduleGroup: DesignBuilderScheduleGroupRule;
  entries: AssignedEntry[];
}> {
  const grouped = new Map<string, { scheduleGroup: DesignBuilderScheduleGroupRule; entries: AssignedEntry[] }>();
  for (const entry of entries) {
    const key = entry.assignment.scheduleGroup.key;
    const existing = grouped.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      grouped.set(key, {
        scheduleGroup: entry.assignment.scheduleGroup,
        entries: [entry],
      });
    }
  }
  return [...grouped.values()];
}

function buildProductionRateGroup(
  scheduleGroup: DesignBuilderScheduleGroupRule,
  rates: ProductionRateLibraryEntry[],
): ProductionRateAssemblyGroup {
  const crewSizes = rates
    .map((rate) => rate.crewSize)
    .filter((value): value is number => value != null && value > 0);
  return {
    divisionCode: scheduleGroup.divisionCode,
    divisionName: scheduleGroup.divisionName,
    category: scheduleGroup.category,
    rates,
    defaultTitle: scheduleGroup.title,
    suggestedCrewSize: crewSizes.length > 0 ? Math.max(...crewSizes) : 4,
    suggestedHoursPerDay: 8,
  };
}

function buildIdentityFromScheduleGroup(group: DesignBuilderScheduleGroupRule): ActivityInstanceIdentityInput {
  return {
    activityName: group.title,
    instanceLabel: 'Parametric',
    location: '5m x 6m CMU Template',
    notes: 'Generated from Arden Design Builder parametric quantities. Verify quantities and structural requirements before pricing.',
  };
}
