import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import {
  getProjectDocumentDisplayMeta,
  isFarBuilderDocument,
  isRfiBuilderDocument,
} from '../../services/projectDocumentDisplay';
import { resolveBuilderWorkflowStatusFromDoc } from '../../services/builderWorkflowStatus';
import {
  getPlannerDocumentPrimaryActionLabel,
} from '../../services/documentWorkflowConfig';
import { resolveEffectiveDocumentType } from '../../services/projectDocumentDisplay';
import {
  resolveFarDisplayNumber,
  resolveRfiDisplayNumber,
} from '../../services/projectRecordNumbering';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';
import { builderDocumentHrefs } from './builderDocumentActions';
import Toast from '../ui/Toast';
import ProjectRecordActions from './ProjectRecordActions';
import { formatDocDate } from './documents/documentsPanelUtils';
import {
  useBuilderDocumentDelete,
  type BuilderDocumentDeleteConfirmProps,
} from './useBuilderDocumentDelete';

export interface PlannerBuilderDocumentRowProps {
  doc: ProjectDocumentRow;
  projectId: string;
  onDeleted?: () => void;
  onOpenDrawer?: (documentId: string) => void;
  /** @deprecated Use onOpenDrawer */
  onOpenReview?: (documentId: string) => void;
  reviewActionLabel?: string;
  primaryLabel?: string;
  deleteConfirm?: BuilderDocumentDeleteConfirmProps;
}

export default function PlannerBuilderDocumentRow({
  doc,
  projectId,
  onDeleted,
  onOpenDrawer,
  onOpenReview,
  reviewActionLabel,
  primaryLabel,
  deleteConfirm,
}: PlannerBuilderDocumentRowProps) {
  const [toast, setToast] = useState<{
    title: string;
    message?: string;
    type: 'success' | 'error';
  } | null>(null);

  const { confirmActive, deleting, handleDeleteClick, cancelConfirm } = useBuilderDocumentDelete(
    doc.id,
    onDeleted,
    deleteConfirm,
  );

  const { subtitleLabel } = getProjectDocumentDisplayMeta(doc);
  const draftSubtitle = isRfiBuilderDocument(doc)
    ? 'RFI Document Draft'
    : isFarBuilderDocument(doc)
      ? 'FAR Document Draft'
      : subtitleLabel;
  const workflowStatus = resolveBuilderWorkflowStatusFromDoc(doc);
  const docNumber = isRfiBuilderDocument(doc)
    ? resolveRfiDisplayNumber(doc)
    : isFarBuilderDocument(doc)
      ? resolveFarDisplayNumber(doc)
      : doc.document_number?.trim() || '—';
  const { editHref, exportHref } = builderDocumentHrefs(projectId, doc);
  const openDrawer = onOpenDrawer ?? onOpenReview;
  const effectiveType = resolveEffectiveDocumentType(doc);
  const primaryActionLabel =
    reviewActionLabel ??
    primaryLabel ??
    getPlannerDocumentPrimaryActionLabel(effectiveType);

  const onDeleteClick = () => {
    void (async () => {
      const wasConfirming = confirmActive;
      const result = await handleDeleteClick();
      if (!wasConfirming) return;
      if (result === 'success') {
        setToast({ title: 'Document deleted', type: 'success' });
      } else {
        setToast({
          title: 'Delete failed',
          message: 'Could not delete this document. Try again.',
          type: 'error',
        });
      }
    })();
  };

  const secondaries = [
    { label: 'Open in Builder', href: editHref },
    { label: 'Export PDF', href: exportHref },
  ];

  return (
    <>
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
            openDrawer
              ? { label: primaryActionLabel, onClick: () => openDrawer(doc.id) }
              : { label: primaryActionLabel, href: editHref }
          }
          secondaries={secondaries}
          danger={{
            label: 'Delete',
            onClick: onDeleteClick,
            isLoading: deleting,
            confirmMode: confirmActive,
            onCancelConfirm: confirmActive && !deleting ? cancelConfirm : undefined,
          }}
        />
      </td>
    </tr>
    {toast
      ? createPortal(
          <Toast
            id={`doc-delete-${doc.id}`}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />,
          document.body,
        )
      : null}
    </>
  );
}
