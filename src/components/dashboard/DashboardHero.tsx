import React from 'react';
import { FolderPlus, FileText } from 'lucide-react';
import Button from '../ui/Button';

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
  <section className="rounded-xl border border-slate-700/80 bg-slate-900/95 px-4 py-4 shadow-lg dark:bg-slate-950/95 sm:px-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
          Today&apos;s Operations
        </p>

        <p className="mt-2 text-sm text-slate-400">
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
          className="!border-slate-600 !text-white hover:!bg-slate-700"
          onClick={onQuickQuote}
          icon={<FileText className="h-4 w-4" />}
        >
          Quick Quote
        </Button>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-3">
      <div className="rounded-lg bg-slate-800/80 p-3">
        <p className="text-xs text-slate-400">Active Projects</p>
        <p className="mt-1 text-2xl font-bold text-white">{activeProjects}</p>
      </div>

      <div className="rounded-lg bg-slate-800/80 p-3">
        <p className="text-xs text-slate-400">Placements Today</p>
        <p className="mt-1 text-2xl font-bold text-white">{placementsToday}</p>
      </div>

      <div className="rounded-lg bg-slate-800/80 p-3">
        <p className="text-xs text-slate-400">Proposals Sent</p>
        <p className="mt-1 text-2xl font-bold text-white">{proposalsSent}</p>
      </div>
    </div>
  </section>
);

export default DashboardHero;
