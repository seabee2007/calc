import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  Project,
  UserPreferences,
  Calculation,
  QCRecord,
  QCChecklist
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
  ) => Promise<void>;
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
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  units: 'imperial',
  lengthUnit: 'feet',
  volumeUnit: 'cubic_yards',
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
  id:            r.id,
  projectId:     r.project_id,
  date:          r.date,
  temperature:   r.temperature,
  humidity:      r.humidity,
  slump:         r.slump,
  airContent:    r.air_content,
  cylindersMade: r.cylinders_made,
  notes:         r.notes,
  createdAt:     r.created_at,
  updatedAt:     r.updated_at,
  checklist:     r.qc_checklists?.[0] ? mapQcChecklistFromDb(r.qc_checklists[0]) : undefined,
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
          qc_records(*, qc_checklists(*))
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
        calculations: row.calculations || [],
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
        qc_records(*, qc_checklists(*))
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
      calculations: data.calculations || [],
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
        qc_records(*, qc_checklists(*))
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
      calculations: data.calculations || [],
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
        weather:    calc.weather
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
  },

  updateCalculation: async (projectId, calcId, calcData) => {
    const { data, error } = await supabase
      .from('calculations')
      .update({
        type:       calcData.type,
        dimensions: calcData.dimensions,
        result:     calcData.result,
        weather:    calcData.weather
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

export const usePreferencesStore = create<PreferencesState>((set) => {
  const saved = localStorage.getItem('concretePreferences');
  const initial = saved
    ? JSON.parse(saved)
    : defaultPreferences;
  return {
    preferences: initial,
    updatePreferences: (newPrefs) => {
      const updated = { ...initial, ...newPrefs };
      localStorage.setItem('concretePreferences', JSON.stringify(updated));
      set({ preferences: updated });
    },
  };
});
