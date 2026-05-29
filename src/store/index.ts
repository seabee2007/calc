import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  getCompanySettings,
  updateCompanySettings as updateSupabaseSettings,
  migrateFromLocalStorage,
  getUserPreferences,
  updateUserPreferences,
  migratePreferencesFromLocalStorage
} from '../services/companySettingsService';
import {
  Project,
  UserPreferences,
  Calculation,
  QCRecord,
  QCChecklist,
  ReinforcementSet,
  USAddress,
} from '../types';
import type { LaborEstimate, LaborEstimateInputs } from '../types/laborEstimate';
import { EMPTY_US_ADDRESS } from '../types/address';
import { MixProfileType } from '../types/curing';
import type { TruckTicketFormState } from '../types/concreteTruckTicket';
import type { PlacementOrder } from '../types/placementOrder';
import { defaultPlacementOrder } from '../types/placementOrder';
import {
  mapTruckTicketFromDb,
  mergeTruckTicketsForProject,
} from '../utils/truckTicketDb';
import { isTruckTicketRecord } from '../utils/concreteTruckTicket';
import {
  buildQcInsertRow,
  buildQcUpdateRow,
  buildRecordDataPayload,
  isQcRecordTypeColumnError,
  mapQcRecordFieldsFromDb,
} from '../utils/qcRecordDb';
import {
  clientInfoToDbPayload,
  parseClientInfoFromDb,
} from '../types/projectClient';

const PROJECT_SELECT = `
  id, name, description, client_info,
  jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile, placement_order,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*)),
  labor_estimates(*)
`;

const PROJECT_SELECT_NO_CLIENT_INFO = `
  id, name, description,
  jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile, placement_order,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*)),
  labor_estimates(*)
`;

const PROJECT_SELECT_NO_LABOR_ESTIMATES = `
  id, name, description, client_info,
  jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile, placement_order,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*))
`;

const PROJECT_SELECT_NO_LABOR_ESTIMATES_NO_CLIENT = `
  id, name, description,
  jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile, placement_order,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*))
`;

const PROJECT_SELECT_NO_PLACEMENT_ORDER = `
  id, name, description, client_info,
  jobsite_street, jobsite_street2, jobsite_city, jobsite_state, jobsite_zip,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*))
`;

const PROJECT_SELECT_NO_JOBSITE = `
  id, name, description, client_info,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  truck_tickets(*),
  reinforcement_sets(*, cut_list_items(*))
`;

const PROJECT_SELECT_LEGACY = `
  id, name, description, client_info,
  waste_factor, created_at, updated_at,
  pour_date, mix_profile,
  calculations(*),
  qc_records(*, qc_checklists(*)),
  reinforcement_sets(*, cut_list_items(*))
`;

/** null = unknown, false = migration not applied yet */
let projectJobsiteColumnsAvailable: boolean | null = null;

function isClientInfoColumnError(message: string): boolean {
  return message.includes('client_info');
}

function isJobsiteColumnError(message: string): boolean {
  return (
    message.includes('jobsite_street') ||
    message.includes('jobsite_city') ||
    message.includes('jobsite_state') ||
    message.includes('jobsite_zip')
  );
}

function isTruckTicketsSchemaError(message: string): boolean {
  return message.includes('truck_tickets') || message.includes('schema cache');
}

function isPlacementOrderColumnError(message: string): boolean {
  return message.includes('placement_order');
}

function isLaborEstimatesSchemaError(message: string): boolean {
  return message.includes('labor_estimates');
}

function shouldFallbackLaborToPlacementOrder(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = (error.message ?? '').toLowerCase();
  if (isLaborEstimatesSchemaError(msg)) return true;
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return true;
  }
  if (error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST205') {
    return true;
  }
  return false;
}

/** User-facing message when labor save fails (after any fallback attempt). */
export function laborSaveErrorMessage(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : err instanceof Error
        ? err.message
        : String(err);
  if (isLaborEstimatesSchemaError(msg)) {
    return 'Labor table missing — run Supabase migration 20250526120000_labor_estimates_reinforcement_pricing.sql';
  }
  if (msg.toLowerCase().includes('row-level security')) {
    return 'Labor table blocked by RLS — run migration 20250526120100_labor_estimates_rls.sql in Supabase SQL editor';
  }
  return msg || 'Could not save labor estimate';
}

function parsePlacementOrder(raw: unknown): PlacementOrder | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as PlacementOrder;
  if (!o.status || !o.contact) return undefined;
  return o;
}

