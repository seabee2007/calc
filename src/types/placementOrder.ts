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

export interface PlacementOrder {
  status: PlacementOrderStatus;
  contact: BatchPlantContact;
  orderNotes: string;
  callSheet?: Partial<CallSheetFields>;
  updatedAt: string;
  pourDateIso?: string;
  batchPlantName?: string;
  batchPlantAddress?: string;
  jobsiteAddress?: string;
  /** Snapshot of the call sheet at last save (dashboard-ready). */
  summaryLines?: string[];
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
