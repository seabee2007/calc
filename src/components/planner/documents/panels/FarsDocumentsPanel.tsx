import { useEffect, useMemo, useState } from 'react';
import type { FieldAdjustmentRequest } from '../../../../types/fieldPlanner';
import { FAR_STATUSES } from '../../../../types/fieldPlanner';
import { nameFromMap } from '../../../../services/profileService';
import Button from '../../../ui/Button';
import CreateFieldAdjustmentModal from '../../../field/CreateFieldAdjustmentModal';
import FarDetailDrawer from '../../../field/FarDetailDrawer';
import FieldRecordStatusBadge from '../../../field/FieldRecordStatusBadge';
import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../../plannerTheme';
import { DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';
import { useDocumentsSearchParams } from '../useDocumentsSearchParams';

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

interface Props {
  projectId: string;
  items: FieldAdjustmentRequest[];
  nameMap: Map<string, string>;
  userId: string | undefined;
  isOwner: boolean;
  onReload: () => void;
  onProjectReload: () => void;
  embedTab?: 'fars';
}

export default function FarsDocumentsPanel({
  projectId,
  items,
  nameMap,
  userId,
  isOwner,
  onReload,
  onProjectReload,
  embedTab,
}: Props) {
  const { searchParams, mergeParams } = useDocumentsSearchParams(embedTab);
  const highlightId = searchParams.get('adjustment');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    mergeParams({ adjustment: id });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    mergeParams({ adjustment: null });
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
    <>
      <PanelActionRow
        action={
          <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
            New FAR
          </Button>
        }
      />

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

      {userId && (
        <CreateFieldAdjustmentModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={projectId}
          userId={userId}
          onCreated={() => {
            onReload();
            onProjectReload();
          }}
        />
      )}

      {userId && (
        <FarDetailDrawer
          adjustmentId={selectedId}
          userId={userId}
          isOwner={isOwner}
          onClose={closeDrawer}
          onUpdated={() => {
            onReload();
            onProjectReload();
          }}
        />
      )}

      <DocumentsPanelFootnote />
    </>
  );
}
