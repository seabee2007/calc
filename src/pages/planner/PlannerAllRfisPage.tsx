import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerAccessibleProjects } from '../../hooks/usePlannerAccessibleProjects';
import type { RfiRequest } from '../../types/fieldPlanner';
import { RFI_PRIORITIES } from '../../types/fieldPlanner';
import { fetchRfisForProjectIds, isRfiClosed } from '../../services/rfiService';
import { buildProfileNameMap, nameFromMap } from '../../services/profileService';
import { plannerRfiHref } from '../../utils/plannerRoutes';
import Button from '../../components/ui/Button';
import RfiDetailDrawer from '../../components/field/RfiDetailDrawer';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import PlannerHubRecordsLayout from '../../components/planner/PlannerHubRecordsLayout';
import { TaskPriorityBadge } from '../../components/planner/TaskStatusBadge';
import { PLANNER_LINK, PLANNER_MUTED, PLANNER_TABLE, PLANNER_TABLE_HEAD, PLANNER_TABLE_WRAPPER } from '../../components/planner/plannerTheme';

export default function PlannerAllRfisPage() {
  const { user, isOwner } = useAuth();
  const { projectIds, projectNames, loading: projectsLoading } = usePlannerAccessibleProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('rfi');
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const load = useCallback(async () => {
    if (projectIds.length === 0) {
      setRfis([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchRfisForProjectIds(projectIds);
      setRfis(list);
      const ids = [...new Set(list.map((r) => r.submittedBy))];
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
    return rfis.filter((r) => {
      if (projectFilter && r.projectId !== projectFilter) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter && r.urgency !== priorityFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rfis, search, priorityFilter, statusFilter, projectFilter]);

  const openRfis = filtered.filter((r) => !isRfiClosed(r.status));
  const closedRfis = filtered.filter((r) => isRfiClosed(r.status));

  const openDrawer = (id: string) => {
    setSelectedId(id);
    setSearchParams({ rfi: id }, { replace: true });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    setSearchParams({}, { replace: true });
  };

  const renderTable = (rows: RfiRequest[], empty: string) => {
    if (rows.length === 0) {
      return <p className={`${PLANNER_MUTED} py-2 text-sm`}>{empty}</p>;
    }
    return (
      <div className={PLANNER_TABLE_WRAPPER}>
        <table className={PLANNER_TABLE}>
          <thead className={PLANNER_TABLE_HEAD}>
            <tr>
              <th className="px-3 py-2">RFI #</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((rfi) => (
              <tr
                key={rfi.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  highlightId === rfi.id ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{rfi.displayNumber ?? '—'}</td>
                <td className="max-w-[140px] truncate px-3 py-2">
                  <Link
                    to={plannerRfiHref(rfi.projectId, rfi.id)}
                    className={`${PLANNER_LINK} font-medium`}
                    title="Open in project"
                  >
                    {projectNames.get(rfi.projectId) ?? 'Project'}
                  </Link>
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 font-medium">{rfi.title}</td>
                <td className="px-3 py-2">
                  <TaskPriorityBadge priority={rfi.urgency as 'Low' | 'Normal' | 'High' | 'Urgent'} />
                </td>
                <td className="px-3 py-2">{nameFromMap(nameMap, rfi.submittedBy, '—')}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {new Date(rfi.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <FieldRecordStatusBadge status={rfi.status} />
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => openDrawer(rfi.id)}>
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
      title="All RFIs"
      subtitle="Request for information across all your projects."
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
              placeholder="Search subject…"
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
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All priorities</option>
              {RFI_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="Pending Response">Pending Response</option>
              <option value="Need More Information">Need More Information</option>
              <option value="Answered">Answered</option>
              <option value="Closed">Closed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Open RFIs ({openRfis.length})
            </h3>
            {renderTable(openRfis, 'No open RFIs.')}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Closed RFIs ({closedRfis.length})
            </h3>
            {renderTable(closedRfis, 'No closed RFIs.')}
          </section>
        </>
      )}

      {user && (
        <RfiDetailDrawer
          rfiId={selectedId}
          userId={user.id}
          isOwner={isOwner}
          onClose={closeDrawer}
          onUpdated={() => void load()}
        />
      )}
    </PlannerHubRecordsLayout>
  );
}
