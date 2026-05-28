export type PlacementOrderStatus =
  | 'draft'
  | 'ready_to_call'
  | 'ordered'
  | 'scheduled';

export type BatchPlantContactSource = 'ai' | 'manual';

export interface BatchPlantContact {
  phone: string;
  email: string;
  dispatchContact: string;
  website?: string;
  source: BatchPlantContactSource;
  confidence?: 'high' | 'medium' | 'low';
  lookedUpAt?: string;
  lookupNotes?: string;
}

import type { CallSheetFields } from './callSheet';
import type {
  AccessFactorKey,
  ComplexityLevel,
  CrewEfficiency,
  PlacementMethod,
  WeatherFactorKey,
} from './pourPlanner';
import type { LaborRatesCatalog } from '../data/nationalLaborRates2026';

/** Placement production / labor estimate captured from Placement Planner. */
export interface PlacementProductionSnapshot {
  laborCost: number;
  adjustedLaborHours: number;
  placingLaborHours: number;
  finishingLaborHours: number;
  setupCleanupHours: number;
  estimatedCrewDurationHours: number;
  laborRates: LaborRatesCatalog;
  /** @deprecated Replaced by laborRates — kept when loading older snapshots */
  burdenedHourlyRate?: number;
  volumeYd?: number;
  capturedAt: string;
  crewSize: string;
  finishers: string;
  vibrators: string;
  laborerRateCYHr: string;
  finisherRateSFHr: string;
  placingProductivityCYPerLaborHour: string;
  finishingProductivitySFPerLaborHour: string;
  setupHours: string;
  cleanupHours: string;
  crewEfficiency: CrewEfficiency;
  complexityFactor: ComplexityLevel | 'auto';
  accessFactorMode: 'auto' | AccessFactorKey;
  weatherFactorMode: 'auto' | WeatherFactorKey;
  placementMethod: PlacementMethod;
}

export interface PlacementOrder {
  status: PlacementOrderStatus;
  contact: BatchPlantContact;
  orderNotes: string;
  callSheet?: Partial<CallSheetFields>;
  updatedAt: string;
  pourDateIso?: string;
  batchPlantName?: string;
  batchPlantAddress?: string;
  /** Drive time from batch plant to jobsite (minutes). */
  travelTimeMinutes?: number;
  /** Drive distance from batch plant to jobsite (miles). */
  travelDistanceMi?: number;
  jobsiteAddress?: string;
  /** Snapshot of the call sheet at last save (dashboard-ready). */
  summaryLines?: string[];
  /** Labor cost and production inputs from Placement Planner step 5. */
  production?: PlacementProductionSnapshot;
}

export const PLACEMENT_ORDER_STATUS_LABELS: Record<PlacementOrderStatus, string> = {
  draft: 'Draft — not called yet',
  ready_to_call: 'Ready to call plant',
  ordered: 'Ordered — awaiting confirmation',
  scheduled: 'Scheduled with plant',
};

export const DEFAULT_BATCH_PLANT_CONTACT: BatchPlantContact = {
  phone: '',
  email: '',
  dispatchContact: '',
  source: 'manual',
};

export function defaultPlacementOrder(): PlacementOrder {
  return {
    status: 'draft',
    contact: { ...DEFAULT_BATCH_PLANT_CONTACT },
    orderNotes: '',
    updatedAt: new Date().toISOString(),
  };
}
