import type {
  CompanyLaborRate,
  CompanyLaborRateInput,
  ProjectLaborRate,
  ProjectLaborRateInput,
} from '../domain/laborRateTypes';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { rollupConstructionActivity } from '../domain/constructionActivityCalculations';
import {
  applyLaborRateToLineItem,
  findDefaultProjectLaborRate,
  recalculateActivityLaborCosts,
} from './laborPricingCalculator';
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';
import {
  clearCompanyLaborRateDefaultInDb,
  clearProjectLaborRateDefaultInDb,
  fetchCompanyLaborRatesFromDb,
  fetchProjectActivitiesUsingLaborRole,
  fetchProjectLaborRatesFromDb,
  insertProjectLaborRatesInDb,
  replaceProjectLineItemsInDb,
  seedStarterCompanyLaborRatesInDb,
  softDeleteCompanyLaborRateInDb,
  upsertCompanyLaborRateInDb,
  upsertProjectLaborRateInDb,
} from '../infrastructure/laborRateRepository';
import { mapProjectLineItemToInsert } from '../infrastructure/activityMappers';
import { fetchProjectLineItems, updateProjectActivity } from '../infrastructure/activityRepository';

export async function fetchCompanyLaborRates(userId: string): Promise<RepositoryResult<CompanyLaborRate[]>> {
  return fetchCompanyLaborRatesFromDb(userId);
}

export async function upsertCompanyLaborRate(
  input: CompanyLaborRateInput,
): Promise<RepositoryResult<CompanyLaborRate>> {
  if (input.isDefault) {
    await clearCompanyLaborRateDefaultInDb(input.userId, input.id);
  }
  return upsertCompanyLaborRateInDb(input);
}

export async function deleteCompanyLaborRate(
  id: string,
  userId: string,
): Promise<RepositoryResult<CompanyLaborRate>> {
  return softDeleteCompanyLaborRateInDb(id, userId);
}

export async function seedStarterLaborRates(userId: string): Promise<RepositoryResult<CompanyLaborRate[]>> {
  return seedStarterCompanyLaborRatesInDb(userId);
}

export async function fetchProjectLaborRates(projectId: string): Promise<RepositoryResult<ProjectLaborRate[]>> {
  return fetchProjectLaborRatesFromDb(projectId);
}

export async function copyCompanyRatesToProject(
  projectId: string,
  companyRates: CompanyLaborRate[],
): Promise<RepositoryResult<ProjectLaborRate[]>> {
  const existing = await fetchProjectLaborRatesFromDb(projectId, false);
  if (existing.error) return { data: null, error: existing.error };
  if (existing.data && existing.data.length > 0) {
    return { data: existing.data, error: null };
  }

  const inputs: ProjectLaborRateInput[] = companyRates
    .filter((rate) => rate.isActive)
    .map((rate) => ({
      projectId,
      companyLaborRateId: rate.id,
      roleKey: rate.roleKey,
      roleName: rate.roleName,
      tradeCategory: rate.tradeCategory,
      hourlyRate: rate.hourlyRate,
      burdenPercent: rate.burdenPercent,
      billingRate: rate.billingRate,
      description: rate.description,
      isActive: true,
      isDefault: rate.isDefault,
      isOverride: false,
    }));

  return insertProjectLaborRatesInDb(inputs);
}

export async function upsertProjectLaborRate(
  input: ProjectLaborRateInput,
): Promise<RepositoryResult<ProjectLaborRate>> {
  if (input.isDefault) {
    await clearProjectLaborRateDefaultInDb(input.projectId, input.id);
  }
  return upsertProjectLaborRateInDb(input);
}

export async function resetProjectLaborRateToCompany(
  projectRate: ProjectLaborRate,
  companyRate: CompanyLaborRate,
): Promise<RepositoryResult<ProjectLaborRate>> {
  return upsertProjectLaborRateInDb({
    id: projectRate.id,
    projectId: projectRate.projectId,
    companyLaborRateId: companyRate.id,
    roleKey: companyRate.roleKey,
    roleName: companyRate.roleName,
    tradeCategory: companyRate.tradeCategory,
    hourlyRate: companyRate.hourlyRate,
    burdenPercent: companyRate.burdenPercent,
    billingRate: companyRate.billingRate,
    description: companyRate.description,
    isActive: companyRate.isActive,
    isDefault: companyRate.isDefault,
    isOverride: false,
  });
}

export function applyDefaultLaborRateToLineItems(
  lineItems: ProjectActivityLineItem[],
  rates: readonly ProjectLaborRate[],
): ProjectActivityLineItem[] {
  const defaultRate = findDefaultProjectLaborRate(rates);
  if (!defaultRate) return lineItems;
  return lineItems.map((item) => applyLaborRateToLineItem(item, defaultRate));
}

export interface RecalculateLaborCostsInput {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  rate: ProjectLaborRate;
  lineItemIds?: Set<string>;
}

export async function recalculateAndSaveActivityLaborCosts(
  input: RecalculateLaborCostsInput,
): Promise<RepositoryResult<null>> {
  const updatedLineItems = recalculateActivityLaborCosts(
    input.lineItems,
    input.rate,
    input.lineItemIds,
  );
  const rollup = rollupConstructionActivity(input.activity, updatedLineItems);

  const activityUpdate = await updateProjectActivity(input.activity.id, {
    totalLaborCost: rollup.totalLaborCost,
    totalCost: rollup.totalDirectCost,
    calculatedManHours: rollup.totalManHours,
    calculatedManDays: rollup.totalManDays,
    calculatedDurationDays: rollup.calculatedDurationDays,
    effectiveDurationDays: rollup.effectiveDurationDays,
  });

  if (activityUpdate.error) {
    return { data: null, error: activityUpdate.error };
  }

  const rows = updatedLineItems.map((item) => ({
    ...mapProjectLineItemToInsert(item),
    project_activity_id: input.activity.id,
    project_id: input.activity.projectId,
  }));

  return replaceProjectLineItemsInDb(input.activity.id, rows);
}

export async function findAffectedActivitiesForRole(
  projectId: string,
  roleKey: string,
): Promise<RepositoryResult<Array<{ activityId: string; lineItemId: string; activityTitle: string }>>> {
  return fetchProjectActivitiesUsingLaborRole(projectId, roleKey);
}

export async function loadLineItemsForRecalculation(
  activityId: string,
): Promise<RepositoryResult<ProjectActivityLineItem[]>> {
  return fetchProjectLineItems(activityId);
}