async function fetchProjectRows() {
  const selects = [
    PROJECT_SELECT,
    PROJECT_SELECT_NO_CLIENT_INFO,
    PROJECT_SELECT_NO_LABOR_ESTIMATES,
    PROJECT_SELECT_NO_LABOR_ESTIMATES_NO_CLIENT,
    PROJECT_SELECT_NO_PLACEMENT_ORDER,
    PROJECT_SELECT_NO_JOBSITE,
    PROJECT_SELECT_LEGACY,
  ];

  for (let i = 0; i < selects.length; i++) {
    const result = await supabase
      .from('projects')
      .select(selects[i])
      .order('created_at', { ascending: false });

    if (!result.error) {
      if (selects[i] === PROJECT_SELECT) {
        projectJobsiteColumnsAvailable = true;
      } else if (selects[i] === PROJECT_SELECT_NO_JOBSITE) {
        projectJobsiteColumnsAvailable = false;
        console.warn(
          'Project jobsite address columns missing — run Supabase migration 20250525130000_project_jobsite_address.sql',
        );
      } else if (selects[i] === PROJECT_SELECT_NO_PLACEMENT_ORDER) {
        console.warn(
          'Project placement_order column missing — run migration 20250525140000_project_placement_order.sql',
        );
      } else if (
        selects[i] === PROJECT_SELECT_NO_CLIENT_INFO ||
        selects[i] === PROJECT_SELECT_NO_LABOR_ESTIMATES_NO_CLIENT
      ) {
        console.warn(
          'Project client_info column missing — run migration 20260530120000_project_client_info.sql',
        );
      }
      return result;
    }

    const msg = result.error.message ?? '';
    if (
      isJobsiteColumnError(msg) ||
      isClientInfoColumnError(msg) ||
      isTruckTicketsSchemaError(msg) ||
      isPlacementOrderColumnError(msg) ||
      isLaborEstimatesSchemaError(msg)
    ) {
      if (isLaborEstimatesSchemaError(msg)) {
        console.warn(
          'labor_estimates table missing — run migration 20250526120000_labor_estimates_reinforcement_pricing.sql',
        );
      }
      continue;
    }
    return result;
  }

  return supabase
    .from('projects')
    .select(PROJECT_SELECT_LEGACY)
    .order('created_at', { ascending: false });
}

function selectAfterProjectWrite(): string {
  if (projectJobsiteColumnsAvailable === false) {
    return PROJECT_SELECT_NO_JOBSITE;
  }
  return PROJECT_SELECT;
}

async function fetchProjectById(projectId: string) {
  const selects = [
    PROJECT_SELECT,
    PROJECT_SELECT_NO_CLIENT_INFO,
    PROJECT_SELECT_NO_LABOR_ESTIMATES,
    PROJECT_SELECT_NO_LABOR_ESTIMATES_NO_CLIENT,
    PROJECT_SELECT_NO_PLACEMENT_ORDER,
    PROJECT_SELECT_NO_JOBSITE,
    PROJECT_SELECT_LEGACY,
  ];

  for (const select of selects) {
    const result = await supabase
      .from('projects')
      .select(select)
      .eq('id', projectId)
      .single();

    if (!result.error) {
      if (select === PROJECT_SELECT_NO_JOBSITE) {
        projectJobsiteColumnsAvailable = false;
      } else if (select === PROJECT_SELECT || select === PROJECT_SELECT_NO_LABOR_ESTIMATES) {
        projectJobsiteColumnsAvailable = true;
      }
      return result;
    }

    const msg = result.error.message ?? '';
    if (
      isJobsiteColumnError(msg) ||
      isClientInfoColumnError(msg) ||
      isTruckTicketsSchemaError(msg) ||
      isPlacementOrderColumnError(msg) ||
      isLaborEstimatesSchemaError(msg)
    ) {
      if (isClientInfoColumnError(msg)) {
        console.warn(
          'Project client_info column missing — run migration 20260530120000_project_client_info.sql',
        );
      }
      continue;
    }
    return result;
  }

  return supabase
    .from('projects')
    .select(PROJECT_SELECT_LEGACY)
    .eq('id', projectId)
    .single();
}

async function insertProjectRow(payload: Record<string, unknown>) {
  let body = payload;
  let insertResult = await supabase.from('projects').insert(body).select('id').single();

  if (insertResult.error && isClientInfoColumnError(insertResult.error.message ?? '')) {
    const { client_info: _ci, ...withoutClient } = body;
    console.warn(
      'Saved project without client_info — run migration 20260530120000_project_client_info.sql',
    );
    body = withoutClient;
    insertResult = await supabase.from('projects').insert(body).select('id').single();
  }

  if (insertResult.error && isJobsiteColumnError(insertResult.error.message ?? '')) {
    projectJobsiteColumnsAvailable = false;
    const {
      jobsite_street: _s,
      jobsite_street2: _s2,
      jobsite_city: _c,
      jobsite_state: _st,
      jobsite_zip: _z,
      ...withoutJobsite
    } = body;
    console.warn(
      'Saved project without jobsite columns — apply migration 20250525130000_project_jobsite_address.sql to persist addresses.',
    );
    insertResult = await supabase
      .from('projects')
      .insert(withoutJobsite)
      .select('id')
      .single();
  }

  if (insertResult.error) return insertResult;

  const projectId = insertResult.data?.id as string | undefined;
  if (!projectId) {
    return {
      data: null,
      error: { message: 'Project created but no id was returned' },
    };
  }

  return fetchProjectById(projectId);
}

