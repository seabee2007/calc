import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Calendar, Search } from 'lucide-react';
import type { ProjectDocumentRow } from '../../../services/projectDocumentService';
import Input from '../../ui/Input';
import PlannerBuilderDocumentRow from '../PlannerBuilderDocumentRow';
import ProjectRecordActions from '../ProjectRecordActions';
import {
  PLANNER_FORM_PANEL,
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

export function normalizeIsoDate(value: string | undefined | null): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function matchesDateFilter(isoDate: string | undefined | null, dateFilter: string): boolean {
  if (!dateFilter) return true;
  return normalizeIsoDate(isoDate) === dateFilter;
}

export function matchesSearchTerm(haystack: string, term: string): boolean {
  if (!term.trim()) return true;
  return haystack.toLowerCase().includes(term.toLowerCase().trim());
}

export function DocumentsFilterBar({
  searchPlaceholder,
  searchTerm,
  onSearchTermChange,
  dateFilter,
  onDateFilterChange,
}: {
  searchPlaceholder: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          icon={<Search className="h-4 w-4 text-gray-400" />}
          fullWidth
        />
      </div>
      <div className="w-full sm:w-48">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
          icon={<Calendar className="h-4 w-4 text-gray-400" />}
          fullWidth
        />
      </div>
    </div>
  );
}

export function DocumentsSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
        {description ? <p className={PLANNER_MUTED}>{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function DocumentsSectionCard({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${PLANNER_FORM_PANEL} space-y-4 p-6`}>
      {title ? (
        <DocumentsSectionHeader title={title} description={description} action={action} />
      ) : null}
      {children}
    </section>
  );
}

export function DocumentsEmptyState({
  message,
  description,
}: {
  message: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className={`text-sm ${PLANNER_MUTED}`}>{message}</p>
      {description ? <p className={`mt-2 text-sm ${PLANNER_MUTED}`}>{description}</p> : null}
    </div>
  );
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
