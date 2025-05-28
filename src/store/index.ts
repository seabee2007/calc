import { create } from 'zustand';
import { Project, UserPreferences, Calculation, QCRecord } from '../types';
import { supabase } from '../lib/supabase';
import { MixProfileType } from '../types/curing';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'calculations' | 'mixProfile'>) => Promise<void>;
  updateProject: (projectId: string, projectData: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setCurrentProject: (projectId: string | null) => void;
  addCalculation: (projectId: string, calculation: Omit<Calculation, 'id' | 'createdAt'>) => Promise<void>;
  updateCalculation: (projectId: string, calculationId: string, calculationData: Partial<Calculation>) => Promise<void>;
  deleteCalculation: (projectId: string, calculationId: string) => Promise<void>;
  addQCRecord: (projectId: string, record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateQCRecord: (projectId: string, recordId: string, recordData: Partial<QCRecord>) => Promise<void>;
  deleteQCRecord: (projectId: string, recordId: string) => Promise<void>;
  loadProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  loading: false,

  loadProjects: async () => {
    try {
      set({ loading: true });
      
      const { data: rows, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          waste_factor,
          created_at,
          updated_at,
          pour_date,
          mix_profile,
          calculations (*),
          qc_records (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProjects = rows?.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        wasteFactor: row.waste_factor,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pourDate: row.pour_date,
        mixProfile: row.mix_profile || 'standard',
        calculations: row.calculations || [],
        qcRecords: row.qc_records || []
      })) || [];

      set({ projects: formattedProjects, loading: false });
    } catch (error) {
      console.error('Error loading projects:', error);
      set({ loading: false });
      throw error;
    }
  },

  addProject: async (project) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: project.name,
          description: project.description,
          waste_factor: project.wasteFactor,
          pour_date: project.pourDate,
          mix_profile: 'standard'
        })
        .select(`
          id,
          name,
          description,
          waste_factor,
          created_at,
          updated_at,
          pour_date,
          mix_profile,
          calculations (*),
          qc_records (*)
        `)
        .single();

      if (error) throw error;

      const newProject: Project = {
        id: data.id,
        name: data.name,
        description: data.description,
        wasteFactor: data.waste_factor,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pourDate: data.pour_date,
        mixProfile: data.mix_profile || 'standard',
        calculations: data.calculations || [],
        qcRecords: data.qc_records || []
      };

      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject
      }));
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  },

  updateProject: async (projectId, projectData) => {
    try {
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };
      if (projectData.name !== undefined) updatePayload.name = projectData.name;
      if (projectData.description !== undefined) updatePayload.description = projectData.description;
      if (projectData.wasteFactor !== undefined) updatePayload.waste_factor = projectData.wasteFactor;
      if (projectData.pourDate !== undefined) updatePayload.pour_date = projectData.pourDate;
      if (projectData.mixProfile !== undefined) updatePayload.mix_profile = projectData.mixProfile;

      const { data, error } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', projectId)
        .select(`
          id,
          name,
          description,
          waste_factor,
          created_at,
          updated_at,
          pour_date,
          mix_profile,
          calculations (*),
          qc_records (*)
        `)
        .single();

      if (error) throw error;

      const updatedProject: Project = {
        id: data.id,
        name: data.name,
        description: data.description,
        wasteFactor: data.waste_factor,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        pourDate: data.pour_date,
        mixProfile: data.mix_profile || 'standard',
        calculations: data.calculations || [],
        qcRecords: data.qc_records || []
      };

      set((state) => ({
        projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
        currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject
      }));
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  deleteProject: async (projectId) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      set((state) => ({
        projects: state.projects.filter(p => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject
      }));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },

  setCurrentProject: (projectId) => {
    if (projectId === null) {
      set({ currentProject: null });
      return;
    }

    const project = get().projects.find(p => p.id === projectId) || null;
    set({ currentProject: project });
  },

  addCalculation: async (projectId, calculation) => {
    try {
      const { data, error } = await supabase
        .from('calculations')
        .insert({
          project_id: projectId,
          type: calculation.type,
          dimensions: calculation.dimensions,
          result: calculation.result,
          weather: calculation.weather
        })
        .select('*, created_at')
        .single();

      if (error) throw error;

      const newCalculation: Calculation = {
        id: data.id,
        type: data.type,
        dimensions: data.dimensions,
        result: data.result,
        weather: data.weather,
        createdAt: data.created_at
      };

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              calculations: [...project.calculations, newCalculation],
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              calculations: [...state.currentProject.calculations, newCalculation],
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error adding calculation:', error);
      throw error;
    }
  },

  updateCalculation: async (projectId, calculationId, calculationData) => {
    try {
      const { data, error } = await supabase
        .from('calculations')
        .update({
          type: calculationData.type,
          dimensions: calculationData.dimensions,
          result: calculationData.result,
          weather: calculationData.weather
        })
        .eq('id', calculationId)
        .select('*, created_at')
        .single();

      if (error) throw error;

      const updatedCalculation: Calculation = {
        id: data.id,
        type: data.type,
        dimensions: data.dimensions,
        result: data.result,
        weather: data.weather,
        createdAt: data.created_at
      };

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              calculations: project.calculations.map(calc =>
                calc.id === calculationId ? updatedCalculation : calc
              ),
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              calculations: state.currentProject.calculations.map(calc =>
                calc.id === calculationId ? updatedCalculation : calc
              ),
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error updating calculation:', error);
      throw error;
    }
  },

  deleteCalculation: async (projectId, calculationId) => {
    try {
      const { error } = await supabase
        .from('calculations')
        .delete()
        .eq('id', calculationId);

      if (error) throw error;

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              calculations: project.calculations.filter(calc => calc.id !== calculationId),
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              calculations: state.currentProject.calculations.filter(calc => calc.id !== calculationId),
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error deleting calculation:', error);
      throw error;
    }
  },

  addQCRecord: async (projectId, record) => {
    try {
      const { data, error } = await supabase
        .from('qc_records')
        .insert({
          project_id: projectId,
          date: record.date,
          temperature: record.temperature,
          humidity: record.humidity,
          slump: record.slump,
          air_content: record.airContent,
          cylinders_made: record.cylindersMade,
          notes: record.notes
        })
        .select('*')
        .single();

      if (error) throw error;

      const newRecord: QCRecord = {
        id: data.id,
        projectId: data.project_id,
        date: data.date,
        temperature: data.temperature,
        humidity: data.humidity,
        slump: data.slump,
        airContent: data.air_content,
        cylindersMade: data.cylinders_made,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              qcRecords: [...(project.qcRecords || []), newRecord],
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              qcRecords: [...(state.currentProject.qcRecords || []), newRecord],
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error adding QC record:', error);
      throw error;
    }
  },

  updateQCRecord: async (projectId, recordId, recordData) => {
    try {
      const { data, error } = await supabase
        .from('qc_records')
        .update({
          date: recordData.date,
          temperature: recordData.temperature,
          humidity: recordData.humidity,
          slump: recordData.slump,
          air_content: recordData.airContent,
          cylinders_made: recordData.cylindersMade,
          notes: recordData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .select('*')
        .single();

      if (error) throw error;

      const updatedRecord: QCRecord = {
        id: data.id,
        projectId: data.project_id,
        date: data.date,
        temperature: data.temperature,
        humidity: data.humidity,
        slump: data.slump,
        airContent: data.air_content,
        cylindersMade: data.cylinders_made,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              qcRecords: project.qcRecords?.map(record =>
                record.id === recordId ? updatedRecord : record
              ) || [],
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              qcRecords: state.currentProject.qcRecords?.map(record =>
                record.id === recordId ? updatedRecord : record
              ) || [],
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error updating QC record:', error);
      throw error;
    }
  },

  deleteQCRecord: async (projectId, recordId) => {
    try {
      const { error } = await supabase
        .from('qc_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      set((state) => {
        const updatedProjects = state.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              qcRecords: project.qcRecords?.filter(record => record.id !== recordId) || [],
              updatedAt: new Date().toISOString()
            };
          }
          return project;
        });

        const updatedCurrentProject = state.currentProject?.id === projectId
          ? {
              ...state.currentProject,
              qcRecords: state.currentProject.qcRecords?.filter(record => record.id !== recordId) || [],
              updatedAt: new Date().toISOString()
            }
          : state.currentProject;

        return {
          projects: updatedProjects,
          currentProject: updatedCurrentProject
        };
      });
    } catch (error) {
      console.error('Error deleting QC record:', error);
      throw error;
    }
  }
}));