/**
 * Construction activity service.
 *
 * High-level operations combining the assembly instantiation layer with
 * the NTRP repository. This is the primary entry point for UI actions.
 */
import type { ActivityAssemblySpec, AssemblyUserInputs } from '../domain/activityAssemblyTypes';
import type {
  ActivityLineItemTemplate,
  EstimateDivision,
  ProductionRate,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import {
  calculateLineItemManHours,
  rollupConstructionActivity,
} from '../domain/constructionActivityCalculations';
import { roundToTwo } from '../domain/estimateMath';
import {
  applyManualLaborPricingToLineItem,
} from './laborPricingCalculator';
import {
  applyResolvedLaborRateToLineItem,
  resolveLaborRateForWorkElement,
  workElementFromLineItem,
} from './laborRateResolver';
import {
  assignProjectActivityCode,
  type ActivityInstanceIdentityInput,
  validateInstanceLabelForDuplicateTemplate,
} from './constructionActivityCoding';
import {
  saveActivityBundle,
  fetchProjectActivities,
  fetchProjectLineItems,
  deleteProjectActivity,
  type SavedActivityBundle,
} from '../infrastructure/activityRepository';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';
import {
  instantiateManualConstructionActivity,
  instantiateProductionRateAssembly,
  buildProductionRateCategorySourceTemplateKey,
  MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
  type ManualDraftLineItemInput,
  type ProductionRateAssemblyGroup,
} from './productionRateAssemblyBuilder';

export interface InstantiateAndSaveInput {
  assembly: ActivityAssemblySpec;
  userInputs: AssemblyUserInputs;
  division: EstimateDivision;
  lineItemTemplates: readonly ActivityLineItemTemplate[];
  productionRates: readonly ProductionRate[] | Map<string, ProductionRate>;
  projectId: string;
  estimateId?: string;
  crewSize?: number;
  hoursPerDay?: number;
  productionFactor?: number;
  durationDaysOverride?: number | null;
  identity: ActivityInstanceIdentityInput;
  existingActivities?: readonly ProjectConstructionActivity[];
  existingActivityId?: string;
  defaultLaborRate?: ProjectLaborRate;
}

export interface SaveFromProductionRateAssemblyInput {
  group: ProductionRateAssemblyGroup;
  selectedLineItems: Array<{
    rateId: string;
    quantity: number;
    laborRoleId?: string | null;
  }>;
  projectId: string;
  estimateId?: string;
  crewSize?: number;
  hoursPerDay?: number;
  durationDaysOverride?: number | null;
  scheduleEnabled?: boolean;
  identity: ActivityInstanceIdentityInput;
  existingActivities?: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
}

export interface SaveManualActivityInput {
  divisionCode: string;
  divisionName: string;
  lineItems: ManualDraftLineItemInput[];
  projectId: string;
  estimateId?: string;
  crewSize?: number;
  hoursPerDay?: number;
  durationDaysOverride?: number | null;
  scheduleEnabled?: boolean;
  identity: ActivityInstanceIdentityInput;
  existingActivities?: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
}

export interface UpdateProjectActivityInput {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  identity: ActivityInstanceIdentityInput;
  crewSize: number;
  hoursPerDay: number;
  durationDaysOverride?: number | null;
  scheduleEnabled: boolean;
  lineItemQuantities: Record<string, number>;
  lineItemLaborRoles?: Record<string, string | null>;
  lineItemManualRates?: Record<
    string,
    { hourlyRate: number; burdenPercent: number; billingRate?: number } | null
  >;
}

export interface LoadedProjectActivity {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
}

export const DUPLICATE_ACTIVITY_CODE_MESSAGE =
  'Could not create activity because the activity code is already in use. Refresh and try again.';

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

function applyPricingUpdates(
  item: ProjectActivityLineItem,
  projectRates: Map<string, ProjectLaborRate>,
  laborRoleId?: string | null,
  manualRate?: { hourlyRate: number; burdenPercent: number; billingRate?: number } | null,
): ProjectActivityLineItem {
  if (manualRate) {
    return applyManualLaborPricingToLineItem(
      item,
      manualRate.hourlyRate,
      manualRate.burdenPercent,
      manualRate.billingRate,
    );
  }

  const projectLaborRates = [...projectRates.values()];

  if (laborRoleId !== undefined) {
    const resolved = resolveLaborRateForWorkElement({
      workElement: workElementFromLineItem(item),
      projectLaborRates,
      preferredRoleId: laborRoleId || null,
    });
    if (resolved.projectRate) {
      return applyResolvedLaborRateToLineItem(item, resolved);
    }
    return item;
  }

  if (item.fullyBurdenedRateSnapshot > 0) {
    const laborCost = roundToTwo(item.calculatedManHours * item.fullyBurdenedRateSnapshot);
    return {
      ...item,
      laborCost,
      totalCost: roundToTwo(laborCost + (item.materialCost ?? 0) + (item.equipmentCost ?? 0)),
    };
  }

  return item;
}

export function isDuplicateProjectActivityCodeError(error: string | null | undefined): boolean {
  if (!error) return false;
  return (
    error.includes('idx_project_construction_activities_code_unique') ||
    (/duplicate key value/i.test(error) && /activity(?:_|C)?code/i.test(error))
  );
}

function mergeExistingActivities(
  ...activityLists: Array<readonly ProjectConstructionActivity[] | null | undefined>
): ProjectConstructionActivity[] {
  const byKey = new Map<string, ProjectConstructionActivity>();
  for (const activities of activityLists) {
    for (const activity of activities ?? []) {
      const key = activity.id?.trim() || activity.activityCode?.trim();
      if (!key) continue;
      byKey.set(key, activity);
    }
  }
  return [...byKey.values()];
}

function reserveFailedActivityCode(
  activity: ProjectConstructionActivity,
): ProjectConstructionActivity {
  return {
    ...activity,
    sourceTemplateKey: `__reserved_activity_code__:${activity.activityCode}`,
    templateId: undefined,
    baseTitle: `Reserved activity code ${activity.activityCode}`,
    title: `Reserved activity code ${activity.activityCode}`,
  };
}

async function loadExistingActivitiesForCodeAssignment(input: {
  projectId: string;
  existingActivities?: readonly ProjectConstructionActivity[];
}): Promise<RepositoryResult<ProjectConstructionActivity[]>> {
  const persistedResult = await fetchProjectActivities(input.projectId);
  if (persistedResult.error || !persistedResult.data) {
    return {
      data: null,
      error: persistedResult.error ?? 'Could not load existing project activities before saving.',
    };
  }

  return {
    data: mergeExistingActivities(persistedResult.data, input.existingActivities),
    error: null,
  };
}

function buildAssignedIdentity(
  input: InstantiateAndSaveInput,
): { assigned: ReturnType<typeof assignProjectActivityCode> | null; validationError: string | null } {
  const validationError = validateInstanceLabelForDuplicateTemplate({
    existingActivities: input.existingActivities ?? [],
    sourceTemplateKey: input.assembly.activityTemplateId,
    instanceLabel: input.identity.instanceLabel,
    excludeActivityId: input.existingActivityId,
  });
  if (validationError) {
    return { assigned: null, validationError };
  }

  const assigned = assignProjectActivityCode({
    existingActivities: input.existingActivities ?? [],
    divisionCode: input.division.code,
    sourceTemplateKey: input.assembly.activityTemplateId,
    templateMasterCode: input.assembly.templateMasterCode,
    identity: input.identity,
    preserveActivityCode: input.existingActivityId
      ? input.existingActivities?.find((a) => a.id === input.existingActivityId)?.activityCode
      : null,
    excludeActivityId: input.existingActivityId,
  });

  return { assigned, validationError: null };
}

function buildAssignedForSourceTemplate(input: {
  existingActivities: readonly ProjectConstructionActivity[];
  divisionCode: string;
  sourceTemplateKey: string;
  identity: ActivityInstanceIdentityInput;
  excludeActivityId?: string;
}) {
  const validationError = validateInstanceLabelForDuplicateTemplate({
    existingActivities: input.existingActivities,
    sourceTemplateKey: input.sourceTemplateKey,
    instanceLabel: input.identity.instanceLabel,
    excludeActivityId: input.excludeActivityId,
  });
  if (validationError) {
    return { assigned: null, validationError };
  }

  const assigned = assignProjectActivityCode({
    existingActivities: input.existingActivities,
    divisionCode: input.divisionCode,
    sourceTemplateKey: input.sourceTemplateKey,
    identity: input.identity,
    excludeActivityId: input.excludeActivityId,
  });

  return { assigned, validationError: null };
}

export async function instantiateAndSaveFromProductionRateAssembly(
  input: SaveFromProductionRateAssemblyInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
  const rateById = new Map(input.group.rates.map((rate) => [rate.id, rate]));
  const selectedLineItems = input.selectedLineItems
    .map((entry) => {
      const rate = rateById.get(entry.rateId);
      if (!rate) return null;
      return {
        rate,
        quantity: entry.quantity,
        laborRoleId: entry.laborRoleId,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  if (selectedLineItems.length === 0) {
    return { data: null, error: 'Select at least one work element with quantity.' };
  }

  const sourceTemplateKey = buildProductionRateCategorySourceTemplateKey(
    input.group.divisionCode,
    input.group.category,
  );
  const loadedExisting = await loadExistingActivitiesForCodeAssignment(input);
  if (loadedExisting.error || !loadedExisting.data) {
    return { data: null, error: loadedExisting.error };
  }

  let existingActivities = loadedExisting.data;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { assigned, validationError } = buildAssignedForSourceTemplate({
      existingActivities,
      divisionCode: input.group.divisionCode,
      sourceTemplateKey,
      identity: input.identity,
    });

    if (validationError || !assigned) {
      return { data: null, error: validationError ?? 'Could not assign activity code.' };
    }

    const instantiationResult = instantiateProductionRateAssembly({
      projectId: input.projectId,
      estimateId: input.estimateId,
      group: input.group,
      selectedLineItems,
      identity: input.identity,
      assigned,
      crewSize: input.crewSize ?? input.group.suggestedCrewSize,
      hoursPerDay: input.hoursPerDay ?? input.group.suggestedHoursPerDay,
      durationDaysOverride: input.durationDaysOverride,
      scheduleEnabled: input.scheduleEnabled ?? true,
      projectLaborRates: input.projectLaborRates,
    });

    const { projectActivity, projectLineItems } = instantiationResult;
    const lineItemsForSave = projectLineItems.map((li) => mapLineItemForSave(li, input.projectId));
    const saveResult = await saveActivityBundle(projectActivity, lineItemsForSave);
    if (!isDuplicateProjectActivityCodeError(saveResult.error)) return saveResult;
    if (attempt === 1) return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };

    const refreshedExisting = await loadExistingActivitiesForCodeAssignment(input);
    existingActivities = mergeExistingActivities(
      existingActivities,
      refreshedExisting.data,
      [reserveFailedActivityCode(projectActivity)],
    );
  }

  return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };
}

export async function instantiateAndSaveManualActivity(
  input: SaveManualActivityInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
  if (input.lineItems.length === 0) {
    return { data: null, error: 'Add at least one manual line item.' };
  }

  const loadedExisting = await loadExistingActivitiesForCodeAssignment(input);
  if (loadedExisting.error || !loadedExisting.data) {
    return { data: null, error: loadedExisting.error };
  }

  let existingActivities = loadedExisting.data;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { assigned, validationError } = buildAssignedForSourceTemplate({
      existingActivities,
      divisionCode: input.divisionCode,
      sourceTemplateKey: MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
      identity: input.identity,
    });

    if (validationError || !assigned) {
      return { data: null, error: validationError ?? 'Could not assign activity code.' };
    }

    const instantiationResult = instantiateManualConstructionActivity({
      projectId: input.projectId,
      estimateId: input.estimateId,
      divisionCode: input.divisionCode,
      divisionName: input.divisionName,
      lineItems: input.lineItems,
      identity: input.identity,
      assigned,
      crewSize: input.crewSize ?? 4,
      hoursPerDay: input.hoursPerDay ?? 8,
      durationDaysOverride: input.durationDaysOverride,
      scheduleEnabled: input.scheduleEnabled ?? true,
      projectLaborRates: input.projectLaborRates,
    });

    const { projectActivity, projectLineItems } = instantiationResult;
    const lineItemsForSave = projectLineItems.map((li) => mapLineItemForSave(li, input.projectId));
    const saveResult = await saveActivityBundle(projectActivity, lineItemsForSave);
    if (!isDuplicateProjectActivityCodeError(saveResult.error)) return saveResult;
    if (attempt === 1) return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };

    const refreshedExisting = await loadExistingActivitiesForCodeAssignment(input);
    existingActivities = mergeExistingActivities(
      existingActivities,
      refreshedExisting.data,
      [reserveFailedActivityCode(projectActivity)],
    );
  }

  return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };
}

