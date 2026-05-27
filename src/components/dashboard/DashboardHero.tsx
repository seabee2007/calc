import React from 'react';
import { FolderPlus, FileText, Wrench } from 'lucide-react';
import Button from '../ui/Button';
interface DashboardHeroProps {
  displayName: string;
  activeProjects: number;
  placementsToday: number;
  proposalsSent: number;
  onStartProject: () => void;
  onQuickQuote: () => void;
  onTools: () => void;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  displayName,
  activeProjects,
  placementsToday,
  proposalsSent,
  onStartProject,
  onQuickQuote,
  onTools,
}) => (
  <header className="rounded-xl border border-slate-700/80 bg-slate-900/95 dark:bg-slate-950/95 px-4 py-3 sm:px-5 sm:py-4 shadow-lg">
    <h1 className="text-lg sm:text-xl font-bold text-white">
      Welcome back, {displayName}
    </h1>
    <p className="text-sm text-slate-400 mt-1">
      {activeProjects} active project{activeProjects === 1 ? '' : 's'} •{' '}
      {placementsToday} placement{placementsToday === 1 ? '' : 's'} today •{' '}
      {proposalsSent} proposal{proposalsSent === 1 ? '' : 's'} sent
    </p>
    <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-3">
      <Button
        size="sm"
        className="!bg-cyan-600 hover:!bg-cyan-500 !text-white w-full sm:w-auto"
        onClick={onStartProject}
        icon={<FolderPlus className="h-4 w-4" />}
      >
        Start Project
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="!border-slate-600 !text-white hover:!bg-slate-700 w-full sm:w-auto"
        onClick={onQuickQuote}
        icon={<FileText className="h-4 w-4" />}
      >
        Quick Quote
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="!border-slate-600 !text-white hover:!bg-slate-700 w-full sm:w-auto"
        onClick={onTools}
        icon={<Wrench className="h-4 w-4" />}
      >
        Tools
      </Button>
    </div>
  </header>
);

export default DashboardHero;
