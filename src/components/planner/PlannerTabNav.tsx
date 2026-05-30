import React from 'react';
import { NavLink, useParams } from 'react-router-dom';

const TABS = [
  { to: 'board', label: 'Board' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'documents', label: 'Documents' },
  { to: 'rfis', label: 'RFIs' },
  { to: 'adjustments', label: 'Field Adjustments' },
  { to: 'team', label: 'Team' },
] as const;

export default function PlannerTabNav() {
  const { projectId } = useParams<{ projectId: string }>();
  const base = `/projects/${projectId}/planner`;

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6"
      aria-label="Project planner"
    >
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={`${base}/${to}`}
          end={to === 'board'}
          className={({ isActive }) =>
            [
              'shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
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
  );
}
