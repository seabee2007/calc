import { useState } from 'react';
import { format } from 'date-fns';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { deleteProjectDocument } from '../../services/projectDocumentService';
import {
  getProjectDocumentDisplayMeta,
  isFarBuilderDocument,
  isRfiBuilderDocument,
} from '../../services/projectDocumentDisplay';
import { resolveBuilderWorkflowStatusFromDoc } from '../../services/builderWorkflowStatus';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';
import { builderDocumentHrefs } from './builderDocumentActions';
import ProjectRecordActions from './ProjectRecordActions';

function formatDocDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export interface PlannerBuilderDocumentRowProps {
  doc: ProjectDocumentRow;
  projectId: string;
  onDeleted?: () => void;
  onOpenReview?: (documentId: string) => void;
  reviewActionLabel?: 'View / Respond' | 'View / Review';
  primaryLabel?: string;
}

export default function PlannerBuilderDocumentRow({
  doc,
  projectId,
  onDeleted,
  onOpenReview,
  reviewActionLabel = 'View / Respond',
  primaryLabel = 'Open / Edit',
}: PlannerBuilderDocumentRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { subtitleLabel } = getProjectDocumentDisplayMeta(doc);
  const draftSubtitle = isRfiBuilderDocument(doc)
    ? 'RFI Document Draft'
    : isFarBuilderDocument(doc)
      ? 'FAR Document Draft'
      : subtitleLabel;
  const workflowStatus = resolveBuilderWorkflowStatusFromDoc(doc);
  const docNumber = doc.document_number?.trim() || '—';
  const { editHref, exportHref } = builderDocumentHrefs(projectId, doc);
  const showReview = onOpenReview && (isRfiBuilderDocument(doc) || isFarBuilderDocument(doc));

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

  const secondaries = showReview
    ? [
        { label: 'Open in Builder', href: editHref },
        { label: 'Export PDF', href: exportHref },
      ]
    : [{ label: 'Export PDF', href: exportHref }];

  return (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
        {formatDocDate(doc.updated_at)}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-white">{doc.title}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Document Builder · {draftSubtitle}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-mono text-xs">{docNumber}</span>
        <span className="ml-2">
          <FieldRecordStatusBadge status={workflowStatus} />
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <ProjectRecordActions
          primary={
            showReview
              ? { label: reviewActionLabel, onClick: () => onOpenReview!(doc.id) }
              : { label: primaryLabel, href: editHref }
          }
          secondaries={secondaries}
          danger={{
            label: 'Delete',
            onClick: () => void handleDelete(),
            isLoading: deleting,
            confirmMode: confirmDelete,
            onCancelConfirm: confirmDelete && !deleting ? () => setConfirmDelete(false) : undefined,
          }}
        />
      </td>
    </tr>
  );
}