async function updateProjectRow(
  projectId: string,
  payload: Record<string, unknown>,
) {
  const select = selectAfterProjectWrite();
  let result = await supabase
    .from('projects')
    .update(payload)
    .eq('id', projectId)
    .select(select)
    .single();

  if (result.error && isJobsiteColumnError(result.error.message ?? '')) {
    projectJobsiteColumnsAvailable = false;
    const {
      jobsite_street: _s,
      jobsite_street2: _s2,
      jobsite_city: _c,
      jobsite_state: _st,
      jobsite_zip: _z,
      ...withoutJobsite
    } = payload;
    result = await supabase
      .from('projects')
      .update(withoutJobsite)
      .eq('id', projectId)
      .select(PROJECT_SELECT_NO_JOBSITE)
      .single();
  }

  if (result.error && isPlacementOrderColumnError(result.error.message ?? '')) {
    const { placement_order: _po, ...withoutOrder } = payload;
    console.warn(
      'Saved project without placement_order — apply migration 20250525140000_project_placement_order.sql',
    );
    result = await supabase
      .from('projects')
      .update(withoutOrder)
      .eq('id', projectId)
      .select(PROJECT_SELECT_NO_PLACEMENT_ORDER)
      .single();
  }

  if (result.error && isClientInfoColumnError(result.error.message ?? '')) {
    return fetchProjectById(projectId);
  }

  return result;
}

function mapJobsiteFromRow(row: {
  jobsite_street?: string | null;
  jobsite_street2?: string | null;
  jobsite_city?: string | null;
  jobsite_state?: string | null;
  jobsite_zip?: string | null;
}): USAddress | undefined {
  const addr: USAddress = {
    ...EMPTY_US_ADDRESS,
    street: row.jobsite_street?.trim() ?? '',
    street2: row.jobsite_street2?.trim() ?? '',
    city: row.jobsite_city?.trim() ?? '',
    state: row.jobsite_state?.trim() ?? '',
    zip: row.jobsite_zip?.trim() ?? '',
  };
  if (!addr.city && !addr.state && !addr.zip && !addr.street) return undefined;
  return addr;
}

function jobsitePayload(addr?: USAddress) {
  if (!addr) return {};
  return {
    jobsite_street: addr.street?.trim() ?? '',
    jobsite_street2: addr.street2?.trim() ?? '',
    jobsite_city: addr.city?.trim() ?? '',
    jobsite_state: addr.state?.trim() ?? '',
    jobsite_zip: addr.zip?.trim() ?? '',
  };
}

function mapProjectFromRow(row: any): Project {
  const qcRecords = (row.qc_records || []).map(mapQcRecordFromDb);
  const truckTicketsFromDb = (row.truck_tickets || []).map(mapTruckTicketFromDb);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    jobsiteAddress: mapJobsiteFromRow(row),
    clientInfo: parseClientInfoFromDb(row.client_info),
    wasteFactor: row.waste_factor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pourDate: row.pour_date,
    placementOrder: parsePlacementOrder(row.placement_order),
    mixProfile: (row.mix_profile as MixProfileType) || 'standard',
    calculations: (row.calculations || []).map(mapCalculationFromDb),
    reinforcements: (row.reinforcement_sets || []).map(mapReinforcementSetFromDb),
    laborEstimates: (row.labor_estimates || []).map(mapLaborEstimateFromDb),
    qcRecords: qcRecords.filter((r) => !isTruckTicketRecord(r)),
    truckTickets: mergeTruckTicketsForProject(qcRecords, truckTicketsFromDb),
  };
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  loadProjects: () => Promise<void>;
  addProject: (
    project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'calculations' | 'mixProfile' | 'qcRecords'>
  ) => Promise<void>;
  updateProject: (
    projectId: string,
    projectData: Partial<Project>
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setCurrentProject: (projectId: string | null) => void;

  addCalculation: (
    projectId: string,
    calculation: Omit<Calculation, 'id' | 'createdAt'>
  ) => Promise<Calculation>;
  updateCalculation: (
    projectId: string,
    calculationId: string,
    calculationData: Partial<Calculation>
  ) => Promise<void>;
  deleteCalculation: (projectId: string, calculationId: string) => Promise<void>;

  saveLaborEstimate: (
    projectId: string,
    estimate: {
      label?: string;
      volumeYd?: number;
      inputs: LaborEstimateInputs;
      laborCost: number;
      adjustedLaborHours?: number;
      production?: import('../types/placementOrder').PlacementProductionSnapshot;
      professionalLabor?: import('../types/concreteLaborEstimate').ProfessionalConcreteLaborResult;
    },
  ) => Promise<LaborEstimate>;

  addQCRecord: (
    projectId: string,
    record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateQCRecord: (
    projectId: string,
    recordId: string,
    recordData: Partial<QCRecord>
  ) => Promise<void>;
  deleteQCRecord: (projectId: string, recordId: string) => Promise<void>;

  addTruckTicket: (projectId: string, form: TruckTicketFormState) => Promise<void>;
  updateTruckTicket: (
    projectId: string,
    ticketId: string,
    form: TruckTicketFormState,
  ) => Promise<void>;
  deleteTruckTicket: (projectId: string, ticketId: string) => Promise<void>;
}

interface PreferencesState {
  preferences: {
    autoSave: boolean;
    notifications: {
      projectUpdates: boolean;
      teamChanges: boolean;
      systemAlerts: boolean;
    };
    soundEnabled: boolean;
    hapticsEnabled: boolean;
  };
  loading: boolean;
  updatePreferences: (newPreferences: Partial<PreferencesState['preferences']>) => Promise<void>;
  loadPreferences: () => Promise<void>;
  migratePreferences: () => Promise<void>;
}

// Settings store interfaces
interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  motto: string;
  logo: string | null;
  logoUrl?: string | null;
  logoPath?: string | null;
}

