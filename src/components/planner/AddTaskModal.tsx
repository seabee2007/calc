import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { TASK_PRIORITIES, type TaskPriority } from '../../types/fieldPlanner';
import type { Profile } from '../../types/fieldPlanner';
import { DEFAULT_PROFILE_DISPLAY_NAME } from '../../services/profileService';
import { PLANNER_INPUT } from './plannerTheme';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Profile[];
  onSubmit: (data: {
    title: string;
    description?: string;
    assignedTo?: string | null;
    priority: TaskPriority;
    dueDate?: string | null;
  }) => Promise<void>;
}

export default function AddTaskModal({ isOpen, onClose, team, onSubmit }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || null,
        priority,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setDueDate('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add task" size="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={PLANNER_INPUT}
          />
        </div>
        <Select
          label="Assign to"
          value={assignedTo}
          onChange={(v) => setAssignedTo(v)}
          options={[
            { value: '', label: 'Unassigned' },
            ...team.map((m) => ({
              value: m.id,
              label: m.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME,
            })),
          ]}
        />
        <Select
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as TaskPriority)}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <Input
          label="Due date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
