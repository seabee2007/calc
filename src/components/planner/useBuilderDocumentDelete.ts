import { useCallback, useState } from 'react';
import { deleteProjectDocument } from '../../services/projectDocumentService';

export interface BuilderDocumentDeleteConfirmProps {
  deleteConfirmActive?: boolean;
  onDeleteRequest?: () => void;
  onDeleteCancel?: () => void;
}

export function useBuilderDocumentDelete(
  documentId: string,
  onDeleted?: () => void,
  confirm?: BuilderDocumentDeleteConfirmProps,
) {
  const [internalConfirm, setInternalConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isControlled = confirm?.onDeleteRequest != null;
  const confirmActive = isControlled
    ? Boolean(confirm.deleteConfirmActive)
    : internalConfirm;

  const requestConfirm = useCallback(() => {
    if (isControlled) {
      confirm.onDeleteRequest?.();
    } else {
      setInternalConfirm(true);
    }
  }, [confirm, isControlled]);

  const cancelConfirm = useCallback(() => {
    setError(null);
    if (isControlled) {
      confirm.onDeleteCancel?.();
    } else {
      setInternalConfirm(false);
    }
  }, [confirm, isControlled]);

  const executeDelete = useCallback(async (): Promise<'success' | 'error'> => {
    if (!confirmActive) {
      requestConfirm();
      return 'success';
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteProjectDocument(documentId);
      if (!isControlled) setInternalConfirm(false);
      onDeleted?.();
      return 'success';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      if (!isControlled) setInternalConfirm(false);
      return 'error';
    } finally {
      setDeleting(false);
    }
  }, [confirmActive, documentId, isControlled, onDeleted, requestConfirm]);

  const handleDeleteClick = useCallback(() => executeDelete(), [executeDelete]);

  return {
    confirmActive,
    deleting,
    error,
    handleDeleteClick,
    cancelConfirm,
  };
}
