import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import type { RfiRequest } from '../../types/fieldPlanner';
import { RFI_PRIORITIES } from '../../types/fieldPlanner';
import { fetchRfisForProject, isRfiClosed } from '../../services/rfiService';
import { buildProfileNameMap, nameFromMap } from '../../services/profileService';
import Button from '../../components/ui/Button';
import CreateRfiModal from '../../components/field/CreateRfiModal';
import RfiDetailDrawer from '../../components/field/RfiDetailDrawer';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import { TaskPriorityBadge } from '../../components/planner/TaskStatusBadge';
import {
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../../components/planner/plannerTheme';

export default function PlannerRFIsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('rfi');
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    const list = await fetchRfisForProject(projectId);
    setRfis(list);
    const ids = [...new Set(list.map((r) => r.submittedBy))];
    setNameMap(await buildProfileNameMap(ids));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const filtered = useMemo(() => {
    return rfis.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter && r.urgency !== priorityFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rfis, search, priorityFilter, statusFilter]);

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
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={PLANNER_SECTION_TITLE}>RFIs</h2>
        <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
          New RFI
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
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

      {user && (
        <CreateRfiModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={projectId}
          userId={user.id}
          onCreated={() => {
            void load();
            void reload();
          }}
        />
      )}

      {user && (
        <RfiDetailDrawer
          rfiId={selectedId}
          userId={user.id}
          isOwner={isOwner}
          onClose={closeDrawer}
          onUpdated={() => {
            void load();
            void reload();
          }}
        />
      )}
    </div>
  );
}
