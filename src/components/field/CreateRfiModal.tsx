import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { createRfi } from '../../services/rfiService';

interface CreateRfiModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId?: string | null;
  userId: string;
  onCreated?: () => void;
}

export default function CreateRfiModal({
  isOpen,
  onClose,
  projectId,
  taskId,
  userId,
  onCreated,
}: CreateRfiModalProps) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [solution, setSolution] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !question.trim()) return;
    setBusy(true);
    try {
      await createRfi({
        projectId,
        taskId,
        submittedBy: userId,
        title: title.trim(),
        question: question.trim(),
        suggestedSolution: solution.trim() || undefined,
      });
      setTitle('');
      setQuestion('');
      setSolution('');
      onCreated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create RFI" size="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium">Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Suggested solution (optional)</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Submit RFI
          </Button>
        </div>
      </form>
    </Modal>
  );
}
