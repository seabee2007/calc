import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { getPlannerDocumentPrimaryActionLabel } from '../../services/documentWorkflowConfig';
import { resolveEffectiveDocumentType } from '../../services/projectDocumentDisplay';
import { builderDocumentHrefs } from './builderDocumentActions';
import Toast from '../ui/Toast';
import ProjectRecordActions from './ProjectRecordActions';
import {
  useBuilderDocumentDelete,
  type BuilderDocumentDeleteConfirmProps,
} from './useBuilderDocumentDelete';

interface Props {
  doc: ProjectDocumentRow;
  projectId: string;
  primaryLabel?: string;
  onPrimary: (documentId: string) => void;
  onDeleted?: () => void;
  /** Open/Closed tables omit delete; drafts section includes it. */
  showDelete?: boolean;
  deleteConfirm?: BuilderDocumentDeleteConfirmProps;
}

export default function BuilderDocumentTableActions({
  doc,
  projectId,
  primaryLabel,
  onPrimary,
  onDeleted,
  showDelete = false,
  deleteConfirm,
}: Props) {
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

  const { editHref, exportHref } = builderDocumentHrefs(projectId, doc);
  const label =
    primaryLabel ?? getPlannerDocumentPrimaryActionLabel(resolveEffectiveDocumentType(doc));

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

  return (
    <>
      <ProjectRecordActions
        primary={{ label, onClick: () => onPrimary(doc.id) }}
        secondaries={[
          { label: 'Open in Builder', href: editHref },
          { label: 'Export PDF', href: exportHref },
        ]}
        danger={
          showDelete
            ? {
                label: 'Delete',
                onClick: onDeleteClick,
                isLoading: deleting,
                confirmMode: confirmActive,
                onCancelConfirm: confirmActive && !deleting ? cancelConfirm : undefined,
              }
            : undefined
        }
      />
      {toast
        ? createPortal(
            <Toast
              id={`doc-table-delete-${doc.id}`}
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
