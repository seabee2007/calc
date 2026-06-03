import { useState } from 'react';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { deleteProjectDocument } from '../../services/projectDocumentService';
import { builderDocumentHrefs } from './builderDocumentActions';
import ProjectRecordActions from './ProjectRecordActions';

interface Props {
  doc: ProjectDocumentRow;
  projectId: string;
  primaryLabel: 'View / Respond' | 'View / Review';
  onPrimary: (documentId: string) => void;
  onDeleted?: () => void;
  /** Open/Closed tables omit delete; drafts section includes it. */
  showDelete?: boolean;
}

export default function BuilderDocumentTableActions({
  doc,
  projectId,
  primaryLabel,
  onPrimary,
  onDeleted,
  showDelete = false,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { editHref, exportHref } = builderDocumentHrefs(projectId, doc);

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
    <ProjectRecordActions
      primary={{ label: primaryLabel, onClick: () => onPrimary(doc.id) }}
      secondaries={[
        { label: 'Open in Builder', href: editHref },
        { label: 'Export PDF', href: exportHref },
      ]}
      danger={
        showDelete
          ? {
              label: 'Delete',
              onClick: () => void handleDelete(),
              isLoading: deleting,
              confirmMode: confirmDelete,
              onCancelConfirm:
                confirmDelete && !deleting ? () => setConfirmDelete(false) : undefined,
            }
          : undefined
      }
    />
  );
}
