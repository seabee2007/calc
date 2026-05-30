import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface BucketModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export default function BucketModal({
  isOpen,
  mode,
  initialTitle = '',
  onClose,
  onSubmit,
}: BucketModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) setTitle(initialTitle);
  }, [isOpen, initialTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit(title.trim());
      if (mode === 'add') setTitle('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Rename bucket' : 'Add bucket'}
      size="sm"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="Bucket name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Punch List"
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {isEdit ? 'Save' : 'Add bucket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
