import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import {
  getWorkflowProjectId,
  navigateToProjectDetail,
  type WorkflowLocationState,
} from '../../utils/workflow';
import { useProjectStore } from '../../store';
import Button from '../ui/Button';

interface WorkflowProjectNavProps {
  className?: string;
}

/**
 * Back navigation when a tool page is tied to a project (workflow or next-action links).
 */
const WorkflowProjectNav: React.FC<WorkflowProjectNavProps> = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as WorkflowLocationState | null;
  const projectId = getWorkflowProjectId(location.search, state);
  const { projects } = useProjectStore();

  if (!projectId) return null;

  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name?.trim() || 'Project';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 ${className}`}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigateToProjectDetail(navigate, projectId)}
        className="border-slate-500/80 bg-slate-800/60 text-slate-100 hover:bg-slate-700/80 hover:text-white dark:border-slate-500 dark:bg-slate-800/60"
      >
        <span className="truncate max-w-[14rem] sm:max-w-[20rem]">
          Back to {projectName}
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<FolderKanban className="h-4 w-4" />}
        onClick={() => navigate('/projects')}
        className="text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60"
      >
        All projects
      </Button>
    </div>
  );
};

export default WorkflowProjectNav;
