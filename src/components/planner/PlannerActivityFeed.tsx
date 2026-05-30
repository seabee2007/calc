import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { buildProjectActivityFeed } from '../../services/fieldActivityService';
import type { FieldActivityItem } from '../../types/fieldPlanner';
import {
  PLANNER_ACTIVITY_STRIP,
  PLANNER_ACTIVITY_SUMMARY,
  PLANNER_ACTIVITY_TIME,
  PLANNER_ACTIVITY_TITLE,
  PLANNER_MUTED,
} from './plannerTheme';

interface PlannerActivityFeedProps {
  projectId: string;
  limit?: number;
}

export default function PlannerActivityFeed({ projectId, limit = 30 }: PlannerActivityFeedProps) {
  const [items, setItems] = useState<FieldActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    void buildProjectActivityFeed(projectId, limit)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [projectId, limit]);

  const feedBody = (
    <div className="flex flex-col gap-2 overflow-y-auto p-3">
      {loading && <p className={PLANNER_MUTED}>Loading activity…</p>}
      {!loading && items.length === 0 && (
        <p className={PLANNER_MUTED}>No recent activity on this project.</p>
      )}
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.href}
          className={`block rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/80 ${PLANNER_ACTIVITY_STRIP}`}
        >
          <p className={`text-sm ${PLANNER_ACTIVITY_SUMMARY}`}>{item.summary}</p>
          <p className={`mt-1 ${PLANNER_ACTIVITY_TIME}`}>
            {item.employeeName} · {new Date(item.timestamp).toLocaleString()}
          </p>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <aside className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className={`flex items-center gap-2 ${PLANNER_ACTIVITY_TITLE}`}>
            <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Activity
          </h3>
        </div>
        {feedBody}
      </aside>

      <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white"
        >
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-600" />
            Activity
          </span>
          {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {mobileOpen && <div className="max-h-64">{feedBody}</div>}
      </div>
    </>
  );
}
