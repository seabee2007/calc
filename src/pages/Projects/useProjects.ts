import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useProjectStore } from '../../store';
import { MixProfileType } from '../../types/curing';
import { Project, QCRecord } from '../../types';
import { generateProjectPDF } from '../../utils/pdf';
import { CONCRETE_MIX_DESIGNS } from '../../types';

export function useProjects() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    projects,
    currentProject,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    deleteCalculation,
    setCurrentProject
  } = useProjectStore();

  const [ui, setUi] = useState({
    showCreate: false,
    showDetails: false,
    editing: false,
    selectedPsi: '3000',
    wasteFactor: currentProject?.wasteFactor?.toString() || '10',
    mixProfile: (currentProject?.mixProfile || 'standard') as MixProfileType,
    isSaving: false,
    toast: { show: false, msg: '', type: 'success' as 'success'|'error'|'warning' },
    deleteConfirm: { show: false, type: null as 'project'|'calculation'|null, id: '' }
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Sync URL state
  useEffect(() => {
    const state = location.state as { showProjectDetails?: boolean; projectId?: string };
    if (state?.showProjectDetails && state?.projectId) {
      setCurrentProject(state.projectId);
      setUi(s => ({ ...s, showDetails: true }));
    }
  }, [location.state, setCurrentProject]);

  // Sync current project state
  useEffect(() => {
    if (currentProject) {
      setUi(s => ({
        ...s,
        wasteFactor: currentProject.wasteFactor?.toString() || '10',
        mixProfile: currentProject.mixProfile || 'standard'
      }));
    }
  }, [currentProject]);

  const handlers = {
    create: async (data: { name: string; description: string }) => {
      await addProject(data);
      setUi(s => ({ ...s, showCreate: false }));
      toast('Project created successfully', 'success');
    },

    update: async (data: { name: string; description: string }) => {
      if (currentProject) {
        await updateProject(currentProject.id, data);
        setUi(s => ({ ...s, editing: false }));
        toast('Project updated successfully', 'success');
      }
    },

    selectProject: (id: string) => {
      setCurrentProject(id);
      setUi(s => ({ ...s, showDetails: true }));
    },

    deleteProject: async () => {
      if (currentProject) {
        await deleteProject(currentProject.id);
        setUi(s => ({ ...s, showDetails: false }));
        toast('Project deleted successfully', 'success');
      }
    },

    deleteCalculation: async (calcId: string) => {
      if (currentProject) {
        await deleteCalculation(currentProject.id, calcId);
        toast('Calculation deleted successfully', 'success');
      }
    },

    navigateToCalculator: (projectId: string) => {
      navigate('/calculator', { state: { projectId } });
    },

    mixProfileChange: async (newProfile: MixProfileType) => {
      if (!currentProject) return;
      setUi(s => ({ ...s, isSaving: true }));
      try {
        await updateProject(currentProject.id, { mixProfile: newProfile });
        setUi(s => ({ ...s, mixProfile: newProfile }));
        toast('Mix profile updated', 'success');
      } catch (err) {
        console.error('Failed to save mix profile', err);
        toast('Error updating mix profile', 'error');
      } finally {
        setUi(s => ({ ...s, isSaving: false }));
      }
    },

    dateChange: async (date: string) => {
      if (currentProject) {
        setUi(s => ({ ...s, isSaving: true }));
        try {
          await updateProject(currentProject.id, { pourDate: date });
          toast('Pour date updated successfully', 'success');
        } catch (error) {
          console.error('Error updating pour date:', error);
          toast('Error updating pour date', 'error');
        } finally {
          setUi(s => ({ ...s, isSaving: false }));
        }
      }
    },

    saveWasteFactor: async () => {
      if (currentProject) {
        setUi(s => ({ ...s, isSaving: true }));
        try {
          await updateProject(currentProject.id, { wasteFactor: parseInt(ui.wasteFactor) });
          toast('Waste factor updated successfully', 'success');
        } catch (error) {
          toast('Error saving waste factor', 'error');
        } finally {
          setUi(s => ({ ...s, isSaving: false }));
        }
      }
    },

    printPDF: () => {
      if (currentProject) {
        generateProjectPDF(currentProject, ui.selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);
        toast('PDF generated successfully', 'success');
      }
    },

    saveQCRecord: async (record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentProject) return;
      try {
        const { data, error } = await supabase
          .from('qc_records')
          .insert([{
            project_id: currentProject.id,
            date: record.date,
            temperature: parseFloat(record.temperature.toString()) || 0,
            humidity: parseFloat(record.humidity.toString()) || 0,
            slump: parseFloat(record.slump.toString()) || 0,
            air_content: parseFloat(record.airContent.toString()) || 0,
            cylinders_made: parseInt(record.cylindersMade.toString()) || 0,
            notes: record.notes || ''
          }])
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          const updatedProject = {
            ...currentProject,
            qcRecords: [...(currentProject.qcRecords || []), data]
          };
          await updateProject(currentProject.id, updatedProject);
          setCurrentProject(currentProject.id);
        }
        
        toast('QC record added successfully', 'success');
      } catch (err) {
        console.error('Error saving QC record:', err);
        toast('Error saving QC record', 'error');
      }
    },

    deleteQCRecord: async (recordId: string) => {
      if (!currentProject) return;
      try {
        const { error } = await supabase
          .from('qc_records')
          .delete()
          .eq('id', recordId);

        if (error) throw error;
        
        const updatedProject = {
          ...currentProject,
          qcRecords: currentProject.qcRecords?.filter(record => record.id !== recordId) || []
        };
        
        await updateProject(currentProject.id, updatedProject);
        setCurrentProject(currentProject.id);
        
        toast('QC record deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting QC record:', err);
        toast('Error deleting QC record', 'error');
      }
    },

    confirmDelete: (type: 'project' | 'calculation', id: string) => {
      setUi(s => ({
        ...s,
        deleteConfirm: { show: true, type, id }
      }));
    },

    cancelDelete: () => {
      setUi(s => ({
        ...s,
        deleteConfirm: { show: false, type: null, id: '' }
      }));
    },

    handleDeleteConfirm: async () => {
      const { type, id } = ui.deleteConfirm;
      if (!type || !id) return;

      if (type === 'project') {
        await deleteProject(id);
        setUi(s => ({
          ...s,
          showDetails: false,
          deleteConfirm: { show: false, type: null, id: '' }
        }));
        toast('Project deleted successfully', 'success');
      } else {
        if (currentProject) {
          await deleteCalculation(currentProject.id, id);
          toast('Calculation deleted successfully', 'success');
        }
      }
      setUi(s => ({
        ...s,
        deleteConfirm: { show: false, type: null, id: '' }
      }));
    }
  };

  function toast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    setUi(s => ({ ...s, toast: { show: true, msg: message, type } }));
    setTimeout(() => setUi(s => ({ ...s, toast: { ...s.toast, show: false } })), 1500);
  }

  return { projects, currentProject, ui, setUi, handlers };
}