interface SettingsState {
  companySettings: CompanySettings;
  loading: boolean;
  updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
  loadCompanySettings: () => Promise<void>;
  migrateSettings: () => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  units: 'imperial',
  lengthUnit: 'feet',
  volumeUnit: 'cubic_yards',
  measurementSystem: 'imperial',
  currency: 'USD',
  defaultPSI: '3000',
  autoSave: true,
  soundEnabled: true,
  hapticsEnabled: true,
  notifications: {
    projectUpdates: true,
    teamChanges: true,
    systemAlerts: true,
    emailUpdates: true,
    projectReminders: true,
    weatherAlerts: true
  }
};

const defaultCompanySettings: CompanySettings = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  licenseNumber: '',
  motto: '',
  logo: null
};

// --- Helpers to map DB rows ---

const mapQcChecklistFromDb = (chk: any): QCChecklist => ({
  rebarSpacingActual:        chk.rebar_spacing_actual,
  rebarSpacingTolerance:     chk.rebar_spacing_tolerance,
  rebarSpacingPass:          chk.rebar_spacing_pass,

  formPressureTestPass:      chk.form_pressure_test_pass,
  formAlignmentPass:         chk.form_alignment_pass,
  formCoverActual:           chk.form_cover_actual,
  formCoverSpec:             chk.form_cover_spec,
  formCoverPass:             chk.form_cover_pass,

  subgradePrepElectrical:    chk.subgrade_prep_electrical,
  elevationConduitInstalled: chk.elevation_conduit_installed,
  dimensionSleevesOK:        chk.dimension_sleeves_ok,
  compactionPullCordsOK:     chk.compaction_pull_cords_ok,
  capillaryBarrierInstalled: chk.capillary_barrier_installed,
  vaporBarrierOK:            chk.vapor_barrier_ok,
  miscInsectDrainRackOK:     chk.misc_insect_drain_rack_ok,
  subslabPipingInstalled:    chk.subslab_piping_installed,

  floorDrainsOK:             chk.floor_drains_ok,
  floorDrainsElevation:      chk.floor_drains_elevation,
  floorCleanoutsOK:          chk.floor_cleanouts_ok,
  floorCleanoutsElevation:   chk.floor_cleanouts_elevation,
  stubupsAlignmentOK:        chk.stubups_alignment_ok,
  stubupsType:               chk.stubups_type,

  bracingOK:                 chk.bracing_ok,
  screedBoardsSet:           chk.screed_boards_set,
  screedBoardsChecked:       chk.screed_boards_checked,
  waterStopPlaced:           chk.water_stop_placed,
  placingToolsSet:           chk.placing_tools_set,
  placingToolsChecked:       chk.placing_tools_checked,
  finishingToolsSet:         chk.finishing_tools_set,
  finishingToolsChecked:     chk.finishing_tools_checked,
  curingMaterialsAvailable:  chk.curing_materials_available,
});

const mapQcRecordFromDb = (r: any): QCRecord => ({
  id: r.id,
  projectId: r.project_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  checklist: r.qc_checklists?.[0] ? mapQcChecklistFromDb(r.qc_checklists[0]) : undefined,
  ...mapQcRecordFieldsFromDb(r),
});

const mapCalculationFromDb = (c: any): Calculation => ({
  id: c.id,
  type: c.type,
  dimensions: c.dimensions,
  result: c.result,
  weather: c.weather,
  psi: c.psi,
  mixProfile: c.mix_profile,
  quikreteProduct: c.quikrete_product,
  mixDesignApproval: c.mix_design_approval ?? undefined,
  createdAt: c.created_at,
});

