import React from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { Project } from '../../types';
import Button from '../ui/Button';
import {
  FORM_TEXTAREA,
  PREMIUM_INNER_PANEL,
  PREMIUM_PANEL,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';
import { buildDefaultProposalTitle } from '../../utils/proposalProjectImport';

interface ProposalProjectSourcePanelProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onImportProject: () => void;
  onClearProject: () => void;
  disabled?: boolean;
  autoSelected?: boolean;
  importSummary?: { label: string; value: string }[];
}

const SECTION_CARD = `${PREMIUM_PANEL} p-5 sm:p-6`;
const SECTION_TITLE = `text-lg font-semibold ${TEXT_FOREGROUND}`;
const INPUT_CLASS = `${FORM_TEXTAREA} border-slate-700/70 bg-slate-950/50 text-slate-100`;

const ProposalProjectSourcePanel: React.FC<ProposalProjectSourcePanelProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onImportProject,
  onClearProject,
  disabled = false,
  autoSelected = false,
  importSummary = [],
}) => {
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : undefined;

  return (
    <div className={SECTION_CARD} data-testid="proposal-project-source-panel">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={SECTION_TITLE}>Project Source</h2>
          <p className={`mt-1 max-w-3xl text-sm ${TEXT_MUTED}`}>
            Start from a blank proposal or import the current estimate, activity scope, labor,
            materials, equipment, and markup totals.
          </p>
        </div>
        {selectedProjectId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onClearProject}
            icon={<X size={16} />}
            data-testid="proposal-clear-project-button"
          >
            Clear source
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Project
        </label>
        <select
          value={selectedProjectId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value) onSelectProject(value);
          }}
          disabled={disabled}
          data-testid="proposal-project-selector"
          className={INPUT_CLASS}
        >
          <option value="">Select a project…</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant={selectedProjectId ? 'accent' : 'outline'}
            size="sm"
            disabled={disabled || !selectedProjectId}
            onClick={onImportProject}
            icon={<FolderOpen size={16} />}
            data-testid="proposal-import-project-button"
          >
            Import Current Estimate
          </Button>
          {!selectedProjectId && (
            <p className="text-xs text-slate-500">
              Select a project to import estimate data.
            </p>
          )}
        </div>

        {selectedProject && (
          <div
            className={`${PREMIUM_INNER_PANEL} p-4 text-sm`}
            data-testid="proposal-imported-project-status"
          >
            <p className="font-medium text-slate-100">{selectedProject.name}</p>
            {selectedProject.clientInfo?.clientName && (
              <p className="mt-1 text-slate-300">
                Client: {selectedProject.clientInfo.clientName}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {autoSelected
                ? 'Opened from project context — details auto-populated.'
                : `Default proposal title: ${buildDefaultProposalTitle(selectedProject.name)}`}
            </p>
          </div>
        )}

        <div className={`${PREMIUM_INNER_PANEL} p-4`} data-testid="proposal-import-summary">
          {importSummary.length === 0 ? (
            <div>
              <p className="font-medium text-slate-100">Nothing imported yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Choose a project and import the current estimate to populate proposal pricing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {importSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 font-semibold text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalProjectSourcePanel;
