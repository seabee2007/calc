import React from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { Project } from '../../types';
import Button from '../ui/Button';
import { APP_SECTION_CARD } from '../../theme/appTheme';
import { buildDefaultProposalTitle } from '../../utils/proposalProjectImport';

interface ProposalProjectSourcePanelProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onImportProject: () => void;
  onClearProject: () => void;
  disabled?: boolean;
  autoSelected?: boolean;
}

const SECTION_CARD = APP_SECTION_CARD;
const SECTION_TITLE = 'text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4';

const ProposalProjectSourcePanel: React.FC<ProposalProjectSourcePanelProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onImportProject,
  onClearProject,
  disabled = false,
  autoSelected = false,
}) => {
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : undefined;

  return (
    <div className={SECTION_CARD} data-testid="proposal-project-source-panel">
      <h2 className={SECTION_TITLE}>Project source</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {selectedProject
          ? 'Client and project details are imported from the selected project. Edit below only what you need for this proposal.'
          : 'Create proposal manually or import details from an existing project.'}
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Import from existing project
        </label>
        <select
          value={selectedProjectId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value) onSelectProject(value);
          }}
          disabled={disabled}
          data-testid="proposal-project-selector"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Select a project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !selectedProjectId}
            onClick={onImportProject}
            icon={<FolderOpen size={16} />}
            data-testid="proposal-import-project-button"
          >
            Import project details
          </Button>
          {selectedProjectId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onClearProject}
              icon={<X size={16} />}
              data-testid="proposal-clear-project-button"
            >
              Clear imported project
            </Button>
          )}
        </div>

        {selectedProject && (
          <div
            className="rounded-md border border-cyan-200/60 dark:border-cyan-800/50 bg-cyan-50/40 dark:bg-cyan-950/20 p-3 text-sm"
            data-testid="proposal-imported-project-status"
          >
            <p className="font-medium text-gray-900 dark:text-white">{selectedProject.name}</p>
            {selectedProject.clientInfo?.clientName && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Client: {selectedProject.clientInfo.clientName}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {autoSelected
                ? 'Opened from project context — details auto-populated.'
                : `Default proposal title: ${buildDefaultProposalTitle(selectedProject.name)}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalProjectSourcePanel;
