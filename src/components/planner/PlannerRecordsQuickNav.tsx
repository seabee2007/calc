import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  plannerAllChangeOrdersHref,
  plannerAllFarsHref,
  plannerAllRfisHref,
} from '../../utils/plannerRoutes';
import { PLANNER_LINK } from './plannerTheme';

function QuickDivider() {
  return (
    <span className="text-gray-300 dark:text-slate-600" aria-hidden>
      |
    </span>
  );
}

function quickLinkClass({ isActive }: { isActive: boolean }) {
  return [PLANNER_LINK, isActive ? 'font-semibold underline-offset-2' : ''].filter(Boolean).join(' ');
}

/** | RFIs | FARs | COs | in the planner hub / all-records page header. */
export default function PlannerRecordsQuickNav() {
  const { isOwner } = useAuth();

  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 text-sm lg:shrink-0 lg:justify-end"
      aria-label="Quick links to field records"
    >
      <QuickDivider />
      <NavLink to={plannerAllRfisHref()} className={quickLinkClass} end>
        RFIs
      </NavLink>
      <QuickDivider />
      <NavLink to={plannerAllFarsHref()} className={quickLinkClass} end>
        FARs
      </NavLink>
      {isOwner && (
        <>
          <QuickDivider />
          <NavLink to={plannerAllChangeOrdersHref()} className={quickLinkClass} end>
            COs
          </NavLink>
        </>
      )}
      <QuickDivider />
    </nav>
  );
}
