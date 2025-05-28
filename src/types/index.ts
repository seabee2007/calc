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

// Update Project interface
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  wasteFactor?: number;
  pourDate?: string;
  mixProfile?: MixProfileType;
  qcRecords?: QCRecord[];
}