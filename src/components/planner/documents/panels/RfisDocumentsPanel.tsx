import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { RfiRequest } from '../../../../types/fieldPlanner';
import { RFI_PRIORITIES } from '../../../../types/fieldPlanner';
import { isRfiClosed } from '../../../../services/rfiService';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import {
  partitionRfiBuilderDocuments,
  resolveBuilderWorkflowStatusFromDoc,
  RFI_WORKFLOW_STATUSES,
} from '../../../../services/builderWorkflowStatus';
import { resolveRfiDisplayNumber } from '../../../../services/projectRecordNumbering';
import PlannerBuilderDocumentRow from '../../PlannerBuilderDocumentRow';
import BuilderDocumentTableActions from '../../BuilderDocumentTableActions';
import ProjectRecordActions from '../../ProjectRecordActions';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import { nameFromMap } from '../../../../services/profileService';
import Button from '../../../ui/Button';
import RfiDetailDrawer from '../../../field/RfiDetailDrawer';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
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
}

function formatBuilderDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function matchesBuilderSearch(doc: ProjectDocumentRow, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    doc.title.toLowerCase().includes(q) ||
    (doc.document_number ?? '').toLowerCase().includes(q)
  );
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
}: Props) {
  const navigate = useNavigate();
  const { searchParams, mergeParams } = useDocumentsSearchParams();
  const highlightId = searchParams.get('rfi');
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [builderReviewDocId, setBuilderReviewDocId] = useState<string | null>(null);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const builderParts = useMemo(() => partitionRfiBuilderDocuments(builderRfiDrafts), [builderRfiDrafts]);

  const filterBuilder = (docs: ProjectDocumentRow[]) =>
    docs.filter((doc) => {
      if (!matchesBuilderSearch(doc, search)) return false;
      if (statusFilter) {
        const wf = resolveBuilderWorkflowStatusFromDoc(doc);
        if (wf !== statusFilter && doc.status !== statusFilter) return false;
      }
      return true;
    });

  const draftBuilder = useMemo(() => filterBuilder(builderParts.drafts), [builderParts.drafts, search, statusFilter]);
  const openBuilder = useMemo(() => filterBuilder(builderParts.open), [builderParts.open, search, statusFilter]);
  const closedBuilder = useMemo(
    () => filterBuilder(builderParts.closed),
    [builderParts.closed, search, statusFilter],
  );

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

  const openCount = openRfis.length + openBuilder.length;
  const closedCount = closedRfis.length + closedBuilder.length;

  const openDrawer = (id: string) => {
    setSelectedId(id);
    mergeParams({ rfi: id });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    mergeParams({ rfi: null });
  };

  const renderBuilderRfiRows = (docs: ProjectDocumentRow[]) =>
    docs.map((doc) => (
      <tr
        key={doc.id}
        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
          builderReviewDocId === doc.id ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
        }`}
      >
        <td className="px-3 py-2 font-mono text-xs">{resolveRfiDisplayNumber(doc)}</td>
        <td className="max-w-[200px] px-3 py-2">
          <div className="truncate font-medium">{doc.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Document Builder</div>
        </td>
        <td className="px-3 py-2 text-gray-500">—</td>
        <td className="px-3 py-2 text-gray-500">—</td>
        <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatBuilderDate(doc.updated_at)}</td>
        <td className="px-3 py-2">
          <FieldRecordStatusBadge status={resolveBuilderWorkflowStatusFromDoc(doc)} />
        </td>
        <td className="px-3 py-2 text-right">
          <BuilderDocumentTableActions
            doc={doc}
            projectId={projectId}
            onPrimary={setBuilderReviewDocId}
          />
        </td>
      </tr>
    ));

  const renderOpenClosedTable = (
    legacyRows: RfiRequest[],
    builderRows: ProjectDocumentRow[],
    empty: string,
  ) => {
    if (legacyRows.length === 0 && builderRows.length === 0) {
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
            {legacyRows.map((rfi) => (
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
                <td className="px-3 py-2 text-right">
                  <ProjectRecordActions
                    primary={{ label: 'View / Respond', onClick: () => openDrawer(rfi.id) }}
                  />
                </td>
              </tr>
            ))}
            {renderBuilderRfiRows(builderRows)}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <PanelActionRow
        action={
          <Button
            variant="accent"
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
          {RFI_WORKFLOW_STATUSES.map((s) => (
            <option key={`wf-${s}`} value={s}>
              {s} (builder)
            </option>
          ))}
        </select>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Open RFIs ({openCount})
        </h3>
        {renderOpenClosedTable(openRfis, openBuilder, 'No open RFIs.')}
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Closed RFIs ({closedCount})
        </h3>
        {renderOpenClosedTable(closedRfis, closedBuilder, 'No closed RFIs.')}
      </section>

      <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          RFI document drafts ({draftBuilder.length})
        </h3>
        {draftBuilder.length === 0 ? (
          <p className={`${PLANNER_MUTED} py-2 text-sm`}>
            No RFI documents in Draft workflow status. Use New RFI to create one.
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
                {draftBuilder.map((doc) => (
                  <PlannerBuilderDocumentRow
                    key={doc.id}
                    doc={doc}
                    projectId={projectId}
                    onDeleted={() => {
                      setDeleteConfirmDocId(null);
                      onReload();
                    }}
                    onOpenDrawer={setBuilderReviewDocId}
                    deleteConfirm={{
                      deleteConfirmActive: deleteConfirmDocId === doc.id,
                      onDeleteRequest: () => setDeleteConfirmDocId(doc.id),
                      onDeleteCancel: () => setDeleteConfirmDocId(null),
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProjectDocumentDrawer
        documentId={builderReviewDocId}
        projectId={projectId}
        onClose={() => setBuilderReviewDocId(null)}
        onSaved={() => {
          onReload();
          onProjectReload();
        }}
      />

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