export async function instantiateAndSaveActivity(
  input: InstantiateAndSaveInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
  const loadedExisting = input.existingActivityId
    ? { data: input.existingActivities ?? [], error: null }
    : await loadExistingActivitiesForCodeAssignment(input);
  if (loadedExisting.error || !loadedExisting.data) {
    return { data: null, error: loadedExisting.error };
  }

  let existingActivities = loadedExisting.data;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { assigned, validationError } = buildAssignedIdentity({
      ...input,
      existingActivities,
    });
    if (validationError || !assigned) {
      return { data: null, error: validationError ?? 'Could not assign activity code.' };
    }

    const instantiationResult = instantiateFromAssemblySpec({
      assembly: input.assembly,
      userInputs: input.userInputs,
      division: input.division,
      lineItemTemplates: input.lineItemTemplates,
      productionRates: input.productionRates,
      projectId: input.projectId,
      estimateId: input.estimateId,
      crewSize: input.crewSize,
      hoursPerDay: input.hoursPerDay,
      productionFactor: input.productionFactor,
      durationDaysOverride: input.durationDaysOverride,
      activityTitleOverride: assigned.title,
      activityCode: assigned.activityCode,
      baseTitle: assigned.baseTitle,
      instanceLabel: input.identity.instanceLabel,
      location: input.identity.location,
      drawingReference: input.identity.drawingReference,
      phase: input.identity.phase,
      notes: input.identity.notes,
      activitySequence: assigned.activitySequence,
      instanceSequence: assigned.instanceSequence,
      defaultLaborRate: input.defaultLaborRate,
    });

    const { projectActivity, projectLineItems } = instantiationResult;

    const lineItemsForSave = projectLineItems.map((li) => mapLineItemForSave(li, input.projectId));

    const saveResult = await saveActivityBundle(
      projectActivity,
      lineItemsForSave,
      input.existingActivityId,
    );
    if (input.existingActivityId || !isDuplicateProjectActivityCodeError(saveResult.error)) {
      return saveResult;
    }
    if (attempt === 1) return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };

    const refreshedExisting = await loadExistingActivitiesForCodeAssignment(input);
    existingActivities = mergeExistingActivities(
      existingActivities,
      refreshedExisting.data,
      [reserveFailedActivityCode(projectActivity)],
    );
  }

  return { data: null, error: DUPLICATE_ACTIVITY_CODE_MESSAGE };
}

