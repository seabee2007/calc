import React from 'react';
import { FolderPlus, FileText } from 'lucide-react';
import Button from '../ui/Button';
import {
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_PANEL,
  OPS_PANEL_INNER,
  OPS_TITLE,
} from './opsTheme';

interface DashboardHeroProps {
  activeProjects: number;
  placementsToday: number;
  proposalsSent: number;
  onStartProject: () => void;
  onQuickQuote: () => void;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  activeProjects,
  placementsToday,
  proposalsSent,
  onStartProject,
  onQuickQuote,
}) => (
  <section className={`rounded-xl px-4 py-4 shadow-lg sm:px-5 ${OPS_PANEL}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400">
          Today&apos;s Operations
        </p>

        <p className={`mt-2 text-sm ${OPS_MUTED}`}>
          What needs attention, what is scheduled, and what is ready to move.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          className="!bg-cyan-600 !text-white hover:!bg-cyan-500"
          onClick={onStartProject}
          icon={<FolderPlus className="h-4 w-4" />}
        >
          Start Project
        </Button>

        <Button
          size="sm"
          variant="outline"
          className={OPS_OUTLINE_BTN}
          onClick={onQuickQuote}
          icon={<FileText className="h-4 w-4" />}
        >
          Quick Quote
        </Button>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-3">
      <div className={`${OPS_PANEL_INNER} p-3`}>
        <p className={`text-xs ${OPS_MUTED}`}>Active Projects</p>
        <p className={`mt-1 text-2xl font-bold ${OPS_TITLE}`}>{activeProjects}</p>
      </div>

      <div className={`${OPS_PANEL_INNER} p-3`}>
        <p className={`text-xs ${OPS_MUTED}`}>Placements Today</p>
        <p className={`mt-1 text-2xl font-bold ${OPS_TITLE}`}>{placementsToday}</p>
      </div>

      <div className={`${OPS_PANEL_INNER} p-3`}>
        <p className={`text-xs ${OPS_MUTED}`}>Proposals Sent</p>
        <p className={`mt-1 text-2xl font-bold ${OPS_TITLE}`}>{proposalsSent}</p>
      </div>
    </div>
  </section>
);

export default DashboardHero;
