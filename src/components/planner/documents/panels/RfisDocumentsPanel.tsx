import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RfiRequest } from '../../../../types/fieldPlanner';
import { RFI_PRIORITIES } from '../../../../types/fieldPlanner';
import { isRfiClosed } from '../../../../services/rfiService';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import PlannerBuilderDocumentRow from '../../PlannerBuilderDocumentRow';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import { nameFromMap } from '../../../../services/profileService';
import Button from '../../../ui/Button';
import CreateRfiModal from '../../../field/CreateRfiModal';
import RfiDetailDrawer from '../../../field/RfiDetailDrawer';
import FieldRecordStatusBadge from '../../../field/FieldRecordStatusBadge';
import { TaskPriorityBadge } from '../../TaskStatusBadge';
import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../../plannerTheme';
import { DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';
import { useDocumentsSearchParams } from '../useDocumentsSearchParams';

interface Props {
  projectId: string;
  rfis: RfiRequest[];
  builderRfiDrafts: ProjectDocumentRow[];
  nameMap: Map<string, string>;
  userId: string | undefined;
  isOwner: boolean;
  onReload: () => void;
  onProjectReload: () => void;
  /** When set, drawer/search params keep this documents tab. */
  embedTab?: 'rfis';
}

export default function RfisDocumentsPanel({
  projectId,
  rfis,
  builderRfiDrafts,
  nameMap,
  userId,
  isOwner,
  onReload,
  onProjectReload,
  embedTab,
}: Props) {
  const navigate = useNavigate();
  const { searchParams, mergeParams } = useDocumentsSearchParams(embedTab);
  const highlightId = searchParams.get('rfi');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    mergeParams({ rfi: id });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    mergeParams({ rfi: null });
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
    <>
      <PanelActionRow
        action={
          <Button variant="accent" size="sm" onClick={() => setCreateOpen(true)}>
            New RFI
          </Button>
        }
      />

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

      <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                contractBuilderToolHref(projectId, undefined, {
                  packKey: 'GENERIC_RFI',
                  documentType: 'rfi',
                }),
              )
            }
          >
            New draft RFI
          </Button>
        </div>
        {builderRfiDrafts.length === 0 ? (
          <p className={`${PLANNER_MUTED} py-2 text-sm`}>
            No RFI documents saved from the Contract & Document Builder.
          </p>
        ) : (
          <div className={PLANNER_TABLE_WRAPPER}>
            <table className={PLANNER_TABLE}>
              <thead className={PLANNER_TABLE_HEAD}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Number / Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {builderRfiDrafts.map((doc) => (
                  <PlannerBuilderDocumentRow
                    key={doc.id}
                    doc={doc}
                    projectId={projectId}
                    onDeleted={onReload}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {userId && (
        <CreateRfiModal
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
        <RfiDetailDrawer
          rfiId={selectedId}
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
