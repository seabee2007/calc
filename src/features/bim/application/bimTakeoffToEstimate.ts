import {
  instantiateAndSaveFromProductionRateAssembly,
  type SaveFromProductionRateAssemblyInput,
} from '../../estimating/application/constructionActivityService';
import type { ActivityInstanceIdentityInput } from '../../estimating/application/constructionActivityCoding';
import type { ProductionRateAssemblyGroup } from '../../estimating/application/productionRateAssemblyBuilder';
import type { ProjectConstructionActivity } from '../../estimating/domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../../estimating/domain/laborRateTypes';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import type { SavedActivityBundle } from '../../estimating/infrastructure/activityRepository';
import type { BimTakeoffType, TakeoffConfidence, TakeoffSource } from '../types';
import { createTakeoffItem, updateObjectTakeoffStatus } from '../services/bimModelService';

export interface AddBimTakeoffToEstimateInput {
  projectId: string;
  estimateId: string;
  modelId: string;
  /** Persisted bim_model_objects.id when available. */
  bimObjectId?: string | null;
  group: ProductionRateAssemblyGroup;
  selectedLineItems: SaveFromProductionRateAssemblyInput['selectedLineItems'];
  quantity: number;
  unit: string;
  takeoffName?: string | null;
  takeoffType?: BimTakeoffType | null;
  source: TakeoffSource;
  confidence: TakeoffConfidence;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  identity: ActivityInstanceIdentityInput;
  existingActivities: readonly ProjectConstructionActivity[];
  projectLaborRates: readonly ProjectLaborRate[];
}

export interface AddBimTakeoffToEstimateResult {
  bundle: SavedActivityBundle;
  takeoffItemId: string;
  estimateLineId: string;
}

/**
 * Creates a construction activity from a production-rate assembly, then links
 * the BIM object to the resulting estimate line via bim_takeoff_items.
 */
export async function addBimTakeoffToEstimate(
  input: AddBimTakeoffToEstimateInput,
): Promise<RepositoryResult<AddBimTakeoffToEstimateResult>> {
  const saveResult = await instantiateAndSaveFromProductionRateAssembly({
    group: input.group,
    selectedLineItems: input.selectedLineItems,
    projectId: input.projectId,
    estimateId: input.estimateId,
    identity: input.identity,
    existingActivities: input.existingActivities,
    projectLaborRates: input.projectLaborRates,
    scheduleEnabled: true,
  });

  if (saveResult.error || !saveResult.data) {
    return { data: null, error: saveResult.error ?? 'Could not add activity to estimate.' };
  }

  const bundle = saveResult.data;
  const primaryLineItem = bundle.lineItems[0];
  if (!primaryLineItem) {
    return { data: null, error: 'Activity saved without line items.' };
  }

  const takeoffResult = await createTakeoffItem({
    projectId: input.projectId,
    estimateId: input.estimateId,
    modelId: input.modelId,
    objectId: input.bimObjectId ?? null,
    divisionCode: bundle.activity.divisionCode,
    activityCode: bundle.activity.activityCode,
    estimateLineId: primaryLineItem.id,
    quantity: input.quantity,
    unit: input.unit,
    source: input.source,
    confidence: input.confidence,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });

  if (takeoffResult.error || !takeoffResult.data) {
    return { data: null, error: takeoffResult.error ?? 'Could not save BIM takeoff item.' };
  }

  if (input.bimObjectId) {
    await updateObjectTakeoffStatus(input.bimObjectId, 'mapped', {
      takeoffName: input.takeoffName ?? null,
      takeoffType: input.takeoffType ?? null,
    });
  }

  return {
    data: {
      bundle,
      takeoffItemId: takeoffResult.data.id,
      estimateLineId: primaryLineItem.id,
    },
    error: null,
  };
}