const mapReinforcementSetFromDb = (r: any): ReinforcementSet => ({
  id: r.id,
  projectId: r.project_id,
  projectName: r.project_name || '',
  length_ft: r.length_ft,
  width_ft: r.width_ft,
  thickness_in: r.thickness_in,
  height_ft: r.height_ft,
  cover_in: r.cover_in,
  reinforcement_type: r.reinforcement_type,
  
  // Rebar specific
  bar_size: r.bar_size,
  spacing_x_in: r.spacing_x_in,
  spacing_y_in: r.spacing_y_in,
  total_bars_x: r.total_bars_x,
  total_bars_y: r.total_bars_y,
  total_bars: r.total_bars,
  total_linear_ft: r.total_linear_ft,
  
  // Cut list data
  cut_list_items: (r.cut_list_items || []).map((item: any) => ({
    id: item.id,
    lengthFt: item.length_ft,
    qty: item.quantity,
    direction: item.direction,
    barSize: item.bar_size,
  })),
  
  // Column specific
  vertical_bars: r.vertical_bars,
  tie_spacing: r.tie_spacing,
  
  // Fiber specific
  fiber_dose: r.fiber_dose,
  fiber_total_lb: r.fiber_total_lb,
  fiber_bags: r.fiber_bags,
  fiber_type: r.fiber_type,
  
  // Mesh specific
  mesh_sheets: r.mesh_sheets,
  mesh_sheet_size: r.mesh_sheet_size,
  pricing: r.pricing ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapLaborEstimateFromDb = (row: any): LaborEstimate => {
  const inputs = (row.inputs ?? {}) as LaborEstimateInputs & {
    professionalLabor?: LaborEstimate['professionalLabor'];
    production?: LaborEstimate['production'];
  };
  const { professionalLabor: embeddedLabor, production, ...formInputs } = inputs;
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label ?? 'Placement labor',
    volumeYd: row.volume_yd != null ? Number(row.volume_yd) : undefined,
    inputs: formInputs as LaborEstimateInputs,
    laborCost: Number(row.labor_cost) || 0,
    adjustedLaborHours:
      row.adjusted_labor_hours != null ? Number(row.adjusted_labor_hours) : undefined,
    production,
    professionalLabor: embeddedLabor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// --- Zustand store ---

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const { data: rows, error } = await fetchProjectRows();
      if (error) throw error;

      const projects: Project[] = (rows || []).map(mapProjectFromRow);
      set((s) => ({
        projects,
        loading: false,
        currentProject: s.currentProject?.id
          ? projects.find((p) => p.id === s.currentProject!.id) ?? s.currentProject
          : s.currentProject,
      }));
    } catch (err) {
      console.error('Error loading projects:', err);
      set({ loading: false });
      throw err;
    }
  },

  addProject: async (project) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
  
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
  
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      name: project.name,
      description: project.description || '',
      ...jobsitePayload(project.jobsiteAddress),
      waste_factor: project.wasteFactor ?? 10,
      pour_date: project.pourDate ?? null,
      mix_profile: 'standard',
    };
    const clientPayload = clientInfoToDbPayload(project.clientInfo);
    if (clientPayload) {
      insertPayload.client_info = clientPayload;
    }

    let result = await insertProjectRow(insertPayload);

    if (result.error && isClientInfoColumnError(result.error.message ?? '')) {
      const { client_info: _ci, ...withoutClient } = insertPayload;
      console.warn(
        'Saved project without client_info — run migration 20260530120000_project_client_info.sql',
      );
      result = await insertProjectRow(withoutClient);
    }

    const { data, error } = result;
    if (error) throw error;
  
    const newProj = mapProjectFromRow(data);
  
    set((s) => ({
      projects: [newProj, ...s.projects],
      currentProject: newProj,
    }));
  },

  updateProject: async (projectId, projectData) => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (projectData.name)        payload.name        = projectData.name;
    if (projectData.description !== undefined) payload.description = projectData.description;
    if (projectData.wasteFactor) payload.waste_factor = projectData.wasteFactor;
    if (projectData.pourDate)    payload.pour_date    = projectData.pourDate;
    if (projectData.mixProfile)  payload.mix_profile  = projectData.mixProfile;
    if (projectData.placementOrder !== undefined) {
      payload.placement_order = projectData.placementOrder;
    }
    if (projectData.jobsiteAddress !== undefined) {
      Object.assign(payload, jobsitePayload(projectData.jobsiteAddress));
    }
    if (projectData.clientInfo !== undefined) {
      payload.client_info = clientInfoToDbPayload(projectData.clientInfo) ?? {};
    }

    let result = await updateProjectRow(projectId, payload);

    if (result.error && isClientInfoColumnError(result.error.message ?? '')) {
      const { client_info: _ci, ...withoutClient } = payload;
      result = await updateProjectRow(projectId, withoutClient);
    }

    const { data, error } = result;
    if (error) throw error;

    const updated = mapProjectFromRow(data);
    set((s) => ({
      projects:       s.projects.map(p => p.id === projectId ? updated : p),
      currentProject: s.currentProject?.id === projectId ? updated : s.currentProject
    }));
  },

  deleteProject: async (projectId) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (error) throw error;
    set((s) => ({
      projects:       s.projects.filter(p => p.id !== projectId),
      currentProject: s.currentProject?.id === projectId ? null : s.currentProject
    }));
  },

  setCurrentProject: (projectId) => {
    set((s) => {
      if (!projectId) {
        return { currentProject: null };
      }
      const found = s.projects.find((p) => p.id === projectId);
      if (found) {
        return { currentProject: found };
      }
      if (s.currentProject?.id === projectId) {
        return {};
      }
      return { currentProject: null };
    });
  },

  // --- Calculation CRUD (full, unmodified) ---

  addCalculation: async (projectId, calc) => {
    const { data, error } = await supabase
      .from('calculations')
      .insert({
        project_id: projectId,
        type:       calc.type,
        dimensions: calc.dimensions,
        result:     calc.result,
        weather:    calc.weather,
        psi:        calc.psi,
        mix_profile: calc.mixProfile,
        quikrete_product: calc.quikreteProduct,
        mix_design_approval: calc.mixDesignApproval ?? null,
      })
      .select('*, created_at')
      .single();
    if (error) throw error;

    const newCalc: Calculation = {
      id:        data.id,
      type:      data.type,
      dimensions:data.dimensions,
      result:    data.result,
      weather:   data.weather,
      psi:       data.psi,
      mixProfile: data.mix_profile,
      quikreteProduct: data.quikrete_product,
      mixDesignApproval: data.mix_design_approval ?? undefined,
      createdAt: data.created_at
    };
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              calculations: [...p.calculations, newCalc],
              updatedAt:    new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
    
    // Return the created calculation
    return newCalc;
  },

  updateCalculation: async (projectId, calcId, calcData) => {
    const { data, error } = await supabase
      .from('calculations')
      .update({
        type:       calcData.type,
        dimensions: calcData.dimensions,
        result:     calcData.result,
        weather:    calcData.weather,
        psi:        calcData.psi,
        mix_profile: calcData.mixProfile,
        quikrete_product: calcData.quikreteProduct,
        ...(calcData.mixDesignApproval !== undefined
          ? { mix_design_approval: calcData.mixDesignApproval }
          : {}),
      })
      .eq('id', calcId)
      .select('*, created_at')
      .single();
    if (error) throw error;

    const updatedCalc: Calculation = {
      id:        data.id,
      type:      data.type,
      dimensions:data.dimensions,
      result:    data.result,
      weather:   data.weather,
      psi:       data.psi,
      mixProfile: data.mix_profile,
      quikreteProduct: data.quikrete_product,
      mixDesignApproval: data.mix_design_approval ?? undefined,
      createdAt: data.created_at
    };
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              calculations: p.calculations.map(c => c.id === calcId ? updatedCalc : c),
              updatedAt:    new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },

  deleteCalculation: async (projectId, calcId) => {
    const { error } = await supabase
      .from('calculations')
      .delete()
      .eq('id', calcId);
    if (error) throw error;
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              calculations: p.calculations.filter(c => c.id !== calcId),
              updatedAt:    new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },

  saveLaborEstimate: async (projectId, estimate) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const inputsPayload = {
      ...estimate.inputs,
      ...(estimate.production ? { production: estimate.production } : {}),
      ...(estimate.professionalLabor
        ? { professionalLabor: estimate.professionalLabor }
        : {}),
    };

    const existing = get()
      .projects.find((p) => p.id === projectId)?.laborEstimates?.[0];

    if (existing?.id === 'placement-production' && estimate.production) {
      const project = get().projects.find((p) => p.id === projectId);
      const order = project?.placementOrder ?? defaultPlacementOrder();
      await get().updateProject(projectId, {
        placementOrder: {
          ...order,
          production: estimate.production,
          updatedAt: new Date().toISOString(),
        },
      });
      const mapped: LaborEstimate = {
        id: 'placement-production',
        projectId,
        label: estimate.label ?? 'Placement labor',
        volumeYd: estimate.volumeYd,
        inputs: estimate.inputs,
        laborCost: estimate.laborCost,
        adjustedLaborHours: estimate.adjustedLaborHours,
        production: estimate.production,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      set((s) => {
        const update = (p: Project) => {
          if (p.id !== projectId) return p;
          const others = (p.laborEstimates ?? []).filter((e) => e.id !== mapped.id);
          return {
            ...p,
            laborEstimates: [mapped, ...others],
            updatedAt: new Date().toISOString(),
          };
        };
        return {
          projects: s.projects.map(update),
          currentProject: s.currentProject ? update(s.currentProject) : null,
        };
      });
      return mapped;
    }

    let data: any;
    let error: { message?: string; code?: string } | null = null;

    if (existing?.id && existing.id !== 'placement-production') {
      const res = await supabase
        .from('labor_estimates')
        .update({
          label: estimate.label ?? existing.label,
          volume_yd: estimate.volumeYd ?? null,
          inputs: inputsPayload,
          labor_cost: estimate.laborCost,
          adjusted_labor_hours: estimate.adjustedLaborHours ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    } else if (!existing?.id || existing.id === 'placement-production') {
      const res = await supabase
        .from('labor_estimates')
        .insert({
          project_id: projectId,
          user_id: user?.id ?? null,
          label: estimate.label ?? 'Placement labor',
          volume_yd: estimate.volumeYd ?? null,
          inputs: inputsPayload,
          labor_cost: estimate.laborCost,
          adjusted_labor_hours: estimate.adjustedLaborHours ?? null,
        })
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      if (estimate.production && shouldFallbackLaborToPlacementOrder(error)) {
        const project = get().projects.find((p) => p.id === projectId);
        const order = project?.placementOrder ?? defaultPlacementOrder();
        await get().updateProject(projectId, {
          placementOrder: {
            ...order,
            production: estimate.production,
            updatedAt: new Date().toISOString(),
          },
        });
        const mapped: LaborEstimate = {
          id: 'placement-production',
          projectId,
          label: estimate.label ?? 'Placement labor',
          volumeYd: estimate.volumeYd,
          inputs: estimate.inputs,
          laborCost: estimate.laborCost,
          adjustedLaborHours: estimate.adjustedLaborHours,
          production: estimate.production,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => {
          const update = (p: Project) => {
            if (p.id !== projectId) return p;
            const others = (p.laborEstimates ?? []).filter((e) => e.id !== mapped.id);
            return {
              ...p,
              laborEstimates: [mapped, ...others],
              updatedAt: new Date().toISOString(),
            };
          };
          return {
            projects: s.projects.map(update),
            currentProject: s.currentProject ? update(s.currentProject) : null,
          };
        });
        return mapped;
      }
      throw error;
    }

    const mapped = mapLaborEstimateFromDb(data);
    set((s) => {
      const update = (p: Project) => {
        if (p.id !== projectId) return p;
        const others = (p.laborEstimates ?? []).filter((e) => e.id !== mapped.id);
        return {
          ...p,
          laborEstimates: [mapped, ...others],
          updatedAt: new Date().toISOString(),
        };
      };
      return {
        projects: s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null,
      };
    });
    return mapped;
  },

  // --- QC Record CRUD ---

  addQCRecord: async (projectId, rec) => {
    const fullRow = buildQcInsertRow(projectId, rec);
    let result = await supabase
      .from('qc_records')
      .insert(fullRow)
      .select(`*, qc_checklists(*)`)
      .single();

    if (result.error && isQcRecordTypeColumnError(result.error.message ?? '')) {
      const { record_type: _rt, record_data: _rd, ...legacyRow } = fullRow;
      console.warn(
        'Saved QC record without record_type/record_data — run migration 20260530000000_qc_records_record_type.sql',
      );
      result = await supabase
        .from('qc_records')
        .insert(legacyRow)
        .select(`*, qc_checklists(*)`)
        .single();
    }
    if (result.error) throw result.error;

    const newRec = mapQcRecordFromDb(result.data);
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              qcRecords: [...(p.qcRecords||[]), newRec],
              updatedAt: new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },

  updateQCRecord: async (projectId, recId, recData) => {
    const existing = get()
      .projects.find((p) => p.id === projectId)
      ?.qcRecords?.find((r) => r.id === recId);
    const mergedRec: Partial<QCRecord> = existing
      ? { ...existing, ...recData }
      : recData;
    const updateRow = buildQcUpdateRow(mergedRec);
    if (existing) {
      updateRow.record_data = {
        ...buildRecordDataPayload(existing),
        ...buildRecordDataPayload(mergedRec),
      };
    }
    let result = await supabase
      .from('qc_records')
      .update(updateRow)
      .eq('id', recId)
      .select(`*, qc_checklists(*)`)
      .single();

    if (result.error && isQcRecordTypeColumnError(result.error.message ?? '')) {
      const { record_type: _rt, record_data: _rd, ...legacyRow } = updateRow;
      result = await supabase
        .from('qc_records')
        .update(legacyRow)
        .eq('id', recId)
        .select(`*, qc_checklists(*)`)
        .single();
    }
    if (result.error) throw result.error;

    const updatedRec = mapQcRecordFromDb(result.data);
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              qcRecords: p.qcRecords?.map(r => r.id === recId ? updatedRec : r) || [],
              updatedAt: new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },

  deleteQCRecord: async (projectId, recId) => {
    const { error } = await supabase
      .from('qc_records')
      .delete()
      .eq('id', recId);
    if (error) throw error;

    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              qcRecords: p.qcRecords?.filter(r => r.id !== recId) || [],
              truckTickets: p.truckTickets?.filter(r => r.id !== recId) || [],
              updatedAt: new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },

  addTruckTicket: async (projectId, form) => {
    const { data, error } = await supabase
      .from('truck_tickets')
      .insert({
        project_id: projectId,
        record_date: form.recordDate,
        ticket_data: form,
      })
      .select()
      .single();
    if (error) throw error;

    const newTicket = mapTruckTicketFromDb(data);
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              truckTickets: [newTicket, ...(p.truckTickets || [])],
              updatedAt: new Date().toISOString(),
            }
          : p;
      return {
        projects: s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null,
      };
    });
  },

  updateTruckTicket: async (projectId, ticketId, form) => {
    const { data, error } = await supabase
      .from('truck_tickets')
      .update({
        record_date: form.recordDate,
        ticket_data: form,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();
    if (error) throw error;

    const updatedTicket = mapTruckTicketFromDb(data);
    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              truckTickets:
                p.truckTickets?.map((t) =>
                  t.id === ticketId ? updatedTicket : t,
                ) || [],
              updatedAt: new Date().toISOString(),
            }
          : p;
      return {
        projects: s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null,
      };
    });
  },

  deleteTruckTicket: async (projectId, ticketId) => {
    const { error: truckError } = await supabase
      .from('truck_tickets')
      .delete()
      .eq('id', ticketId);

    if (truckError) {
      const { error: legacyError } = await supabase
        .from('qc_records')
        .delete()
        .eq('id', ticketId);
      if (legacyError) throw legacyError;
    }

    set((s) => {
      const update = (p: Project) =>
        p.id === projectId
          ? {
              ...p,
              truckTickets: p.truckTickets?.filter((t) => t.id !== ticketId) || [],
              qcRecords: p.qcRecords?.filter((r) => r.id !== ticketId) || [],
              updatedAt: new Date().toISOString(),
            }
          : p;
      return {
        projects: s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null,
      };
    });
  },
}));

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  preferences: {
    autoSave: true,
    notifications: {
      projectUpdates: true,
      teamChanges: true,
      systemAlerts: true,
    },
    soundEnabled: true,
    hapticsEnabled: true,
  },
  loading: false,
  
  loadPreferences: async () => {
    try {
      set({ loading: true });
      const preferences = await getUserPreferences();
      set({ preferences, loading: false });
    } catch (error) {
      console.error('Error loading preferences:', error);
      set({ loading: false });
      // Fall back to localStorage if Supabase fails
      const saved = localStorage.getItem('concretePreferences');
      if (saved) {
        const localPreferences = JSON.parse(saved);
        set({ preferences: { ...defaultPreferences, ...localPreferences } });
      }
    }
  },
  
  updatePreferences: async (newPreferences) => {
    try {
      set({ loading: true });
      const updatedPreferences = await updateUserPreferences(newPreferences);
      set({ preferences: updatedPreferences, loading: false });
    } catch (error) {
      console.error('Error updating preferences:', error);
      set({ loading: false });
      // Fall back to localStorage update if Supabase fails
      const currentPrefs = get().preferences;
      const updated = { ...currentPrefs, ...newPreferences };
      localStorage.setItem('concretePreferences', JSON.stringify(updated));
      set({ preferences: updated });
    }
  },
  
  migratePreferences: async () => {
    try {
      set({ loading: true });
      const migratedPreferences = await migratePreferencesFromLocalStorage();
      
      if (migratedPreferences) {
        set({ preferences: migratedPreferences });
        console.log('Preferences migrated successfully');
      }
      
      set({ loading: false });
    } catch (error) {
      console.error('Error migrating preferences:', error);
      set({ loading: false });
    }
  }
}));

