/**
 * Construction activity service.
 *
 * High-level operations combining the assembly instantiation layer with
 * the NTRP repository. This is the primary entry point for UI actions.
 *
 * Guardrails:
 *   - Does not touch calculateCpm.ts or autoLayoutLogicNetwork.ts.
 *   - Does not modify the live estimator EstimateDomainTask model.
 *   - Never stores ActivityLineItems as schedule activities.
 */
import type { ActivityAssemblySpec, AssemblyUserInputs } from '../domain/activityAssemblyTypes';
import type { ActivityLineItemTemplate, EstimateDivision, ProductionRate } from '../domain/constructionActivityTypes';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import {
  saveActivityBundle,
  fetchProjectActivities,
  fetchProjectLineItems,
  deleteProjectActivity,
  type SavedActivityBundle,
} from '../infrastructure/activityRepository';
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';
import type { ProjectConstructionActivity, ProjectActivityLineItem } from '../domain/constructionActivityTypes';

// ---------------------------------------------------------------------------
// Primary: instantiate an assembly and save to the database
// ---------------------------------------------------------------------------

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
  activityTitleOverride?: string;
  /** Provide to update an existing activity; omit to insert. */
  existingActivityId?: string;
}

/**
 * Instantiate an assembly from user inputs, calculate rollups, and persist to
 * project_construction_activities + project_activity_line_items.
 */
export async function instantiateAndSaveActivity(
  input: InstantiateAndSaveInput,
): Promise<RepositoryResult<SavedActivityBundle>> {
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
    activityTitleOverride: input.activityTitleOverride,
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

  return saveActivityBundle(
    projectActivity,
    lineItemsForSave,
    input.existingActivityId,
  );
}

// ---------------------------------------------------------------------------
// Load: activities for a project/estimate with their line items
// ---------------------------------------------------------------------------

export interface LoadedProjectActivity {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
}

/**
 * Load all construction activities for a project, each with their line items.
 * Line items are fetched in parallel.
 */
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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a project construction activity and all its line items (CASCADE).
 */
export async function removeProjectActivity(id: string): Promise<RepositoryResult<null>> {
  return deleteProjectActivity(id);
}

// ---------------------------------------------------------------------------
// Schedule-enabled filter (used by Schedule Engine adapter in M5)
// ---------------------------------------------------------------------------

/**
 * Filter a list of project activities to those eligible for Logic Network cards.
 * Line items are never included — only schedule-enabled ProjectConstructionActivities.
 */
export function filterScheduleEligibleActivities(
  activities: ProjectConstructionActivity[],
): ProjectConstructionActivity[] {
  return activities.filter((a) => a.scheduleEnabled === true);
}
