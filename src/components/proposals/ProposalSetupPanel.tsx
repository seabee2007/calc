import React from 'react';
import type { Project } from '../../types';
import Button from '../ui/Button';
import {
  FORM_LABEL,
  FORM_TEXTAREA,
  PREMIUM_PANEL,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';

interface ProposalSetupPanelProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  proposalTitle: string;
  onProposalTitleChange: (title: string) => void;
  onAutoGenerateTitle: () => void;
  disabled?: boolean;
  showProjectImport?: boolean;
}

const SECTION_CARD = `${PREMIUM_PANEL} p-4 sm:p-5`;
const SECTION_TITLE = `text-lg font-semibold ${TEXT_FOREGROUND}`;
const INPUT_CLASS = FORM_TEXTAREA;

const ProposalSetupPanel: React.FC<ProposalSetupPanelProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  proposalTitle,
  onProposalTitleChange,
  onAutoGenerateTitle,
  disabled = false,
  showProjectImport = true,
}) => {
  const titleControls = (
    <div className="min-w-0">
      <label className={FORM_LABEL} htmlFor="proposal-title-input">
        Proposal title
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="proposal-title-input"
          type="text"
          placeholder="Example: Slab Replacement Proposal"
          value={proposalTitle}
          onChange={(event) => onProposalTitleChange(event.target.value)}
          disabled={disabled}
          className={`${INPUT_CLASS} min-w-0 flex-1`}
          data-testid="proposal-title-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAutoGenerateTitle}
          disabled={disabled}
          className="w-full shrink-0 whitespace-nowrap sm:w-auto"
          data-testid="proposal-auto-generate-title-button"
        >
          Auto Generate
        </Button>
      </div>
    </div>
  );

  return (
    <div className={SECTION_CARD} data-testid="proposal-setup-panel">
      <div className="mb-4">
        <h2 className={SECTION_TITLE}>
          {showProjectImport
            ? 'Import a project or create proposal title'
            : 'Proposal title'}
        </h2>
        <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
          {showProjectImport
            ? 'Start from a project estimate, or create a proposal title manually.'
            : 'Update the proposal title for this draft.'}
        </p>
      </div>

      {showProjectImport ? (
        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] lg:items-end"
          data-testid="proposal-setup-controls"
        >
          <div className="min-w-0">
            <label className={FORM_LABEL} htmlFor="proposal-project-selector">
              Project
            </label>
            <select
              id="proposal-project-selector"
              value={selectedProjectId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                onSelectProject(value || null);
              }}
              disabled={disabled}
              data-testid="proposal-project-selector"
              className={INPUT_CLASS}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          {titleControls}
        </div>
      ) : (
        titleControls
      )}
    </div>
  );
};

export default ProposalSetupPanel;
