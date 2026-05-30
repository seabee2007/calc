import { createContext, useContext, useState, useEffect, createElement, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useProjectStore } from '../../store';
import { MixProfileType } from '../../types/curing';
import { Project, QCRecord } from '../../types';
import { generateProjectPDF } from '../../utils/pdf';
import { CONCRETE_MIX_DESIGNS } from '../../types';
import { workflowNavigateState, workflowQuery } from '../../utils/workflow';
import type { ProjectFormData } from '../../components/projects/ProjectForm';
import { defaultPlacementOrder } from '../../types/placementOrder';
import { createClientPortal } from '../../services/clientPortalService';
import { useConfirm } from '../../contexts/ConfirmContext';

const ProjectsContext = createContext<ReturnType<typeof useProjectsState> | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const value = useProjectsState();
  return createElement(ProjectsContext.Provider, { value }, children);
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    throw new Error('useProjects must be used within ProjectsProvider');
  }
  return ctx;
}

function useProjectsState() {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const {
    projects,
    currentProject,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    deleteCalculation,
    setCurrentProject,
    addQCRecord,
    updateQCRecord,
    deleteQCRecord,
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
    createdPortal: null as { clientName: string; token: string } | null,
  });

  const openProjectDetails = (projectId: string) => {
    setCurrentProject(projectId);
    setUi((s) => ({ ...s, showDetails: true, showCreate: false, editing: false }));
  };

  // Ensure projects are loaded (e.g. after full-page reload on ?project= deep link)
  useEffect(() => {
    if (projects.length === 0) {
      void loadProjects();
    }
  }, [projects.length, loadProjects]);

  const backToProjectList = () => {
    setCurrentProject(null);
    setUi((s) => ({ ...s, showDetails: false, showCreate: false, editing: false }));
    navigate({ pathname: '/projects', search: '' }, { replace: true, state: { view: 'list' } });
  };

  // Sync URL / navigation state (workflow return, deep links, Start Project)
  useEffect(() => {
    const state = location.state as {
      showProjectDetails?: boolean;
      projectId?: string;
      openCreate?: boolean;
      view?: 'list';
    };
    const projectIdFromQuery = new URLSearchParams(location.search).get('project');

    if (state?.view === 'list') {
      setCurrentProject(null);
      setUi((s) => ({ ...s, showDetails: false, showCreate: false, editing: false }));
      return;
    }

    if (state?.showProjectDetails && state?.projectId) {
      const id = state.projectId;
      const store = useProjectStore.getState();
      const ready =
        store.currentProject?.id === id || projects.some((p) => p.id === id);
      if (ready) {
        openProjectDetails(id);
      } else {
        void loadProjects().then(() => {
          const next = useProjectStore.getState();
          if (next.currentProject?.id === id || next.projects.some((p) => p.id === id)) {
            openProjectDetails(id);
          } else {
            setUi((s) => ({ ...s, showDetails: false }));
          }
        });
      }
      return;
    }
    if (projectIdFromQuery) {
      const exists = projects.some((p) => p.id === projectIdFromQuery);
      if (exists) {
        openProjectDetails(projectIdFromQuery);
      } else if (projects.length === 0) {
        void loadProjects().then(() => {
          const loaded = useProjectStore
            .getState()
            .projects.some((p) => p.id === projectIdFromQuery);
          if (loaded) {
            openProjectDetails(projectIdFromQuery);
          } else {
            setUi((s) => ({ ...s, showDetails: false }));
          }
        });
      } else {
        setUi((s) => ({ ...s, showDetails: false }));
      }
      return;
    }
    if (state?.openCreate) {
      setCurrentProject(null);
      setUi((s) => ({ ...s, showCreate: true, showDetails: false, editing: false }));
    }
  }, [location.state, location.search, projects, loadProjects, setCurrentProject]);

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
    create: async (data: ProjectFormData) => {
      try {
        await addProject({
          name: data.name,
          description: data.description,
          jobsiteAddress: data.jobsiteAddress,
          clientInfo: data.clientInfo,
          pourDate: data.pourDate,
        });
        const newProject = useProjectStore.getState().currentProject;
        if (!newProject) {
          toast('Project created but could not open details', 'error');
          setUi((s) => ({ ...s, showCreate: false, showDetails: false }));
          return;
        }
        setUi((s) => ({
          ...s,
          showCreate: false,
          showDetails: true,
          editing: false,
        }));
        navigate('/projects', {
          replace: true,
          state: { showProjectDetails: true, projectId: newProject.id },
        });
        toast('Project created successfully', 'success');

        if (data.clientPortalAccess?.enabled) {
          const portalName = data.clientPortalAccess.clientName.trim();
          const portalEmail = data.clientPortalAccess.clientEmail.trim();
          if (portalName && portalEmail) {
            try {
              const portal = await createClientPortal({
                projectId: newProject.id,
                clientName: portalName,
                clientEmail: portalEmail,
              });
              setUi((s) => ({
                ...s,
                createdPortal: { clientName: portal.clientName, token: portal.token },
              }));
            } catch (portalErr) {
              console.error('Error creating client portal:', portalErr);
              toast('Project created but client portal could not be created', 'warning');
            }
          }
        }
      } catch (err) {
        console.error('Error creating project:', err);
        toast('Error creating project', 'error');
      }
    },

    update: async (data: ProjectFormData) => {
      if (!currentProject) return;
      try {
        await updateProject(currentProject.id, {
          name: data.name,
          description: data.description,
          jobsiteAddress: data.jobsiteAddress,
          clientInfo: data.clientInfo,
          pourDate: data.pourDate,
        });
        setUi((s) => ({ ...s, editing: false }));
        toast('Project updated successfully', 'success');

        if (data.clientPortalAccess?.enabled) {
          const portalName = data.clientPortalAccess.clientName.trim();
          const portalEmail = data.clientPortalAccess.clientEmail.trim();
          if (portalName && portalEmail) {
            try {
              const portal = await createClientPortal({
                projectId: currentProject.id,
                clientName: portalName,
                clientEmail: portalEmail,
              });
              setUi((s) => ({
                ...s,
                createdPortal: { clientName: portal.clientName, token: portal.token },
              }));
            } catch (portalErr) {
              console.error('Error creating client portal:', portalErr);
              toast('Project saved but client portal could not be created', 'warning');
            }
          }
        }
      } catch (err) {
        console.error('Error updating project:', err);
        toast('Error updating project', 'error');
      }
    },

    selectProject: (id: string) => {
      setCurrentProject(id);
      setUi(s => ({ ...s, showDetails: true }));
      navigate(
        { pathname: '/projects', search: '' },
        { state: { showProjectDetails: true, projectId: id } },
      );
    },

    backToProjectList,

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

    navigateToReinforcementCalculator: (projectId: string) => {
      navigate(`/calculator/reinforcement${workflowQuery(projectId)}`, {
        state: workflowNavigateState(projectId),
      });
    },

    navigateToLaborCalculator: (projectId: string) => {
      navigate(`/calculator/labor${workflowQuery(projectId)}`, {
        state: workflowNavigateState(projectId),
      });
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
          // Create a proper ISO date string for the pourDate
          const isoDate = new Date(date + 'T00:00:00.000Z').toISOString();
          await updateProject(currentProject.id, { pourDate: isoDate });
          toast('Placement date updated successfully', 'success');
        } catch (error) {
          console.error('Error updating pour date:', error);
          toast('Error updating placement date', 'error');
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

    printPDF: async () => {
      if (currentProject) {
        try {
          await generateProjectPDF(currentProject, ui.selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);
          toast('PDF generated successfully', 'success');
        } catch (error) {
          console.error('Error generating project PDF:', error);
          toast('Failed to generate PDF. Please try again.', 'error');
        }
      }
    },

    saveQCRecord: async (
      record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
      recordId?: string,
    ) => {
      if (!currentProject) return;
      try {
        if (recordId) {
          await updateQCRecord(currentProject.id, recordId, record);
          toast('QC record updated successfully', 'success');
        } else {
          await addQCRecord(currentProject.id, record);
          toast('QC record added successfully', 'success');
        }
      } catch (err) {
        console.error('Error saving QC record:', err);
        toast('Error saving QC record', 'error');
      }
    },

    deleteQCRecord: async (recordId: string) => {
      if (!currentProject) return;
      try {
        await deleteQCRecord(currentProject.id, recordId);
        toast('QC record deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting QC record:', err);
        toast('Error deleting QC record', 'error');
      }
    },

    deleteReinforcement: async (reinforcementId: string) => {
      if (!currentProject) return;
      try {
        const { error } = await supabase
          .from('reinforcement_sets')
          .delete()
          .eq('id', reinforcementId);

        if (error) throw error;
        
        const updatedProject = {
          ...currentProject,
          reinforcements: currentProject.reinforcements?.filter(r => r.id !== reinforcementId) || []
        };
        
        await updateProject(currentProject.id, updatedProject);
        setCurrentProject(currentProject.id);
        
        toast('Reinforcement design deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting reinforcement design:', err);
        toast('Error deleting reinforcement design', 'error');
      }
    },

    closeOutProject: async (projectId?: string) => {
      const id = projectId ?? currentProject?.id;
      if (!id) return;
      const target =
        useProjectStore.getState().projects.find((p) => p.id === id) ?? currentProject;
      if (!target) return;
      try {
        const nextOrder = {
          ...(target.placementOrder ?? defaultPlacementOrder()),
          lifecycleStage: 'closed' as const,
          updatedAt: new Date().toISOString(),
        };
        await updateProject(id, { placementOrder: nextOrder });
        setCurrentProject(id);
        toast('Project marked as closed', 'success');
      } catch (err) {
        console.error('Failed to close out project', err);
        toast('Could not close out project', 'error');
      }
    },

    confirmDelete: async (type: 'project' | 'calculation', id: string) => {
      if (!id) return;
      const isProject = type === 'project';
      const ok = await confirm({
        title: isProject ? 'Delete project' : 'Delete calculation',
        message: isProject
          ? 'Delete this project? This cannot be undone.'
          : 'Delete this calculation? This cannot be undone.',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
        showWarningIcon: true,
      });
      if (!ok) return;
      try {
        if (type === 'project') {
          await deleteProject(id);
          setCurrentProject(null);
          setUi((s) => ({ ...s, showDetails: false, editing: false }));
          toast('Project deleted successfully', 'success');
          return;
        }

        // calculation
        if (!currentProject) return;
        await deleteCalculation(currentProject.id, id);
        toast('Calculation deleted successfully', 'success');
      } catch (err) {
        console.error('Delete failed', err);
        toast('Delete failed', 'error');
      }
    },

    startEditing: () => {
      setUi((s) => ({ ...s, editing: true }));
    },

    dismissCreatedPortal: () => {
      setUi((s) => ({ ...s, createdPortal: null }));
    },
  };

  function toast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    setUi(s => ({ ...s, toast: { show: true, msg: message, type } }));
    setTimeout(() => setUi(s => ({ ...s, toast: { ...s.toast, show: false } })), 1500);
  }

  return { projects, currentProject, ui, setUi, handlers };
}