export const useSettingsStore = create<SettingsState>((set, get) => {
  return {
    companySettings: defaultCompanySettings,
    loading: false,
    
    loadCompanySettings: async () => {
      try {
        set({ loading: true });
        const settings = await getCompanySettings();
        
        // Map Supabase settings to the local interface
        const mappedSettings: CompanySettings = {
          companyName: settings.companyName,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          licenseNumber: settings.licenseNumber,
          motto: settings.motto,
          logo: settings.logoUrl, // Map logoUrl to logo for backward compatibility
          logoUrl: settings.logoUrl,
          logoPath: settings.logoPath
        };
        
        set({ companySettings: mappedSettings, loading: false });
      } catch (error) {
        console.error('Error loading company settings:', error);
        set({ loading: false });
        // Fall back to localStorage if Supabase fails
        const saved = localStorage.getItem('companySettings');
        if (saved) {
          const localSettings = JSON.parse(saved);
          set({ companySettings: { ...defaultCompanySettings, ...localSettings } });
        }
      }
    },
    
    updateCompanySettings: async (newSettings) => {
      try {
        set({ loading: true });
        
        // Map local interface to Supabase interface
        const supabaseSettings = {
          companyName: newSettings.companyName,
          address: newSettings.address,
          phone: newSettings.phone,
          email: newSettings.email,
          licenseNumber: newSettings.licenseNumber,
          motto: newSettings.motto,
          logoUrl: newSettings.logoUrl || newSettings.logo, // Handle both logoUrl and logo
          logoPath: newSettings.logoPath
        };
        
        const updatedSettings = await updateSupabaseSettings(supabaseSettings);
        
        // Map back to local interface
        const mappedSettings: CompanySettings = {
          companyName: updatedSettings.companyName,
          address: updatedSettings.address,
          phone: updatedSettings.phone,
          email: updatedSettings.email,
          licenseNumber: updatedSettings.licenseNumber,
          motto: updatedSettings.motto,
          logo: updatedSettings.logoUrl,
          logoUrl: updatedSettings.logoUrl,
          logoPath: updatedSettings.logoPath
        };
        
        set({ companySettings: mappedSettings, loading: false });
      } catch (error) {
        console.error('Error updating company settings:', error);
        set({ loading: false });
        // Fall back to localStorage update if Supabase fails
        const updated = { ...get().companySettings, ...newSettings };
        localStorage.setItem('companySettings', JSON.stringify(updated));
        set({ companySettings: updated });
      }
    },
    
    migrateSettings: async () => {
      try {
        set({ loading: true });
        const migratedSettings = await migrateFromLocalStorage();
        
        if (migratedSettings) {
          // Map to local interface
          const mappedSettings: CompanySettings = {
            companyName: migratedSettings.companyName,
            address: migratedSettings.address,
            phone: migratedSettings.phone,
            email: migratedSettings.email,
            licenseNumber: migratedSettings.licenseNumber,
            motto: migratedSettings.motto,
            logo: migratedSettings.logoUrl,
            logoUrl: migratedSettings.logoUrl,
            logoPath: migratedSettings.logoPath
          };
          
          set({ companySettings: mappedSettings });
          console.log('Settings migrated successfully');
        }
        
        set({ loading: false });
      } catch (error) {
        console.error('Error migrating settings:', error);
        set({ loading: false });
      }
    }
  };
});
