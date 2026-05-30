import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface AddBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export default function AddBucketModal({ isOpen, onClose, onSubmit }: AddBucketModalProps) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit(title.trim());
      setTitle('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add bucket" size="sm">
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
            Add bucket
          </Button>
        </div>
      </form>
    </Modal>
  );
}
