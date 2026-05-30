import { MixProfileType } from './curing';
import type { StoredTruckTicketRecord } from './concreteTruckTicket';
import type { USAddress } from './address';
import type { PlacementOrder } from './placementOrder';
import type { LaborEstimate } from './laborEstimate';
import type { ReinforcementPricing } from './laborEstimate';
import type { MixDesignApproval } from './mixDesignApproval';
import type { ProjectClientInfo } from './projectClient';

export type { USAddress } from './address';

export type { StoredTruckTicketRecord } from './concreteTruckTicket';

export type { ProjectClientInfo } from './projectClient';

// User preferences interface
export interface UserPreferences {
  autoSave: boolean;
  notifications: {
    projectUpdates: boolean;
    teamChanges: boolean;
    systemAlerts: boolean;
    emailUpdates: boolean;
    projectReminders: boolean;
    weatherAlerts: boolean;
  };
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  volumeUnit: 'cubic_yards' | 'cubic_feet' | 'cubic_meters';
  measurementSystem: 'imperial' | 'metric';
  currency: 'USD' | 'CAD' | 'EUR' | 'GBP';
  defaultPSI: '2500' | '3000' | '4000' | '5000';
  units: 'imperial' | 'metric';
  lengthUnit: 'feet' | 'meters';
}

// Calculation interface
export interface Calculation {
  id: string;
  type: string;
  dimensions: Record<string, number>;
  result: {
    volume: number;
    bags: number;
    pricing?: {
      concreteCost: number;
      pricePerYard: number;
      deliveryFees: {
        baseDeliveryFee: number;
        smallLoadFee: number;
        distanceFee: number;
        totalDeliveryFees: number;
      };
      additionalServices: {
        pumpTruckFee: number;
        saturdayFee: number;
        afterHoursFee: number;
        totalAdditionalFees: number;
      };
      totalCost: number;
      supplier?: {
        id: string;
        name: string;
        location: string;
      };
    };
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
  /** Set when Mix Design Advisor recommendation is generated for this placement. */
  mixDesignApproval?: MixDesignApproval;
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

export type QCRecordType = 'fresh_test' | 'break_test';

export interface QCRecord {
  id: string;
  projectId: string;
  recordType: QCRecordType;
  date: string;

  // Fresh concrete test fields
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  concreteTemperature?: number;
  slump?: number;
  airContent?: number;
  unitWeight?: number;
  cylindersMade?: number;
  truckNumber?: string;
  ticketNumber?: string;
  batchTime?: string;
  sampleTime?: string;

  // Break test fields
  testAgeDays?: 7 | 14 | 28 | 56;
  cylinderId?: string;
  breakDate?: string;
  designStrengthPsi?: number;
  breakStrengthPsi?: number;
  loadLbs?: number;
  averageStrengthPsi?: number;
  breakResult?: 'pass' | 'fail' | 'informational';

  notes?: string;
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
  pricing?: ReinforcementPricing;
}

// Update Project interface
export interface Project {
  id: string;
  name: string;
  description: string;
  jobsiteAddress?: USAddress;
  clientInfo?: ProjectClientInfo;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  reinforcements?: ReinforcementSet[];
  laborEstimates?: LaborEstimate[];
  wasteFactor?: number;
  pourDate?: string;
  placementOrder?: PlacementOrder;
  mixProfile?: MixProfileType;
  qcRecords?: QCRecord[];
  truckTickets?: StoredTruckTicketRecord[];
  /** Sum of accepted change orders (DB column when synced). */
  approvedChangeOrderTotal?: number;
  baseContractValue?: number;
  currentContractValue?: number;
}