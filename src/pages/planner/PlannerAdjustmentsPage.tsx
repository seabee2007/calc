import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import type { FieldAdjustmentRequest } from '../../types/fieldPlanner';
import { FAR_STATUSES } from '../../types/fieldPlanner';
import { fetchAdjustmentsForProject } from '../../services/fieldAdjustmentService';
import { buildProfileNameMap, nameFromMap } from '../../services/profileService';
import Button from '../../components/ui/Button';
import CreateFieldAdjustmentModal from '../../components/field/CreateFieldAdjustmentModal';
import FarDetailDrawer from '../../components/field/FarDetailDrawer';
import FieldRecordStatusBadge from '../../components/field/FieldRecordStatusBadge';
import {
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
} from '../../components/planner/plannerTheme';

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

export default function PlannerAdjustmentsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('adjustment');
  const [items, setItems] = useState<FieldAdjustmentRequest[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    const list = await fetchAdjustmentsForProject(projectId);
    setItems(list);
    const ids = [...new Set(list.map((a) => a.submittedBy))];
    setNameMap(await buildProfileNameMap(ids));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Request #</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Impacts</th>
              <th className="px-3 py-2">Schedule</th>
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
                <td className="max-w-[200px] truncate px-3 py-2 font-medium">{adj.title}</td>
                <td className="px-3 py-2">{nameFromMap(nameMap, adj.submittedBy, '—')}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{impactSummary(adj)}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-slate-400">
                  {adj.scheduleImpact ?? '—'}
                </td>
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
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={PLANNER_SECTION_TITLE}>Field adjustments (FARs)</h2>
        <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
          New request
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
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

      {user && (
        <CreateFieldAdjustmentModal
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
        <FarDetailDrawer
          adjustmentId={selectedId}
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
