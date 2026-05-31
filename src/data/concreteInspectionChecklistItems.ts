import type { InspectionItem } from '../types/fieldTools';
import { newRowId } from '../types/fieldTools';

export const PRE_POUR_ITEMS = [
  'Approved drawings reviewed',
  'Forms installed and secure',
  'Form dimensions checked',
  'Subgrade prepared and compacted',
  'Vapor barrier installed if required',
  'Reinforcement installed per drawings',
  'Rebar size and spacing checked',
  'Rebar cover verified',
  'Chairs/supports installed',
  'Embedded items installed',
  'Sleeves and blockouts verified',
  'Anchor bolts installed',
  'Construction joints prepared',
  'Expansion/isolation joints installed',
  'Access for trucks/pump confirmed',
  'Weather conditions reviewed',
  'Curing materials available',
  'Testing agency notified',
  'Ready-mix order confirmed',
] as const;

export const DURING_PLACEMENT_ITEMS = [
  'Truck tickets reviewed',
  'Mix matches approved design',
  'Slump checked',
  'Air content checked if required',
  'Concrete temperature checked',
  'Cylinders made if required',
  'Placement method acceptable',
  'Concrete placed without segregation',
  'Consolidation/vibration performed',
  'Reinforcement not displaced',
  'Forms holding properly',
  'Finish operations started on time',
  'Cold joints avoided',
  'Weather protection used if needed',
] as const;

export const POST_PLACEMENT_ITEMS = [
  'Final finish acceptable',
  'Edges/tool joints completed',
  'Control joints cut or tooled',
  'Curing started promptly',
  'Curing method documented',
  'Protection from rain/sun/wind/cold provided',
  'Forms left in place as required',
  'Defects documented',
  'Photos uploaded',
  'Strength test records linked',
  'Area protected from traffic',
  'Cleanup completed',
] as const;

export function createDefaultInspectionItems(labels: readonly string[]): InspectionItem[] {
  return labels.map((label) => ({
    id: newRowId(),
    label,
    status: null,
    notes: '',
  }));
}

export function createEmptyInspectionChecklistItems() {
  return {
    prePourItems: createDefaultInspectionItems(PRE_POUR_ITEMS),
    duringPlacementItems: createDefaultInspectionItems(DURING_PLACEMENT_ITEMS),
    postPlacementItems: createDefaultInspectionItems(POST_PLACEMENT_ITEMS),
  };
}
