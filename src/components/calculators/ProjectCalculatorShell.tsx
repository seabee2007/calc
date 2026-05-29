import React, { useEffect, useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import WorkflowStepHeader from '../workflow/WorkflowStepHeader';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  type WorkflowLocationState,
} from '../../utils/workflow';
import { useProjectStore } from '../../store';
import Button from '../ui/Button';
import Select from '../ui/Select';
import ProjectForm, { type ProjectFormData } from '../projects/ProjectForm';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';

interface ProjectCalculatorShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const ProjectCalculatorShell: React.FC<ProjectCalculatorShellProps> = ({
  title,
  description,
  children,
  footer,
}) => {
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  const { projects, currentProject, setCurrentProject, addProject } = useProjectStore();
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

  useEffect(() => {
    const projectId = workflowState?.projectId ?? workflowProjectId;
    if (projectId) setCurrentProject(projectId);
  }, [workflowState, workflowProjectId, setCurrentProject]);

  const handleCreateProject = (data: ProjectFormData) => {
    addProject({
      name: data.name,
      description: data.description,
      jobsiteAddress: data.jobsiteAddress,
      clientInfo: data.clientInfo,
    });
    setShowCreateProjectModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <WorkflowStepHeader />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
          {title}
        </h1>
        <p className="text-white text-lg font-semibold drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] mt-2">
          {description}
        </p>
      </div>

      <div className="mb-6 bg-white/90 dark:bg-gray-800 backdrop-blur-sm p-4 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
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
            className="whitespace-nowrap dark:text-white"
          >
            New Project
          </Button>
        </div>
        {!currentProject && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-400 flex items-center">
            <FolderOpen className="h-4 w-4 mr-2" />
            Select a project to save estimates
          </p>
        )}
        {currentProject && hasProjectJobsite(currentProject.jobsiteAddress) && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Jobsite: {formatUSAddress(currentProject.jobsiteAddress)}
          </p>
        )}
      </div>

      {children}

      {footer}

      {showCreateProjectModal && (
        <ProjectForm
          onSubmit={handleCreateProject}
          onCancel={() => setShowCreateProjectModal(false)}
          isModal
          hidePourDate
        />
      )}
    </div>
  );
};

export default ProjectCalculatorShell;
