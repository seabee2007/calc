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
  ReinforcementSet
} from '../types';
import { MixProfileType } from '../types/curing';

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
}

interface PreferencesState {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
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
  notifications: {
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
  date: r.date,
  temperature: r.temperature,
  humidity: r.humidity,
  slump: r.slump,
  airContent: r.air_content,
  cylindersMade: r.cylinders_made,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  checklist: r.qc_checklists?.[0] ? mapQcChecklistFromDb(r.qc_checklists[0]) : undefined,
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
  
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// --- Zustand store ---

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const { data: rows, error } = await supabase
        .from('projects')
        .select(`
          id, name, description,
          waste_factor, created_at, updated_at,
          pour_date, mix_profile,
          calculations(*),
          qc_records(*, qc_checklists(*)),
          reinforcement_sets(*, cut_list_items(*))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const projects: Project[] = (rows || []).map((row: any) => ({
        id:           row.id,
        name:         row.name,
        description:  row.description,
        wasteFactor:  row.waste_factor,
        createdAt:    row.created_at,
        updatedAt:    row.updated_at,
        pourDate:     row.pour_date,
        mixProfile:   (row.mix_profile as MixProfileType) || 'standard',
        calculations: (row.calculations || []).map(mapCalculationFromDb),
        reinforcements: (row.reinforcement_sets || []).map(mapReinforcementSetFromDb),
        qcRecords:    (row.qc_records || []).map(mapQcRecordFromDb),
      }));
      set({ projects, loading: false });
    } catch (err) {
      console.error('Error loading projects:', err);
      set({ loading: false });
      throw err;
    }
  },

  addProject: async (project) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name:         project.name,
        description:  project.description,
        waste_factor: project.wasteFactor,
        pour_date:    project.pourDate,
        mix_profile:  'standard',
      })
      .select(`
        id, name, description,
        waste_factor, created_at, updated_at,
        pour_date, mix_profile,
        calculations(*),
        qc_records(*, qc_checklists(*)),
        reinforcement_sets(*, cut_list_items(*))
      `)
      .single();
    if (error) throw error;

    const newProj: Project = {
      id:           data.id,
      name:         data.name,
      description:  data.description,
      wasteFactor:  data.waste_factor,
      createdAt:    data.created_at,
      updatedAt:    data.updated_at,
      pourDate:     data.pour_date,
      mixProfile:   (data.mix_profile as MixProfileType) || 'standard',
      calculations: (data.calculations || []).map(mapCalculationFromDb),
      reinforcements: (data.reinforcement_sets || []).map(mapReinforcementSetFromDb),
      qcRecords:    (data.qc_records || []).map(mapQcRecordFromDb),
    };
    set((s) => ({
      projects:       [newProj, ...s.projects],
      currentProject: newProj
    }));
  },

  updateProject: async (projectId, projectData) => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (projectData.name)        payload.name        = projectData.name;
    if (projectData.description) payload.description = projectData.description;
    if (projectData.wasteFactor) payload.waste_factor = projectData.wasteFactor;
    if (projectData.pourDate)    payload.pour_date    = projectData.pourDate;
    if (projectData.mixProfile)  payload.mix_profile  = projectData.mixProfile;

    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select(`
        id, name, description,
        waste_factor, created_at, updated_at,
        pour_date, mix_profile,
        calculations(*),
        qc_records(*, qc_checklists(*)),
        reinforcement_sets(*, cut_list_items(*))
      `)
      .single();
    if (error) throw error;

    const updated: Project = {
      id:           data.id,
      name:         data.name,
      description:  data.description,
      wasteFactor:  data.waste_factor,
      createdAt:    data.created_at,
      updatedAt:    data.updated_at,
      pourDate:     data.pour_date,
      mixProfile:   (data.mix_profile as MixProfileType) || 'standard',
      calculations: (data.calculations || []).map(mapCalculationFromDb),
      reinforcements: (data.reinforcement_sets || []).map(mapReinforcementSetFromDb),
      qcRecords:    (data.qc_records || []).map(mapQcRecordFromDb),
    };
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
    set((s) => ({
      currentProject: projectId
        ? s.projects.find(p => p.id === projectId) || null
        : null
    }));
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
        quikrete_product: calc.quikreteProduct
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
        quikrete_product: calcData.quikreteProduct
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

  // --- QC Record CRUD ---

  addQCRecord: async (projectId, rec) => {
    const { data, error } = await supabase
      .from('qc_records')
      .insert({
        project_id:     projectId,
        date:           rec.date,
        temperature:    rec.temperature,
        humidity:       rec.humidity,
        slump:          rec.slump,
        air_content:    rec.airContent,
        cylinders_made: rec.cylindersMade,
        notes:          rec.notes
      })
      .select(`*, qc_checklists(*)`)
      .single();
    if (error) throw error;

    const newRec = mapQcRecordFromDb(data);
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
    const { data, error } = await supabase
      .from('qc_records')
      .update({
        date:           recData.date,
        temperature:    recData.temperature,
        humidity:       recData.humidity,
        slump:          recData.slump,
        air_content:    recData.airContent,
        cylinders_made: recData.cylindersMade,
        notes:          recData.notes,
        updated_at:     new Date().toISOString()
      })
      .eq('id', recId)
      .select(`*, qc_checklists(*)`)
      .single();
    if (error) throw error;

    const updatedRec = mapQcRecordFromDb(data);
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
              updatedAt: new Date().toISOString()
            }
          : p;
      return {
        projects:       s.projects.map(update),
        currentProject: s.currentProject ? update(s.currentProject) : null
      };
    });
  },
}));

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  return {
    preferences: defaultPreferences,
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
  };
});

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
