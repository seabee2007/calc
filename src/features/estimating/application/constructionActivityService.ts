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
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';

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
}

export interface LoadedProjectActivity {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
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

export async function instantiateAndSaveActivity(
  input: InstantiateAndSaveInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
  const { assigned, validationError } = buildAssignedIdentity(input);
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
  });

  const { projectActivity, projectLineItems } = instantiationResult;

  const lineItemsForSave = projectLineItems.map((li) => ({
    projectId: input.projectId,
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
    sortOrder: li.sortOrder ?? 0,
  }));

  return saveActivityBundle(projectActivity, lineItemsForSave, input.existingActivityId);
}

export async function updateProjectConstructionActivity(
  input: UpdateProjectActivityInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
  const assigned = assignProjectActivityCode({
    existingActivities: [input.activity],
    divisionCode: input.activity.divisionCode,
    sourceTemplateKey: input.activity.sourceTemplateKey ?? input.activity.templateId ?? '',
    identity: input.identity,
    preserveActivityCode: input.activity.activityCode,
    excludeActivityId: input.activity.id,
  });

  const updatedLineItems = input.lineItems.map((item) => {
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

  const lineItemsForSave = updatedLineItems.map((li) => ({
    projectId: input.activity.projectId,
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
    sortOrder: li.sortOrder ?? 0,
  }));

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
