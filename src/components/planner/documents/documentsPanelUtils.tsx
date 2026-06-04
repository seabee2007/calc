import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import type { ProjectDocumentRow } from '../../../services/projectDocumentService';
import PlannerBuilderDocumentRow from '../PlannerBuilderDocumentRow';
import ProjectRecordActions from '../ProjectRecordActions';
import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_ROW_HIGHLIGHT,
  PLANNER_TABLE_WRAPPER,
} from '../plannerTheme';

/** Friendly table date (e.g. Jun 4, 2026). Accepts ISO timestamps and yyyy-MM-dd. */
export function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—';
  const trimmed = iso.trim();
  if (!trimmed) return '—';
  try {
    let d = new Date(trimmed);
    if (Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      d = new Date(`${trimmed}T12:00:00`);
    }
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function formatSigningMeta(doc: ProjectDocumentRow): string {
  const status = doc.signing_status ?? 'draft';
  if (status === 'signed') return 'Signed';
  if (status === 'sent' || status === 'viewed') return 'Awaiting client signature';
  if (status === 'declined') return 'Declined';
  if (status === 'void') return 'Void';
  return `Draft · v${doc.latest_version_number}`;
}

export function BuilderDraftsTable({
  docs,
  projectId,
  empty,
  onDeleted,
  onOpenDrawer,
}: {
  docs: ProjectDocumentRow[];
  projectId: string;
  empty: string;
  onDeleted: () => void;
  onOpenDrawer?: (documentId: string) => void;
}) {
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);

  if (docs.length === 0) {
    return <p className={`${PLANNER_MUTED} py-2 text-sm`}>{empty}</p>;
  }
  return (
    <div className={PLANNER_TABLE_WRAPPER}>
      <table className={PLANNER_TABLE}>
        <thead>
          <tr className={PLANNER_TABLE_HEAD}>
            <th className="px-4 py-3 font-semibold">Updated</th>
            <th className="px-4 py-3 font-semibold">Title</th>
            <th className="px-4 py-3 font-semibold">Number / Status</th>
            <th className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <PlannerBuilderDocumentRow
              key={doc.id}
              doc={doc}
              projectId={projectId}
              onDeleted={() => {
                setDeleteConfirmDocId(null);
                onDeleted();
              }}
              onOpenDrawer={onOpenDrawer}
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
  );
}

export function SimpleDocumentsTable({
  rows,
  empty,
  highlightId,
  buildHref,
  onOpenDrawer,
  primaryLabel = 'View / Update',
}: {
  rows: { id?: string; date: string; title: string; meta: string }[];
  empty: string;
  highlightId: string | null;
  buildHref: (id: string) => string;
  onOpenDrawer?: (id: string) => void;
  primaryLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className={`${PLANNER_MUTED} py-2 text-sm`}>{empty}</p>;
  }
  return (
    <div className={PLANNER_TABLE_WRAPPER}>
      <table className={PLANNER_TABLE}>
        <thead>
          <tr className={PLANNER_TABLE_HEAD}>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Title</th>
            <th className="px-4 py-3 font-semibold">Details</th>
            <th className="px-4 py-3 font-semibold text-right">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (!row.id) return null;
            const highlighted = highlightId === row.id;
            return (
              <tr
                key={row.id}
                className={`${PLANNER_TABLE_ROW} ${highlighted ? PLANNER_TABLE_ROW_HIGHLIGHT : ''}`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                  {row.date}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.title}</td>
                <td className={`px-4 py-3 ${PLANNER_MUTED}`}>{row.meta}</td>
                <td className="px-4 py-3 text-right">
                  <ProjectRecordActions
                    primary={
                      onOpenDrawer
                        ? { label: primaryLabel, onClick: () => onOpenDrawer(row.id) }
                        : { label: primaryLabel, href: buildHref(row.id) }
                    }
                    secondaries={
                      onOpenDrawer
                        ? [{ label: 'Open in Builder', href: buildHref(row.id) }]
                        : undefined
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentsPanelFootnote() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/40">
      <p className={`text-sm ${PLANNER_MUTED}`}>
        Task photos and attachments remain on each task on the Board. Link a project in the field
        tools when saving so records appear here.
      </p>
    </div>
  );
}

export function PanelActionRow({
  action,
}: {
  action: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{action}</div>
  );
}
