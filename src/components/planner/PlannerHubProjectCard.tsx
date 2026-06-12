import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { FOCUS_RING, PREMIUM_PANEL, TEXT_FOREGROUND, TEXT_MUTED, TEXT_SUBTLE } from '../../theme/appTheme';
import { plannerBoardHref } from '../../utils/plannerRoutes';

export interface PlannerHubProjectCardData {
  id: string;
  name: string;
  statusLabel: string;
  nextActionLabel?: string;
  metadataLine?: string;
}

interface PlannerHubProjectCardProps {
  project: PlannerHubProjectCardData;
  onOpen?: (projectId: string) => void;
}

export default function PlannerHubProjectCard({
  project,
  onOpen,
}: PlannerHubProjectCardProps) {
  return (
    <Link
      to={plannerBoardHref(project.id)}
      onClick={() => onOpen?.(project.id)}
      data-testid={`planner-hub-project-${project.id}`}
      aria-label={`Open plan for ${project.name}`}
      className={[
        `group flex h-full flex-col p-5 ${PREMIUM_PANEL}`,
        'hover:-translate-y-0.5 hover:border-cyan-500/45 hover:shadow-lg hover:shadow-cyan-500/10 dark:hover:border-cyan-500/40',
        FOCUS_RING,
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10"
          aria-hidden
        >
          <FolderKanban className="h-5 w-5 text-cyan-700 dark:text-cyan-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2
              className={`truncate text-base font-bold sm:text-lg ${TEXT_FOREGROUND}`}
              title={project.name}
            >
              {project.name}
            </h2>
            <span
              className={`shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300`}
            >
              {project.statusLabel}
            </span>
          </div>

          {project.metadataLine ? (
            <p className={`mt-1 truncate text-sm ${TEXT_MUTED}`}>{project.metadataLine}</p>
          ) : null}

          {project.nextActionLabel ? (
            <p className={`mt-3 text-xs ${TEXT_SUBTLE}`}>
              Next:{' '}
              <span className={`font-medium ${TEXT_FOREGROUND}`}>{project.nextActionLabel}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <span className={`text-sm font-medium text-cyan-700 dark:text-cyan-400`}>Open plan</span>
        <span
          className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 transition-transform group-hover:translate-x-0.5 dark:text-cyan-400"
          aria-hidden
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export function PlannerHubProjectCardSkeleton() {
  return (
    <div
      data-testid="planner-hub-card-skeleton"
      className="flex h-full animate-pulse flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-700/70 dark:bg-slate-900/90"
      aria-hidden
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-5 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="mt-5 border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
