import React, { useEffect, useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import WorkflowStepHeader from '../workflow/WorkflowStepHeader';
import {
  getWorkflowProjectId,
  type WorkflowLocationState,
} from '../../utils/workflow';
import { projectSaveErrorMessage, useProjectStore } from '../../store';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import Select from '../ui/Select';
import ProjectForm, { type ProjectFormData } from '../projects/ProjectForm';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';
import { PREMIUM_PANEL } from '../../theme/appTheme';
import AppPage from '../ui/AppPage';
import PageHeader from '../ui/PageHeader';
import CalculatorToolNotice, { type CalculatorToolKind } from './CalculatorToolNotice';

const PAGE_HEADER_CLASS =
  '[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300';

interface ProjectCalculatorShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  toolKind?: CalculatorToolKind;
}

const ProjectCalculatorShell: React.FC<ProjectCalculatorShellProps> = ({
  title,
  description,
  children,
  footer,
  toolKind = 'helper',
}) => {
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  const { projects, currentProject, setCurrentProject, addProject } = useProjectStore();
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const projectId = workflowState?.projectId ?? workflowProjectId;
    if (projectId) setCurrentProject(projectId);
  }, [workflowState, workflowProjectId, setCurrentProject]);

  const handleCreateProject = async (data: ProjectFormData) => {
    setCreateError(null);
    try {
      const newProject = await addProject({
        name: data.name,
        description: data.description,
        jobsiteAddress: data.jobsiteAddress,
        clientInfo: data.clientInfo,
      });
      setCurrentProject(newProject.id);
      setShowCreateProjectModal(false);
    } catch (err) {
      console.error('Error creating project:', err);
      setCreateError(projectSaveErrorMessage(err));
    }
  };

  return (
    <AppPage
      className="w-full !max-w-none pt-6"
      data-testid="calculator-tool-page"
      header={
        <PageHeader
          title={title}
          subtitle={description}
          className={PAGE_HEADER_CLASS}
        />
      }
    >
      <WorkflowStepHeader />
      <CalculatorToolNotice kind={toolKind} projectId={currentProject?.id ?? workflowProjectId} />

      <div className={`mb-6 p-4 ${PREMIUM_PANEL}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              label="Select Project"
              options={[
                { value: '', label: 'Select a project...' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={currentProject?.id || ''}
              onChange={setCurrentProject}
              fullWidth
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowCreateProjectModal(true)}
            icon={<Plus size={18} />}
            className="whitespace-nowrap dark:text-white hover:bg-slate-600/80 hover:text-white"
          >
            New Project
          </Button>
        </div>
        {!currentProject && (
          <p className="mt-4 flex items-center text-sm text-amber-600 dark:text-amber-400">
            <FolderOpen className="mr-2 h-4 w-4" />
            Select a project to save estimates
          </p>
        )}
        {currentProject && hasProjectJobsite(currentProject.jobsiteAddress) && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Jobsite: {formatUSAddress(currentProject.jobsiteAddress!)}
          </p>
        )}
      </div>

      {children}

      {footer}

      {createError && (
        <Toast
          id="calculator-create-project"
          title="Could not create project"
          message={createError}
          type="error"
          onClose={() => setCreateError(null)}
        />
      )}

      {showCreateProjectModal && (
        <ProjectForm
          onSubmit={handleCreateProject}
          onCancel={() => {
            setShowCreateProjectModal(false);
            setCreateError(null);
          }}
          isModal
          hidePourDate
        />
      )}
    </AppPage>
  );
};

export default ProjectCalculatorShell;