export async function updateProjectConstructionActivity(
  input: UpdateProjectActivityInput,
  projectRates: ProjectLaborRate[] = [],
): Promise<RepositoryResult<SavedActivityBundle>> {
  const rateMap = new Map(projectRates.map((rate) => [rate.id, rate]));

  const assigned = assignProjectActivityCode({
    existingActivities: [input.activity],
    divisionCode: input.activity.divisionCode,
    sourceTemplateKey: input.activity.sourceTemplateKey ?? input.activity.templateId ?? '',
    identity: input.identity,
    preserveActivityCode: input.activity.activityCode,
    excludeActivityId: input.activity.id,
  });

  let updatedLineItems = input.lineItems.map((item) => {
    const quantity =
      input.lineItemQuantities[item.id] ?? input.lineItemQuantities[item.name] ?? item.quantity;
    const calculatedManHours = calculateLineItemManHours(
      quantity,
      item.manHoursPerUnit,
      item.productionFactor,
    );
    return {
      ...item,
      quantity,
      calculatedManHours,
    };
  });

  if (input.lineItemLaborRoles || input.lineItemManualRates) {
    updatedLineItems = updatedLineItems.map((item) =>
      applyPricingUpdates(
        item,
        rateMap,
        input.lineItemLaborRoles?.[item.id],
        input.lineItemManualRates?.[item.id] ?? null,
      ),
    );
  } else {
    updatedLineItems = updatedLineItems.map((item) =>
      applyPricingUpdates(item, rateMap, undefined, undefined),
    );
  }

  const draftActivity: ProjectConstructionActivity = {
    ...input.activity,
    title: assigned.title,
    baseTitle: assigned.baseTitle,
    instanceLabel: input.identity.instanceLabel ?? null,
    location: input.identity.location ?? null,
    drawingReference: input.identity.drawingReference ?? null,
    phase: input.identity.phase ?? null,
    notes: input.identity.notes ?? null,
    crewSize: input.crewSize,
    hoursPerDay: input.hoursPerDay,
    durationDaysOverride: input.durationDaysOverride ?? null,
    scheduleEnabled: input.scheduleEnabled,
    activityCode: input.activity.activityCode,
  };

  const rollup = rollupConstructionActivity(draftActivity, updatedLineItems);
  const finalActivity: ProjectConstructionActivity = {
    ...draftActivity,
    calculatedManHours: rollup.totalManHours,
    calculatedManDays: rollup.totalManDays,
    calculatedDurationDays: rollup.calculatedDurationDays,
    effectiveDurationDays: rollup.effectiveDurationDays,
    totalLaborCost: rollup.totalLaborCost,
    totalMaterialCost: rollup.totalMaterialCost,
    totalEquipmentCost: rollup.totalEquipmentCost,
    totalSubcontractCost: 0,
    totalCost: rollup.totalDirectCost,
  };

  const lineItemsForSave = updatedLineItems.map((li) =>
    mapLineItemForSave(li, input.activity.projectId),
  );

  return saveActivityBundle(finalActivity, lineItemsForSave, input.activity.id);
}

export async function loadProjectActivitiesWithLineItems(
  projectId: string,
  estimateId?: string,
): Promise<RepositoryResult<LoadedProjectActivity[]>> {
  const activitiesResult = await fetchProjectActivities(projectId, estimateId);
  if (activitiesResult.error || !activitiesResult.data) {
    return { data: null, error: activitiesResult.error };
  }

  const activities = activitiesResult.data;
  if (activities.length === 0) return { data: [], error: null };

  const lineItemResults = await Promise.all(
    activities.map((a) => fetchProjectLineItems(a.id)),
  );

  const loaded: LoadedProjectActivity[] = activities.map((activity, i) => ({
    activity,
    lineItems: lineItemResults[i].data ?? [],
  }));

  return { data: loaded, error: null };
}

export async function removeProjectActivity(id: string): Promise<RepositoryResult<null>> {
  return deleteProjectActivity(id);
}

export function filterScheduleEligibleActivities(
  activities: ProjectConstructionActivity[],
): ProjectConstructionActivity[] {
  return activities.filter((a) => a.scheduleEnabled === true);
}

export type { ActivityInstanceIdentityInput };
