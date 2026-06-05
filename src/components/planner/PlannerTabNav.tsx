import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { PLANNER_NAV_TAB_LABEL, PLANNER_NAV_TAB_LABEL_ACTIVE } from './plannerTheme';

const TABS = [
  { to: 'estimate', label: 'Estimate' },
  { to: 'board', label: 'Board' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'documents', label: 'Documents' },
  { to: 'rfis', label: 'RFIs' },
  { to: 'adjustments', label: 'FARs' },
  { to: 'change-orders', label: 'Change orders' },
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
          end={to === 'board' || to === 'estimate'}
          className={({ isActive }) =>
            [
              'shrink-0 border-b-2 px-4 py-3 transition-colors',
              isActive
                ? `border-cyan-600 dark:border-cyan-400 ${PLANNER_NAV_TAB_LABEL_ACTIVE}`
                : `border-transparent hover:text-gray-900 dark:hover:text-slate-200 ${PLANNER_NAV_TAB_LABEL}`,
            ].join(' ')
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
