import { MixProfileType } from './curing';

// User preferences interface
export interface UserPreferences {
  units: 'imperial' | 'metric';
  lengthUnit: 'feet' | 'meters';
  volumeUnit: 'cubic_yards' | 'cubic_meters';
}

// Calculation interface
export interface Calculation {
  id: string;
  type: string;
  dimensions: Record<string, number>;
  result: {
    volume: number;
    bags: number;
  };
  weather?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
  };
  // Add new fields for enhanced display
  psi?: string;
  mixProfile?: MixProfileType;
  quikreteProduct?: {
    type: string;
    weight: number;
    yield: number;
  };
  createdAt: string;
}

// Add QC Record types
export interface QCChecklist {
  // Reinforcement
  rebarSpacingActual: number;  // in inches or mm
  rebarSpacingTolerance: number;  // ± tolerance
  rebarSpacingPass: boolean;

  // Formwork
  formPressureTestPass: boolean;
  formAlignmentPass: boolean;
  formCoverActual: number;      // measured cover (inches / mm)
  formCoverSpec: number;        // required cover
  formCoverPass: boolean;

  // Subgrade & Utilities
  subgradePrepElectrical: boolean;
  elevationConduitInstalled: boolean;  // stub-ups in place
  dimensionSleevesOK: boolean;         // foundation sleeves
  compactionPullCordsOK: boolean;
  capillaryBarrierInstalled: boolean;  // sand barrier
  vaporBarrierOK: boolean;             // sub-slab vapor barrier
  miscInsectDrainRackOK: boolean;
  subslabPipingInstalled: boolean;

  // Embedded Items
  floorDrainsOK: boolean;
  floorDrainsElevation: string;        // e.g. "+2″ from datum"
  floorCleanoutsOK: boolean;
  floorCleanoutsElevation: string;
  stubupsAlignmentOK: boolean;
  stubupsType: string;

  // Bracing & Equipment
  bracingOK: boolean;
  screedBoardsSet: boolean;
  screedBoardsChecked: boolean;
  waterStopPlaced: boolean;
  placingToolsSet: boolean;
  placingToolsChecked: boolean;
  finishingToolsSet: boolean;
  finishingToolsChecked: boolean;
  curingMaterialsAvailable: boolean;
}

export interface QCRecord {
  id: string;
  projectId: string;
  date: string;
  temperature: number;
  humidity: number;
  slump: number;
  airContent: number;
  cylindersMade: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  checklist?: QCChecklist;
}

// Add Reinforcement types
export interface CutListItem {
  id?: string;
  lengthFt: number;
  qty: number;
  direction?: 'X' | 'Y';
  barSize?: string;
}

export interface ReinforcementSet {
  id: string;
  projectId?: string;
  projectName: string;
  length_ft: number;
  width_ft: number;
  thickness_in: number;
  height_ft?: number;
  cover_in: number;
  reinforcement_type: 'rebar' | 'mesh' | 'fiber';
  
  // Rebar specific
  bar_size?: string;
  spacing_x_in?: number;
  spacing_y_in?: number;
  total_bars_x?: number;
  total_bars_y?: number;
  total_bars?: number;
  total_linear_ft?: number;
  
  // Cut list data
  cut_list_items?: CutListItem[];
  
  // Column specific
  vertical_bars?: number;
  tie_spacing?: number;
  
  // Fiber specific
  fiber_dose?: number;
  fiber_total_lb?: number;
  fiber_bags?: number;
  fiber_type?: string;
  
  // Mesh specific
  mesh_sheets?: number;
  mesh_sheet_size?: string;
  
  createdAt: string;
  updatedAt: string;
}

// Update Project interface
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  reinforcements?: ReinforcementSet[];  // Add reinforcement sets
  wasteFactor?: number;
  pourDate?: string;
  mixProfile?: MixProfileType;
  qcRecords?: QCRecord[];
}