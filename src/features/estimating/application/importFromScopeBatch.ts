import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import { loadCanonicalProductionRateLibrary } from '../data/productionRates/productionRateLibraryLoader';
import { getCsiDivisionByCode } from '../domain/csiDivisions';
import { resolveScopeActivityDivisionCode } from './scopeActivityDivisionClassifier';
import {
  buildScopeImportSourceTemplateKey,
  buildImportActivityKey,
} from './importFromScopeDuplicateUtils';
import {
  instantiateAndSaveFromProductionRateAssembly,
  instantiateAndSaveManualActivity,
  type SaveManualActivityInput,
} from './constructionActivityService';
import { buildAssemblyGroupForRate } from './productionRateAssemblyBuilder';

export type BatchImportItemStatus = 'created' | 'skippedDuplicate' | 'failed';

export interface BatchImportScopeActivityInput {
  divisionCode: string;
  divisionName: string;
  activityTitle: string;
  instanceLabel?: string | null;
  location?: string | null;
  drawingReference?: string | null;
  suggestedQuantity?: number | null;
  /** Approved library rate id — when set, creates production-rate-backed line items. */
  selectedProductionRateId?: string | null;
}

export interface BatchImportScopeActivityResult {
  status: BatchImportItemStatus;
  divisionCode: string;
  activityTitle: string;
  error?: string;
  activityId?: string;
  pricedWithProductionRate?: boolean;
}

export interface BatchImportScopeSummary {
  created: number;
  skippedDuplicate: number;
  failed: number;
  results: BatchImportScopeActivityResult[];
}

export function summarizeBatchImportResults(
  results: readonly BatchImportScopeActivityResult[],
): BatchImportScopeSummary {
  return {
    created: results.filter((result) => result.status === 'created').length,
    skippedDuplicate: results.filter((result) => result.status === 'skippedDuplicate').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results: [...results],
  };
}

export async function batchImportActivitiesFromScope(input: {
  projectId: string;
  estimateId?: string;
  projectLaborRates: readonly ProjectLaborRate[];
  items: readonly BatchImportScopeActivityInput[];
  existingActivities?: readonly ProjectConstructionActivity[];
  productionRates?: readonly ProductionRateLibraryEntry[];
}): Promise<BatchImportScopeSummary> {
  const productionRates =
    input.productionRates ?? (await loadCanonicalProductionRateLibrary()).rates;
  const rateById = new Map(productionRates.map((rate) => [rate.id, rate]));

  const workingActivities = [...(input.existingActivities ?? [])];
  const reservedKeys = new Set<string>(
    workingActivities.map((activity) =>
      buildImportActivityKey(activity.divisionCode, activity.baseTitle ?? activity.title, activity.instanceLabel),
    ),
  );

  const results: BatchImportScopeActivityResult[] = [];

  for (const item of input.items) {
    const divisionCode = resolveScopeActivityDivisionCode(item.activityTitle, item.divisionCode);
    const division = getCsiDivisionByCode(divisionCode);
    const divisionName = division?.name ?? item.divisionName;

    const importKey = buildImportActivityKey(
      divisionCode,
      item.activityTitle,
      item.instanceLabel,
    );

    if (reservedKeys.has(importKey)) {
      results.push({
        status: 'skippedDuplicate',
        divisionCode,
        activityTitle: item.activityTitle,
        error: 'Already exists in this import batch or estimate.',
      });
      continue;
    }

    const matchedRate = item.selectedProductionRateId
      ? rateById.get(item.selectedProductionRateId) ?? null
      : null;

    const identity = {
      activityName: item.activityTitle,
      instanceLabel: item.instanceLabel ?? null,
      location: item.location ?? null,
      drawingReference: item.drawingReference ?? null,
    };

    const scopeSourceTemplateKey = buildScopeImportSourceTemplateKey(divisionCode, item.activityTitle);
    const quantity =
      item.suggestedQuantity && item.suggestedQuantity > 0 ? item.suggestedQuantity : 0;

    const saveResult = matchedRate
      ? await instantiateAndSaveFromProductionRateAssembly({
          projectId: input.projectId,
          estimateId: input.estimateId,
          group: buildAssemblyGroupForRate(matchedRate),
          selectedLineItems: [
            {
              rateId: matchedRate.id,
              quantity,
            },
          ],
          identity,
          scheduleEnabled: true,
          existingActivities: workingActivities,
          projectLaborRates: input.projectLaborRates,
          sourceTemplateKey: scopeSourceTemplateKey,
        })
      : await instantiateAndSaveManualActivity({
          projectId: input.projectId,
          estimateId: input.estimateId,
          divisionCode,
          divisionName,
          lineItems: [
            {
              description: item.activityTitle,
              unit: 'LS',
              quantity,
              manHoursPerUnit: 0,
            },
          ],
          identity,
          scheduleEnabled: true,
          existingActivities: workingActivities,
          projectLaborRates: input.projectLaborRates,
          sourceTemplateKey: scopeSourceTemplateKey,
        } satisfies SaveManualActivityInput);

    if (saveResult.error || !saveResult.data) {
      const message = saveResult.error ?? 'Save failed';
      if (/already exists/i.test(message)) {
        results.push({
          status: 'skippedDuplicate',
          divisionCode,
          activityTitle: item.activityTitle,
          error: message,
        });
      } else {
        results.push({
          status: 'failed',
          divisionCode,
          activityTitle: item.activityTitle,
          error: message,
        });
      }
      continue;
    }

    const savedActivity = saveResult.data.activity;
    if (!savedActivity?.id) {
      results.push({
        status: 'failed',
        divisionCode,
        activityTitle: item.activityTitle,
        error: 'Save succeeded but activity payload was missing.',
      });
      continue;
    }

    workingActivities.push(savedActivity);
    reservedKeys.add(importKey);
    results.push({
      status: 'created',
      divisionCode,
      activityTitle: item.activityTitle,
      activityId: savedActivity.id,
      pricedWithProductionRate: Boolean(matchedRate),
    });
  }

  return summarizeBatchImportResults(results);
}

/** @deprecated Use batchImportActivitiesFromScope */
export const batchImportManualActivitiesFromScope = batchImportActivitiesFromScope;
