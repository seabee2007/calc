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
import { rollupConstructionActivity } from '../../estimating/domain/constructionActivityCalculations';
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
  deleteProjectActivity,
  fetchProjectActivities,
  saveActivityBundleWithResources,
  updateProjectLineItemFromDesignPreview,
  type SavedActivityBundle,
  type SavedActivityBundleWithResources,
} from '../../estimating/infrastructure/activityRepository';
import {
  finalizeDesignBuilderImportLinks,
  listDesignQuantityImportLinksByActivityKeys,
  markDesignQuantityItemsImported,
  markDesignQuantityItemsCommitted,
  replaceDesignQuantityItems,
} from '../services/designBuilderService';
import type {
  CreateDesignQuantityImportLinkInput,
  DesignEstimatePreviewLine,
  DesignQuantityImportLink,
  DesignQuantityItem,
} from '../types';
import type { DesignBuilderScheduleGroupRule } from './designBuilderImportRules';
import type {
  DesignActivityDraft,
  DesignQuantityDestination,
  DesignQuantityUsage,
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
      previewLineId: line.id,
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

export interface CommitDesignActivityDraftsInput {
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  activities: readonly DesignActivityDraft[];
  referenceUsages?: readonly DesignQuantityUsage[];
  excludedUsages?: readonly DesignQuantityUsage[];
  rollupUsages?: readonly DesignQuantityUsage[];
  existingActivities: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
  productionRates: readonly ProductionRateLibraryEntry[];
}

export interface CommitDesignActivityDraftsResult {
  bundles: SavedActivityBundleWithResources[];
  committedQuantityItems: DesignQuantityItem[];
  importLinks: DesignQuantityImportLink[];
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

export async function commitDesignActivityDrafts(
  input: CommitDesignActivityDraftsInput,
): Promise<RepositoryResult<CommitDesignActivityDraftsResult>> {
  const candidateActivities = input.activities.filter((activity) => activity.usages.length > 0);
  const nonActivityUsages = [
    ...(input.referenceUsages ?? []),
    ...(input.excludedUsages ?? []),
    ...(input.rollupUsages ?? []),
  ];

  if (candidateActivities.length === 0 && nonActivityUsages.length === 0) {
    return { data: null, error: 'Build activity drafts before creating activities.' };
  }

  const productionRateById = new Map(input.productionRates.map((rate) => [rate.id, rate]));
  const validationError = validateActivityDrafts(candidateActivities, productionRateById);
  if (validationError) return { data: null, error: validationError };

  const activityKeys = candidateActivities.map((activity) => activity.key);
  const sourcePreviewLineIds = uniqueStrings([
    ...candidateActivities.flatMap((activity) =>
      activity.usages.map((usage) => usage.sourcePreviewLineId),
    ),
    ...nonActivityUsages.map((usage) => usage.sourcePreviewLineId),
  ]);
  const priorLinksResult = await listDesignQuantityImportLinksByActivityKeys({
    designModelId: input.designModelId,
    projectId: input.projectId,
    estimateId: input.estimateId ?? null,
    activityKeys,
    sourcePreviewLineIds,
  });
  if (priorLinksResult.error || !priorLinksResult.data) {
    return {
      data: null,
      error: priorLinksResult.error ?? 'Could not load prior Design Builder import links.',
    };
  }

  const priorActivityIdByKey = new Map<string, string>();
  for (const link of priorLinksResult.data) {
    if (!link.activityKey || !link.projectActivityId || priorActivityIdByKey.has(link.activityKey)) continue;
    priorActivityIdByKey.set(link.activityKey, link.projectActivityId);
  }

  const loadedActivities = await fetchProjectActivities(input.projectId, input.estimateId ?? undefined);
  if (loadedActivities.error || !loadedActivities.data) {
    return {
      data: null,
      error: loadedActivities.error ?? 'Could not load existing activities before Design Builder import.',
    };
  }

  const existingActivities = mergeActivities(loadedActivities.data, input.existingActivities);
  const existingActivityById = new Map(existingActivities.map((activity) => [activity.id, activity]));
  const bundles: SavedActivityBundleWithResources[] = [];
  const createdActivityIds: string[] = [];
  const pendingLinks: CreateDesignQuantityImportLinkInput[] = [];
  const legacyUpdates = new Map<string, Parameters<typeof markDesignQuantityItemsImported>[0]['updates'][number]>();
  const commitBatchId = createUuid();

  try {
    for (const activity of candidateActivities) {
      const enabledUsages = activity.usages.filter((usage) => usage.enabled);
      const laborUsages = enabledUsages.filter((usage) => usage.destination === 'activity_line_item');
      const materialUsages = enabledUsages.filter((usage) => usage.destination === 'material_resource');
      const equipmentUsages = enabledUsages.filter((usage) => usage.destination === 'equipment_resource');
      const hasEnabledChildren = laborUsages.length > 0 || materialUsages.length > 0 || equipmentUsages.length > 0;
      const priorActivityId = priorActivityIdByKey.get(activity.key) ?? null;
      const shouldSaveActivity = hasEnabledChildren || Boolean(priorActivityId);
      const existingActivity = priorActivityId ? existingActivityById.get(priorActivityId) : undefined;
      let saveResult: RepositoryResult<SavedActivityBundleWithResources> | null = null;

      const sourceTemplateKey = `design_activity:${activity.key}`;
      if (shouldSaveActivity) {
        const identity: ActivityInstanceIdentityInput = {
          activityName: activity.title,
          instanceLabel: 'Parametric',
          location: 'Design Builder',
          notes: buildActivityDraftNotes(activity),
        };
        const assigned = assignProjectActivityCode({
          existingActivities: mergeActivities(existingActivities, bundles.map((bundle) => bundle.activity)),
          divisionCode: activity.divisionCode,
          sourceTemplateKey,
          identity,
          preserveActivityCode: existingActivity?.activityCode ?? null,
          excludeActivityId: priorActivityId ?? undefined,
        });
        const instantiation = instantiateActivityDraft({
          activity,
          laborUsages,
          productionRateById,
          projectId: input.projectId,
          estimateId: input.estimateId ?? null,
          projectLaborRates: input.projectLaborRates,
          identity,
          assigned,
          sourceTemplateKey,
          projectActivityId: priorActivityId ?? undefined,
        });

        saveResult = await saveActivityBundleWithResources({
          activity: {
            ...instantiation.projectActivity,
            sourceTemplateKey,
            description: activity.category,
            scheduleEnabled: laborUsages.length > 0,
          },
          lineItems: instantiation.projectLineItems.map((lineItem, index) =>
            mapScopeLineItemForSave(
              withDesignBuilderLineItemSource({
                lineItem,
                usage: laborUsages[index],
                designModelId: input.designModelId,
                activityKey: activity.key,
                commitBatchId,
              }),
              input.projectId,
            ),
          ),
          materials: materialUsages.map((usage, index) =>
            resourceForUsage({
              usage,
              projectId: input.projectId,
              designModelId: input.designModelId,
              activityKey: activity.key,
              commitBatchId,
              category: activity.category,
              sortOrder: index,
            }),
          ),
          equipment: equipmentUsages.map((usage, index) =>
            resourceForUsage({
              usage,
              projectId: input.projectId,
              designModelId: input.designModelId,
              activityKey: activity.key,
              commitBatchId,
              category: activity.category,
              sortOrder: index,
            }),
          ),
          activityId: priorActivityId ?? undefined,
          generatedChildSource: {
            sourceProvider: 'arden_design_builder',
            designModelId: input.designModelId,
            activityKey: activity.key,
            commitBatchId,
          },
        });

        if (saveResult.error || !saveResult.data) {
          throw new Error(saveResult.error ?? 'Could not create Design Builder activity.');
        }

        bundles.push(saveResult.data);
        if (!priorActivityId) createdActivityIds.push(saveResult.data.activity.id);
      }

      const lineItemByUsageId = new Map(
        laborUsages.map((usage, index) => [usage.id, saveResult?.data?.lineItems[index]?.id ?? null]),
      );
      const materialByUsageId = new Map(
        materialUsages.map((usage, index) => [usage.id, saveResult?.data?.materials[index]?.id ?? null]),
      );
      const equipmentByUsageId = new Map(
        equipmentUsages.map((usage, index) => [usage.id, saveResult?.data?.equipment[index]?.id ?? null]),
      );

      for (const usage of activity.usages) {
        const target = usage.enabled && saveResult?.data
          ? targetForUsage({
              usage,
              projectActivityId: saveResult.data.activity.id,
              lineItemId: lineItemByUsageId.get(usage.id) ?? null,
              materialResourceId: materialByUsageId.get(usage.id) ?? null,
              equipmentResourceId: equipmentByUsageId.get(usage.id) ?? null,
            })
          : reviewTargetForUsage(usage, saveResult?.data?.activity.id ?? priorActivityId);
        const link = importLinkForUsage({
          usage,
          target,
          projectId: input.projectId,
          estimateId: input.estimateId ?? null,
          designModelId: input.designModelId,
          commitBatchId,
        });
        if (link) {
          pendingLinks.push(link);
          rememberLegacyUpdate(legacyUpdates, usage, target);
        }
      }
    }

    for (const usage of nonActivityUsages) {
      const target = {
        targetType: usage.destination === 'excluded' ? 'excluded' : 'reference',
        targetId: null,
        projectActivityId: null,
        estimateLineId: null,
        materialResourceId: null,
        equipmentResourceId: null,
      };
      const link = importLinkForUsage({
        usage,
        target,
        projectId: input.projectId,
        estimateId: input.estimateId ?? null,
        designModelId: input.designModelId,
        commitBatchId,
      });
      if (link) {
        pendingLinks.push(link);
        rememberLegacyUpdate(legacyUpdates, usage, target);
      }
    }

    const finalizeResult = await finalizeDesignBuilderImportLinks({
      designModelId: input.designModelId,
      projectId: input.projectId,
      estimateId: input.estimateId ?? null,
      commitBatchId,
      activityKeys,
      sourcePreviewLineIds,
      links: pendingLinks,
      quantityUpdates: [...legacyUpdates.values()],
    });
    if (finalizeResult.error || !finalizeResult.data) {
      throw new Error(finalizeResult.error ?? 'Could not finalize Design Builder import links.');
    }

    return {
      data: {
        bundles,
        committedQuantityItems: finalizeResult.data.quantityItems,
        importLinks: finalizeResult.data.importLinks,
      },
      error: null,
    };
  } catch (error) {
    for (const activityId of createdActivityIds) {
      await deleteProjectActivity(activityId);
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

type UsageTarget = {
  targetType: string;
  targetId: string | null;
  projectActivityId: string | null;
  estimateLineId: string | null;
  materialResourceId: string | null;
  equipmentResourceId: string | null;
};

function validateActivityDrafts(
  activities: readonly DesignActivityDraft[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): string | null {
  for (const activity of activities) {
    for (const usage of activity.usages) {
      if (!usage.enabled || usage.destination !== 'activity_line_item') continue;
      if (usage.reviewStatus === 'needs_review') {
        return usage.reviewReason ?? `Review "${usage.description}" before creating activities.`;
      }
      if (usage.manualOverride) {
        if (!isManualUsageComplete(usage)) {
          return `Manual override for "${usage.description}" requires MH/unit, reason, and source note.`;
        }
        continue;
      }
      const rate = productionRateById.get(usage.productionRateId ?? '');
      if (!rate) {
        return `Assign an approved production rate to "${usage.description}" before creating activities.`;
      }
      if (rate.divisionCode !== activity.divisionCode) {
        return `Selected production rate for "${usage.description}" is not in Division ${activity.divisionCode}.`;
      }
      if ((rate.manHoursPerUnit ?? 0) <= 0) {
        return `Selected production rate for "${usage.description}" has no positive MH/unit.`;
      }
      if (!areProductionRateUnitsCompatible(usage.unit, rate.unitOfMeasure)) {
        return `Selected production rate unit ${rate.unitOfMeasure} is not compatible with ${usage.unit} for "${usage.description}".`;
      }
    }
  }
  return null;
}

function isManualUsageComplete(usage: DesignQuantityUsage): boolean {
  const manual = usage.manualOverride;
  return (
    Boolean(manual) &&
    Number.isFinite(manual?.manHoursPerUnit) &&
    (manual?.manHoursPerUnit ?? 0) > 0 &&
    Boolean(manual?.reason.trim()) &&
    Boolean(manual?.sourceNote.trim())
  );
}

function instantiateActivityDraft(params: {
  activity: DesignActivityDraft;
  laborUsages: readonly DesignQuantityUsage[];
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>;
  projectId: string;
  estimateId?: string | null;
  projectLaborRates: readonly ProjectLaborRate[];
  identity: ActivityInstanceIdentityInput;
  assigned: ReturnType<typeof assignProjectActivityCode>;
  sourceTemplateKey: string;
  projectActivityId?: string;
}) {
  if (params.laborUsages.length === 0) {
    return instantiateManualConstructionActivity({
      projectId: params.projectId,
      estimateId: params.estimateId ?? undefined,
      divisionCode: params.activity.divisionCode,
      divisionName: params.activity.divisionName,
      lineItems: params.laborUsages.map((usage) =>
        manualLineItemForUsage(usage, params.productionRateById),
      ),
      identity: params.identity,
      assigned: params.assigned,
      crewSize: suggestUsageCrewSize(params.laborUsages, params.productionRateById),
      hoursPerDay: 8,
      scheduleEnabled: params.laborUsages.length > 0,
      projectLaborRates: params.projectLaborRates,
      sourceTemplateKey: params.sourceTemplateKey,
      projectActivityId: params.projectActivityId,
    });
  }

  const manualUsages = params.laborUsages.filter((usage) => Boolean(usage.manualOverride));
  const rateUsages = params.laborUsages.filter((usage) => !usage.manualOverride);
  const lineItemByUsageId = new Map<string, ProjectActivityLineItem>();
  const warnings: string[] = [];
  let projectActivity: ProjectConstructionActivity | null = null;

  if (rateUsages.length > 0) {
    const rateResult = instantiateProductionRateAssembly({
      projectId: params.projectId,
      estimateId: params.estimateId ?? undefined,
      group: buildUsageProductionRateGroup(params.activity, rateUsages, params.productionRateById),
      selectedLineItems: rateUsages.map((usage) => {
        const rate = params.productionRateById.get(usage.productionRateId ?? '')!;
        return {
          rate,
          quantity: convertQuantityForProductionRateUnit(
            usage.quantity,
            usage.unit,
            rate.unitOfMeasure,
          ),
          assignmentStatus: usage.matchConfidence != null ? 'auto_matched' : 'verified_rate',
          matchConfidence: usage.matchConfidence ?? null,
          matchReason: usage.matchReason ?? null,
        };
      }),
      identity: params.identity,
      assigned: params.assigned,
      crewSize: suggestUsageCrewSize(params.laborUsages, params.productionRateById),
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates: params.projectLaborRates,
      projectActivityId: params.projectActivityId,
    });
    projectActivity = rateResult.projectActivity;
    warnings.push(...rateResult.laborRoleWarnings);
    rateUsages.forEach((usage, index) => {
      const lineItem = rateResult.projectLineItems[index];
      if (lineItem) lineItemByUsageId.set(usage.id, lineItem);
    });
  }

  if (manualUsages.length > 0) {
    const manualResult = instantiateManualConstructionActivity({
      projectId: params.projectId,
      estimateId: params.estimateId ?? undefined,
      divisionCode: params.activity.divisionCode,
      divisionName: params.activity.divisionName,
      lineItems: manualUsages.map((usage) =>
        manualLineItemForUsage(usage, params.productionRateById),
      ),
      identity: params.identity,
      assigned: params.assigned,
      crewSize: suggestUsageCrewSize(params.laborUsages, params.productionRateById),
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates: params.projectLaborRates,
      sourceTemplateKey: params.sourceTemplateKey,
      projectActivityId: params.projectActivityId,
    });
    projectActivity ??= manualResult.projectActivity;
    warnings.push(...manualResult.laborRoleWarnings);
    manualUsages.forEach((usage, index) => {
      const lineItem = manualResult.projectLineItems[index];
      if (lineItem) lineItemByUsageId.set(usage.id, lineItem);
    });
  }

  const projectLineItems = params.laborUsages.flatMap((usage, index) => {
    const lineItem = lineItemByUsageId.get(usage.id);
    return lineItem ? [{ ...lineItem, sortOrder: index + 1 }] : [];
  });
  const rollupBase = rollupConstructionActivity(projectActivity!, projectLineItems);
  const rollup = {
    ...rollupBase,
    warnings: [...warnings, ...rollupBase.warnings],
  };

  return {
    projectActivity: {
      ...projectActivity!,
      calculatedManHours: rollup.totalManHours,
      calculatedManDays: rollup.totalManDays,
      calculatedDurationDays: rollup.calculatedDurationDays,
      effectiveDurationDays: rollup.effectiveDurationDays,
      totalLaborCost: rollup.totalLaborCost,
      totalMaterialCost: rollup.totalMaterialCost,
      totalEquipmentCost: rollup.totalEquipmentCost,
      totalSubcontractCost: 0,
      totalCost: rollup.totalDirectCost,
    },
    projectLineItems,
    rollup,
    laborRoleWarnings: warnings,
  };
}

function buildUsageProductionRateGroup(
  activity: DesignActivityDraft,
  laborUsages: readonly DesignQuantityUsage[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): ProductionRateAssemblyGroup {
  const rates = laborUsages.map((usage) => productionRateById.get(usage.productionRateId ?? '')!);
  return {
    divisionCode: activity.divisionCode,
    divisionName: activity.divisionName,
    category: activity.category,
    rates,
    defaultTitle: activity.title,
    suggestedCrewSize: suggestUsageCrewSize(laborUsages, productionRateById),
    suggestedHoursPerDay: 8,
  };
}

function suggestUsageCrewSize(
  laborUsages: readonly DesignQuantityUsage[],
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): number {
  const crewSizes = laborUsages
    .map((usage) => productionRateById.get(usage.productionRateId ?? '')?.crewSize)
    .filter((value): value is number => value != null && value > 0);
  return crewSizes.length > 0 ? Math.max(...crewSizes) : 4;
}

function manualLineItemForUsage(
  usage: DesignQuantityUsage,
  productionRateById: ReadonlyMap<string, ProductionRateLibraryEntry>,
): ManualDraftLineItemInput {
  if (usage.manualOverride) {
    return {
      description: usage.description,
      unit: usage.unit,
      quantity: usage.quantity,
      manHoursPerUnit: usage.manualOverride.manHoursPerUnit,
      manualProductionRateReason: usage.manualOverride.reason,
      manualProductionRateSourceNote: usage.manualOverride.sourceNote,
      productionRateMatchReason: usage.matchReason ?? 'Manual Design Builder production-rate override.',
    };
  }

  const rate = productionRateById.get(usage.productionRateId ?? '');
  return {
    description: rate?.activityName ?? usage.description,
    unit: rate?.unitOfMeasure ?? usage.unit,
    quantity: rate
      ? convertQuantityForProductionRateUnit(usage.quantity, usage.unit, rate.unitOfMeasure)
      : usage.quantity,
    manHoursPerUnit: rate?.manHoursPerUnit ?? 0,
    productionRateMatchReason:
      usage.matchReason ??
      usage.candidates?.find((candidate) => candidate.productionRateId === rate?.id)?.matchReason ??
      'Verified Design Builder production-rate assignment.',
  };
}

function designBuilderSourceSnapshot(params: {
  usage: DesignQuantityUsage;
  designModelId: string;
  activityKey: string;
  commitBatchId: string;
  category?: string;
}): NonNullable<ProjectActivityLineItem['sourceSnapshot']> {
  return {
    sourceName: 'Arden Design Builder',
    originalName: params.usage.description,
    originalUnit: params.usage.unit,
    originalDefaultUnitCost: 0,
    category: params.category,
    subcategory: params.usage.sourceQuantityType ?? params.usage.role,
    csiDivision: String(params.usage.metadata.divisionCode ?? ''),
    notes: params.usage.formula,
    selectedAt: new Date().toISOString(),
    designModelId: params.designModelId,
    activityKey: params.activityKey,
    usageId: params.usage.id,
    sourcePreviewLineId: params.usage.sourcePreviewLineId,
    commitBatchId: params.commitBatchId,
  };
}

function withDesignBuilderLineItemSource(params: {
  lineItem: ProjectActivityLineItem;
  usage: DesignQuantityUsage | undefined;
  designModelId: string;
  activityKey: string;
  commitBatchId: string;
}): ProjectActivityLineItem {
  if (!params.usage) return params.lineItem;
  return {
    ...params.lineItem,
    sourceProvider: 'arden_design_builder',
    sourceSnapshot: designBuilderSourceSnapshot({
      usage: params.usage,
      designModelId: params.designModelId,
      activityKey: params.activityKey,
      commitBatchId: params.commitBatchId,
    }),
  };
}

function resourceForUsage(params: {
  usage: DesignQuantityUsage;
  projectId: string;
  designModelId: string;
  activityKey: string;
  commitBatchId: string;
  category: string;
  sortOrder: number;
}): Omit<ActivityMaterialResource, 'id' | 'activityId' | 'createdAt' | 'updatedAt'> &
  Omit<ActivityEquipmentResource, 'id' | 'activityId' | 'createdAt' | 'updatedAt'> {
  const usage = params.usage;
  return {
    projectId: params.projectId,
    name: usage.description,
    description: `${usage.sourceQuantityType ?? usage.role} from Design Builder`,
    category: params.category,
    subcategory: usage.sourceQuantityType ?? usage.role,
    quantity: usage.quantity,
    unit: usage.unit,
    unitCost: 0,
    totalCost: 0,
    sourceProvider: 'arden_design_builder',
    sourceSnapshot: designBuilderSourceSnapshot({
      usage,
      designModelId: params.designModelId,
      activityKey: params.activityKey,
      commitBatchId: params.commitBatchId,
      category: params.category,
    }),
    sortOrder: params.sortOrder,
  };
}

function targetForUsage(params: {
  usage: DesignQuantityUsage;
  projectActivityId: string | null;
  lineItemId: string | null;
  materialResourceId: string | null;
  equipmentResourceId: string | null;
}): UsageTarget {
  if (params.usage.destination === 'activity_line_item') {
    return {
      targetType: 'project_activity_line_item',
      targetId: params.lineItemId,
      projectActivityId: params.projectActivityId,
      estimateLineId: params.lineItemId,
      materialResourceId: null,
      equipmentResourceId: null,
    };
  }
  if (params.usage.destination === 'material_resource') {
    return {
      targetType: 'project_activity_material_resource',
      targetId: params.materialResourceId,
      projectActivityId: params.projectActivityId,
      estimateLineId: null,
      materialResourceId: params.materialResourceId,
      equipmentResourceId: null,
    };
  }
  if (params.usage.destination === 'equipment_resource') {
    return {
      targetType: 'project_activity_equipment_resource',
      targetId: params.equipmentResourceId,
      projectActivityId: params.projectActivityId,
      estimateLineId: null,
      materialResourceId: null,
      equipmentResourceId: params.equipmentResourceId,
    };
  }
  return {
    targetType: params.usage.destination === 'excluded' ? 'excluded' : 'reference',
    targetId: null,
    projectActivityId: params.projectActivityId,
    estimateLineId: null,
    materialResourceId: null,
    equipmentResourceId: null,
  };
}

function reviewTargetForUsage(
  usage: DesignQuantityUsage,
  projectActivityId: string | null,
): UsageTarget {
  return {
    targetType: usage.destination === 'excluded' ? 'excluded' : 'reference',
    targetId: null,
    projectActivityId,
    estimateLineId: null,
    materialResourceId: null,
    equipmentResourceId: null,
  };
}

function importLinkForUsage(params: {
  usage: DesignQuantityUsage;
  target: UsageTarget;
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  commitBatchId: string;
}): CreateDesignQuantityImportLinkInput | null {
  const quantityItem = params.usage.persistedQuantityItem;
  if (!quantityItem) return null;

  return {
    designQuantityItemId: quantityItem.id,
    designModelId: params.designModelId,
    projectId: params.projectId,
    estimateId: params.estimateId ?? null,
    targetType: params.target.targetType,
    targetId: params.target.targetId,
    projectActivityId: params.target.projectActivityId,
    usageRole: params.usage.role,
    destination: params.usage.destination,
    scopePackageKey: scopeKeyForUsage(params.usage),
    activityKey: params.usage.activityKey,
    sourcePreviewLineId: params.usage.sourcePreviewLineId,
    quantity: params.usage.quantity,
    unit: params.usage.unit,
    formula: params.usage.formula,
    derived: params.usage.derived,
    metadata: {
      usageId: params.usage.id,
      reviewStatus: params.usage.reviewStatus,
      reviewReason: params.usage.reviewReason ?? null,
      sourcePreviewLineId: params.usage.sourcePreviewLineId,
      sourceQuantityType: params.usage.sourceQuantityType,
      ...params.usage.metadata,
    },
    commitBatchId: params.commitBatchId,
  };
}

function rememberLegacyUpdate(
  updates: Map<string, Parameters<typeof markDesignQuantityItemsImported>[0]['updates'][number]>,
  usage: DesignQuantityUsage,
  target: UsageTarget,
) {
  const quantityItem = usage.persistedQuantityItem;
  if (!quantityItem || updates.has(quantityItem.id)) return;
  updates.set(quantityItem.id, {
    quantityItemId: quantityItem.id,
    estimateActivityId: target.projectActivityId,
    estimateLineId: target.estimateLineId,
    materialResourceId: target.materialResourceId,
    equipmentResourceId: target.equipmentResourceId,
    importDestination: usage.destination as DesignQuantityDestination,
    importStatus: importStatusForUsage(usage, target),
    scopePackageKey: scopeKeyForUsage(usage),
    importReviewReason: usage.reviewReason ?? null,
  });
}

function importStatusForUsage(
  usage: DesignQuantityUsage,
  target: UsageTarget,
): 'imported' | 'reference_only' | 'excluded' | 'review_required' {
  if (target.targetType === 'excluded') return 'excluded';
  if (!usage.enabled || usage.reviewStatus === 'needs_review') return 'review_required';
  switch (usage.destination) {
    case 'activity_line_item':
    case 'material_resource':
    case 'equipment_resource':
      return 'imported';
    case 'reference_only':
    case 'rollup':
      return 'reference_only';
    case 'excluded':
      return 'excluded';
    default:
      return 'review_required';
  }
}

function scopeKeyForUsage(usage: DesignQuantityUsage): string {
  const packageKey = usage.metadata.packageKey;
  if (typeof packageKey === 'string' && packageKey.trim()) return packageKey;
  return usage.activityKey ?? 'design-usage-reference';
}

function buildActivityDraftNotes(activity: DesignActivityDraft): string {
  const references = activity.usages
    .filter((usage) =>
      usage.destination === 'reference_only' ||
      usage.destination === 'rollup' ||
      usage.destination === 'excluded' ||
      !usage.enabled,
    )
    .map((usage) => `${usage.description}: ${usage.quantity} ${usage.unit}${
      usage.reviewReason ? ` (${usage.reviewReason})` : ''
    }`);
  return [
    'Generated from Arden Design Builder usage compiler. Verify quantities, production rates, and structural requirements before pricing.',
    references.length > 0 ? `Reference/excluded usages: ${references.join('; ')}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

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
    sourceProvider: li.sourceProvider ?? null,
    sourceSnapshot: li.sourceSnapshot,
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
