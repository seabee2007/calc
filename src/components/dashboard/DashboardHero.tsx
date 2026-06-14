import React from 'react';
import { FolderPlus, FileText } from 'lucide-react';
import Button from '../ui/Button';
import {
  OPS_HERO_BODY,
  OPS_HERO_CARD,
  OPS_HERO_LABEL,
  OPS_HERO_STAT_INNER,
  OPS_HERO_STAT_LABEL,
  OPS_HERO_STAT_VALUE,
  OPS_OUTLINE_BTN,
} from './opsTheme';

interface DashboardHeroProps {
  activeProjects: number;
  placementsToday?: number;
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
  <section className={`rounded-xl px-4 py-4 sm:px-5 ${OPS_HERO_CARD}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${OPS_HERO_LABEL}`}>
          Today&apos;s Operations
        </p>

        <p className={`mt-2 text-sm ${OPS_HERO_BODY}`}>
          What needs attention, what is scheduled, and what is ready to move.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="accent"
          size="sm"
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

    <div className={`mt-4 grid gap-3 ${placementsToday !== undefined ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <div className={`${OPS_HERO_STAT_INNER} p-3`}>
        <p className={`text-xs ${OPS_HERO_STAT_LABEL}`}>Active Projects</p>
        <p className={`mt-1 text-2xl font-bold ${OPS_HERO_STAT_VALUE}`}>{activeProjects}</p>
      </div>

      {placementsToday !== undefined ? (
        <div className={`${OPS_HERO_STAT_INNER} p-3`}>
          <p className={`text-xs ${OPS_HERO_STAT_LABEL}`}>Placements Today</p>
          <p className={`mt-1 text-2xl font-bold ${OPS_HERO_STAT_VALUE}`}>{placementsToday}</p>
        </div>
      ) : null}

      <div className={`${OPS_HERO_STAT_INNER} p-3`}>
        <p className={`text-xs ${OPS_HERO_STAT_LABEL}`}>Proposals Sent</p>
        <p className={`mt-1 text-2xl font-bold ${OPS_HERO_STAT_VALUE}`}>{proposalsSent}</p>
      </div>
    </div>
  </section>
);

export default DashboardHero;
