import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { createFieldAdjustment } from '../../services/fieldAdjustmentService';

interface CreateFieldAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId?: string | null;
  userId: string;
  onCreated?: () => void;
}

export default function CreateFieldAdjustmentModal({
  isOpen,
  onClose,
  projectId,
  taskId,
  userId,
  onCreated,
}: CreateFieldAdjustmentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      await createFieldAdjustment({
        projectId,
        taskId,
        submittedBy: userId,
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim() || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
      });
      setTitle('');
      setDescription('');
      setReason('');
      setEstimatedCost('');
      onCreated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Field adjustment request" size="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input
          label="Estimated cost ($)"
          type="number"
          value={estimatedCost}
          onChange={(e) => setEstimatedCost(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
