import React, { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Download, MoreHorizontal } from 'lucide-react';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { exportPlannerBoardJson, exportPlannerTasksCsv } from '../../utils/plannerExport';
import UserAvatar from './UserAvatar';
import Button from '../ui/Button';

const TABS = [
  { to: 'board', label: 'Board' },
  { to: 'charts', label: 'Charts' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'documents', label: 'Documents' },
  { to: 'rfis', label: 'RFIs' },
  { to: 'adjustments', label: 'Adjustments' },
  { to: 'team', label: 'Team' },
] as const;

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function PlannerPlanHeader() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, bundle, team, isOwner } = usePlannerProject();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!project || !projectId) return null;

  const base = `/projects/${projectId}/planner`;
  const visibleTeam = team.slice(0, 4);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-cyan-700 text-sm font-bold text-white"
            aria-hidden
          >
            {projectInitials(project.name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-slate-400">
              {project.statusLabel} · {project.locationLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {visibleTeam.map((m) => (
              <UserAvatar
                key={m.id}
                name={m.displayName ?? 'Member'}
                size="md"
                className="ring-2 ring-white dark:ring-slate-900"
              />
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(`${base}/team`)}>
            Members
          </Button>
          {isOwner && bundle && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-slate-300" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10"
                    aria-label="Close"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => {
                        exportPlannerTasksCsv(bundle, project.name);
                        setMenuOpen(false);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => {
                        exportPlannerBoardJson(bundle, project.name);
                        setMenuOpen(false);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Export JSON
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <nav
        className="flex gap-0 overflow-x-auto border-t border-slate-100 px-2 dark:border-slate-800 sm:px-4"
        aria-label="Plan views"
      >
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={`${base}/${to}`}
            end={to === 'board'}
            className={({ isActive }) =>
              [
                'shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-300'
                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
