import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { deleteProjectDocument } from '../../services/projectDocumentService';
import { getProjectDocumentDisplayMeta } from '../../services/projectDocumentDisplay';
import { contractBuilderToolHref } from '../../utils/plannerRoutes';
import Button from '../ui/Button';

function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function workflowBadgeClass(status: string | null | undefined): string {
  const s = (status ?? 'draft').toLowerCase();
  if (s.includes('approv')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (s.includes('reject') || s.includes('declin')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  if (s.includes('submit') || s.includes('review') || s.includes('sent'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export interface PlannerBuilderDocumentRowProps {
  doc: ProjectDocumentRow;
  projectId: string;
  onDeleted?: () => void;
}

export default function PlannerBuilderDocumentRow({
  doc,
  projectId,
  onDeleted,
}: PlannerBuilderDocumentRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { subtitleLabel } = getProjectDocumentDisplayMeta(doc);
  const workflowStatus = doc.builder_workflow_status ?? 'Draft';
  const docNumber = doc.document_number?.trim() || '—';
  const editHref = contractBuilderToolHref(projectId, doc.id);
  const exportHref = `${editHref}${editHref.includes('?') ? '&' : '?'}export=1`;

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteProjectDocument(doc.id);
      onDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
        {formatDocDate(doc.updated_at)}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-white">{doc.title}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Document Builder draft · {subtitleLabel}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-mono text-xs">{docNumber}</span>
        <span
          className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${workflowBadgeClass(workflowStatus)}`}
        >
          {workflowStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to={editHref}
            className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Open / Edit
          </Link>
          <Link
            to={exportHref}
            className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Export PDF
          </Link>
          <Button
            size="sm"
            variant={confirmDelete ? 'danger' : 'outline'}
            onClick={() => void handleDelete()}
            isLoading={deleting}
            disabled={deleting}
          >
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </Button>
          {confirmDelete && !deleting ? (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
