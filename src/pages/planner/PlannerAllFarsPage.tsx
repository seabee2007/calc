import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerAccessibleProjects } from '../../hooks/usePlannerAccessibleProjects';
import type { FieldAdjustmentRequest } from '../../types/fieldPlanner';
import { FAR_STATUSES } from '../../types/fieldPlanner';
import { fetchAdjustmentsForProjectIds } from '../../services/fieldAdjustmentService';
import { buildProfileNameMap, nameFromMap } from '../../services/profileService';
import { plannerAdjustmentHref } from '../../utils/plannerRoutes';
import Button from '../../components/ui/Button';
import FarDetailDrawer from '../../components/field/FarDetailDrawer';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import PlannerHubRecordsLayout from '../../components/planner/PlannerHubRecordsLayout';
import { PLANNER_LINK, PLANNER_MUTED, PLANNER_TABLE, PLANNER_TABLE_HEAD, PLANNER_TABLE_WRAPPER } from '../../components/planner/plannerTheme';

type SectionKey =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Needs More Information'
  | 'Convert to Change Order';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'Pending', label: 'Pending' },
  { key: 'Needs More Information', label: 'Needs more info' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
  { key: 'Convert to Change Order', label: 'Convert to change order' },
];

export default function PlannerAllFarsPage() {
  const { user, isOwner } = useAuth();
  const { projectIds, projectNames, loading: projectsLoading } = usePlannerAccessibleProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('adjustment');
  const [items, setItems] = useState<FieldAdjustmentRequest[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const load = useCallback(async () => {
    if (projectIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchAdjustmentsForProjectIds(projectIds);
      setItems(list);
      const ids = [...new Set(list.map((a) => a.submittedBy))];
      setNameMap(await buildProfileNameMap(ids));
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    if (!projectsLoading) void load();
  }, [load, projectsLoading]);

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (projectFilter && a.projectId !== projectFilter) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter, projectFilter]);

  const byStatus = (status: SectionKey) => filtered.filter((a) => a.status === status);

  const openDrawer = (id: string) => {
    setSelectedId(id);
    setSearchParams({ adjustment: id }, { replace: true });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    setSearchParams({}, { replace: true });
  };

  const impactSummary = (adj: FieldAdjustmentRequest) => {
    const parts: string[] = [];
    if (adj.potentialCostImpact) parts.push('Cost');
    if (adj.potentialScheduleImpact) parts.push('Schedule');
    if (adj.impactSafety) parts.push('Safety');
    if (adj.impactQuality) parts.push('Quality');
    return parts.length ? parts.join(', ') : '—';
  };

  const renderTable = (rows: FieldAdjustmentRequest[], empty: string) => {
    if (rows.length === 0) {
      return <p className={`${PLANNER_MUTED} py-2 text-sm`}>{empty}</p>;
    }
    return (
      <div className={PLANNER_TABLE_WRAPPER}>
        <table className={PLANNER_TABLE}>
          <thead className={PLANNER_TABLE_HEAD}>
            <tr>
              <th className="px-3 py-2">Request #</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Impacts</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((adj) => (
              <tr
                key={adj.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  highlightId === adj.id ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{adj.displayNumber ?? '—'}</td>
                <td className="max-w-[140px] truncate px-3 py-2">
                  <Link
                    to={plannerAdjustmentHref(adj.projectId, adj.id)}
                    className={`${PLANNER_LINK} font-medium`}
                  >
                    {projectNames.get(adj.projectId) ?? 'Project'}
                  </Link>
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 font-medium">{adj.title}</td>
                <td className="px-3 py-2">{nameFromMap(nameMap, adj.submittedBy, '—')}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{impactSummary(adj)}</td>
                <td className="px-3 py-2">
                  <FieldRecordStatusBadge status={adj.status} />
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => openDrawer(adj.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <PlannerHubRecordsLayout
      title="All field adjustments (FARs)"
      subtitle="Field adjustment requests across all your projects."
    >
      {(loading || projectsLoading) && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}

      {!loading && !projectsLoading && projectIds.length === 0 && (
        <p className={PLANNER_MUTED}>No projects available.</p>
      )}

      {!loading && !projectsLoading && projectIds.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="max-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All projects</option>
              {[...projectNames.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All statuses</option>
              {FAR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {SECTIONS.map(({ key, label }) => {
            const rows = byStatus(key);
            if (statusFilter && statusFilter !== key) return null;
            return (
              <section key={key} className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label} ({rows.length})
                </h3>
                {renderTable(rows, `No ${label.toLowerCase()} requests.`)}
              </section>
            );
          })}
        </>
      )}

      {user && (
        <FarDetailDrawer
          adjustmentId={selectedId}
          userId={user.id}
          isOwner={isOwner}
          onClose={closeDrawer}
          onUpdated={() => void load()}
        />
      )}
    </PlannerHubRecordsLayout>
  );
}
