/** Placement element for dispatch call sheets */
export type PlacementAreaType =
  | ''
  | 'footing'
  | 'slab'
  | 'wall'
  | 'column'
  | 'pavement';

export const PLACEMENT_AREA_OPTIONS: { value: PlacementAreaType; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'footing', label: 'Footing' },
  { value: 'slab', label: 'Slab' },
  { value: 'wall', label: 'Wall' },
  { value: 'column', label: 'Column' },
  { value: 'pavement', label: 'Pavement' },
];

/** Call-sheet-only fields (persisted on placement_order.callSheet) */
export interface CallSheetFields {
  projectNumber: string;
  contractor: string;
  superintendent: string;
  pointOfContact: string;
  pointOfContactPhone: string;
  placementAreaType: PlacementAreaType;
  specificPlacementArea: string;
  accessInstructions: string;
  gateCodesEscorts: string;
  washoutLocation: string;
  mixDesignNumber: string;
  waterCementRatio: string;
  colorAdditive: string;
  superplasticizer: boolean;
  accelerator: boolean;
  pumpCompany: string;
  qcThirdPartyTesting: boolean;
  qcSlumpTestsRequired: boolean;
  qcCylindersRequired: boolean;
  qcBreak7Day: boolean;
  qcBreak28Day: boolean;
  qcAciNavfac: string;
  qcSpecialInspection: boolean;
  safetyPpe: boolean;
  safetyTrafficControl: boolean;
  safetySpotter: boolean;
  safetyPowerlines: boolean;
  safetyLimitedAccess: boolean;
  safetyCraneNearby: boolean;
  safetyUnevenTerrain: boolean;
  callBeforeFirstTruck: string;
}

export const DEFAULT_CALL_SHEET_FIELDS: CallSheetFields = {
  projectNumber: '',
  contractor: '',
  superintendent: '',
  pointOfContact: '',
  pointOfContactPhone: '',
  placementAreaType: '',
  specificPlacementArea: '',
  accessInstructions: '',
  gateCodesEscorts: '',
  washoutLocation: '',
  mixDesignNumber: '',
  waterCementRatio: '',
  colorAdditive: '',
  superplasticizer: false,
  accelerator: false,
  pumpCompany: '',
  qcThirdPartyTesting: false,
  qcSlumpTestsRequired: false,
  qcCylindersRequired: false,
  qcBreak7Day: false,
  qcBreak28Day: false,
  qcAciNavfac: '',
  qcSpecialInspection: false,
  safetyPpe: false,
  safetyTrafficControl: false,
  safetySpotter: false,
  safetyPowerlines: false,
  safetyLimitedAccess: false,
  safetyCraneNearby: false,
  safetyUnevenTerrain: false,
  callBeforeFirstTruck: '30',
};

/** Map concrete calculator type → call sheet placement area */
export function placementAreaFromCalculationType(calcType: string): PlacementAreaType {
  switch (calcType) {
    case 'footer':
      return 'footing';
    case 'slab':
    case 'thickened_edge_slab':
      return 'slab';
    case 'column':
      return 'column';
    case 'sidewalk':
      return 'pavement';
    default:
      return '';
  }
}
