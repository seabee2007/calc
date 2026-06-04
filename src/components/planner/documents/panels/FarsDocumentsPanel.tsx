import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { FieldAdjustmentRequest } from '../../../../types/fieldPlanner';
import { FAR_STATUSES } from '../../../../types/fieldPlanner';
import type { ProjectDocumentRow } from '../../../../services/projectDocumentService';
import {
  FAR_WORKFLOW_STATUSES,
  partitionFarBuilderDocuments,
  resolveBuilderWorkflowStatusFromDoc,
} from '../../../../services/builderWorkflowStatus';
import { resolveFarDisplayNumber } from '../../../../services/projectRecordNumbering';
import PlannerBuilderDocumentRow from '../../PlannerBuilderDocumentRow';
import BuilderDocumentTableActions from '../../BuilderDocumentTableActions';
import ProjectRecordActions from '../../ProjectRecordActions';
import { contractBuilderToolHref } from '../../../../utils/plannerRoutes';
import { nameFromMap } from '../../../../services/profileService';
import Button from '../../../ui/Button';
import FarDetailDrawer from '../../../field/FarDetailDrawer';
import FieldRecordStatusBadge from '../../../field/FieldRecordStatusBadge';
import ProjectDocumentDrawer from '../../ProjectDocumentDrawer';
import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../../plannerTheme';
import { DocumentsPanelFootnote, PanelActionRow } from '../documentsPanelUtils';
import { useDocumentsSearchParams } from '../useDocumentsSearchParams';

const FAR_PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Urgent'] as const;

interface Props {
  projectId: string;
  items: FieldAdjustmentRequest[];
  builderFarDrafts: ProjectDocumentRow[];
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
    resolveFarDisplayNumber(doc).toLowerCase().includes(q)
  );
}

export default function FarsDocumentsPanel({
  projectId,
  items,
  builderFarDrafts,
  nameMap,
  userId,
  isOwner,
  onReload,
  onProjectReload,
}: Props) {
  const navigate = useNavigate();
  const { searchParams, mergeParams } = useDocumentsSearchParams();
  const highlightId = searchParams.get('adjustment');
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [builderReviewDocId, setBuilderReviewDocId] = useState<string | null>(null);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (highlightId) setSelectedId(highlightId);
  }, [highlightId]);

  const builderParts = useMemo(() => partitionFarBuilderDocuments(builderFarDrafts), [builderFarDrafts]);

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
    return items.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  const openCount = filtered.length + openBuilder.length;
  const closedCount = closedBuilder.length;

  const openDrawer = (id: string) => {
    setSelectedId(id);
    mergeParams({ adjustment: id });
  };

  const closeDrawer = () => {
    setSelectedId(null);
    mergeParams({ adjustment: null });
  };

  const renderBuilderFarRows = (docs: ProjectDocumentRow[]) =>
    docs.map((doc) => (
      <tr
        key={doc.id}
        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
          builderReviewDocId === doc.id ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
        }`}
      >
        <td className="px-3 py-2 font-mono text-xs">{resolveFarDisplayNumber(doc)}</td>
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
    legacyRows: FieldAdjustmentRequest[],
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
              <th className="px-3 py-2">FAR #</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {legacyRows.map((adj) => (
              <tr
                key={adj.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  highlightId === adj.id ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{adj.displayNumber ?? '—'}</td>
                <td className="max-w-[200px] truncate px-3 py-2 font-medium">{adj.title}</td>
                <td className="px-3 py-2 text-gray-500">—</td>
                <td className="px-3 py-2">{nameFromMap(nameMap, adj.submittedBy, '—')}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {new Date(adj.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <FieldRecordStatusBadge status={adj.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <ProjectRecordActions
                    primary={{ label: 'View / Review', onClick: () => openDrawer(adj.id) }}
                  />
                </td>
              </tr>
            ))}
            {renderBuilderFarRows(builderRows)}
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
                  packKey: 'GENERIC_FAR',
                  documentType: 'far',
                }),
              )
            }
          >
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
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {FAR_PRIORITY_OPTIONS.map((p) => (
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
          {FAR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {FAR_WORKFLOW_STATUSES.map((s) => (
            <option key={`wf-${s}`} value={s}>
              {s} (builder)
            </option>
          ))}
        </select>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Open FARs ({openCount})
        </h3>
        {renderOpenClosedTable(filtered, openBuilder, 'No open FARs.')}
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Closed FARs ({closedCount})
        </h3>
        {renderOpenClosedTable([], closedBuilder, 'No closed FARs.')}
      </section>

      <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          FAR document drafts ({draftBuilder.length})
        </h3>
        {draftBuilder.length === 0 ? (
          <p className={`${PLANNER_MUTED} py-2 text-sm`}>
            No FAR documents in Draft workflow status. Use New FAR to create one.
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
