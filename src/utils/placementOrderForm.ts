import type { PourPlannerFormState } from '../types/pourPlanner';
import type {
  PlacementOrder,
  BatchPlantContact,
  PlacementProductionSnapshot,
} from '../types/placementOrder';
import { DEFAULT_BATCH_PLANT_CONTACT } from '../types/placementOrder';
import { applyCallSheetToForm, callSheetFieldsFromForm } from './callSheetForm';
import type { PlacementRateEstimate } from './placementProduction';
import { LABOR_RATES_2026 } from '../data/nationalLaborRates2026';

const PRODUCTION_FORM_KEYS = [
  'crewSize',
  'finishers',
  'vibrators',
  'laborerRateCYHr',
  'finisherRateSFHr',
  'placingProductivityCYPerLaborHour',
  'finishingProductivitySFPerLaborHour',
  'setupHours',
  'cleanupHours',
  'crewEfficiency',
  'complexityFactor',
  'accessFactorMode',
  'weatherFactorMode',
  'placementMethod',
] as const satisfies readonly (keyof PourPlannerFormState)[];

export function buildProductionSnapshot(
  form: PourPlannerFormState,
  estimate: PlacementRateEstimate,
  volumeYd: number,
): PlacementProductionSnapshot | undefined {
  if (estimate.laborCost == null || estimate.laborCost <= 0) return undefined;

  return {
    laborCost: estimate.laborCost,
    adjustedLaborHours: estimate.adjustedLaborHours,
    placingLaborHours: estimate.placingLaborHours,
    finishingLaborHours: estimate.finishingLaborHours,
    setupCleanupHours: estimate.setupCleanupHours,
    estimatedCrewDurationHours: estimate.estimatedCrewDurationHours,
    laborRates: LABOR_RATES_2026.laborRates,
    volumeYd: volumeYd > 0 ? volumeYd : undefined,
    capturedAt: new Date().toISOString(),
    crewSize: form.crewSize,
    finishers: form.finishers,
    vibrators: form.vibrators,
    laborerRateCYHr: form.laborerRateCYHr,
    finisherRateSFHr: form.finisherRateSFHr,
    placingProductivityCYPerLaborHour: form.placingProductivityCYPerLaborHour,
    finishingProductivitySFPerLaborHour: form.finishingProductivitySFPerLaborHour,
    setupHours: form.setupHours,
    cleanupHours: form.cleanupHours,
    crewEfficiency: form.crewEfficiency,
    complexityFactor: form.complexityFactor,
    accessFactorMode: form.accessFactorMode,
    weatherFactorMode: form.weatherFactorMode,
    placementMethod: form.placementMethod,
  };
}

function applyProductionSnapshotToForm(
  production: PlacementProductionSnapshot | undefined,
): Partial<PourPlannerFormState> {
  if (!production) return {};
  const patch: Partial<PourPlannerFormState> = {};
  for (const key of PRODUCTION_FORM_KEYS) {
    const value = production[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  return patch;
}

/**
 * Planner saves call sheet / plant contact only — dispatch status & notes are set on the project card.
 */
export function applyPlannerPlacementOrderDispatchFields(
  order: PlacementOrder,
  existing?: PlacementOrder,
): PlacementOrder {
  return {
    ...order,
    status: existing?.status ?? 'draft',
    orderNotes: existing?.orderNotes ?? order.orderNotes,
  };
}

export function placementOrderFromForm(
  form: PourPlannerFormState,
  options?: {
    productionEstimate?: PlacementRateEstimate;
    volumeYd?: number;
    /** Keep prior labor snapshot when the current estimate has no labor cost. */
    preserveProduction?: PlacementProductionSnapshot;
  },
): PlacementOrder {
  const contact: BatchPlantContact = {
    phone: form.batchPlantPhone.trim(),
    email: form.batchPlantEmail.trim(),
    dispatchContact: form.batchPlantDispatchContact.trim(),
    website: form.batchPlantWebsite.trim() || undefined,
    source: form.batchPlantContactSource === 'ai' ? 'ai' : 'manual',
  };

  const production =
    (options?.productionEstimate != null
      ? buildProductionSnapshot(
          form,
          options.productionEstimate,
          options.volumeYd ?? 0,
        )
      : undefined) ?? options?.preserveProduction;

  return {
    status: form.orderStatus || 'draft',
    contact,
    orderNotes: form.orderNotes.trim(),
    updatedAt: new Date().toISOString(),
    batchPlantName: form.batchPlantName.trim() || undefined,
    batchPlantAddress: form.batchPlantAddress.trim() || undefined,
    travelTimeMinutes: (() => {
      const n = parseFloat(form.travelTimeMinutes);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    })(),
    travelDistanceMi: (() => {
      const n = parseFloat(form.travelDistance);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    callSheet: callSheetFieldsFromForm(form),
    ...(production ? { production } : {}),
  };
}

export function applyPlacementOrderToForm(
  order: PlacementOrder | undefined,
): Partial<PourPlannerFormState> {
  if (!order) return {};
  const c = order.contact ?? DEFAULT_BATCH_PLANT_CONTACT;
  return {
    batchPlantName: order.batchPlantName ?? '',
    batchPlantAddress: order.batchPlantAddress ?? '',
    travelTimeMinutes:
      order.travelTimeMinutes != null && order.travelTimeMinutes > 0
        ? String(Math.round(order.travelTimeMinutes))
        : '',
    travelDistance:
      order.travelDistanceMi != null && order.travelDistanceMi > 0
        ? String(order.travelDistanceMi)
        : '',
    batchPlantPhone: c.phone ?? '',
    batchPlantEmail: c.email ?? '',
    batchPlantDispatchContact: c.dispatchContact ?? '',
    batchPlantWebsite: c.website ?? '',
    batchPlantContactSource: c.source === 'ai' ? 'ai' : '',
    orderStatus: order.status ?? '',
    orderNotes: order.orderNotes ?? '',
    ...applyCallSheetToForm(order.callSheet),
    ...applyProductionSnapshotToForm(order.production),
  };
}
