import React, { useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import type { TaskChecklistItem } from '../../types/fieldPlanner';
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from '../../services/taskActivityService';
import Button from '../ui/Button';
import {
  PLANNER_CHECKLIST_ACTIVE,
  PLANNER_CHECKLIST_DONE,
  PLANNER_CHECKLIST_ICON,
  PLANNER_INPUT,
  PLANNER_SECTION_TITLE,
  PLANNER_TASK_META,
} from './plannerTheme';

interface TaskChecklistProps {
  taskId: string;
  items: TaskChecklistItem[];
  userId: string;
  canEdit: boolean;
  onChange: () => void;
}

export default function TaskChecklist({
  taskId,
  items,
  userId,
  canEdit,
  onChange,
}: TaskChecklistProps) {
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const done = items.filter((i) => i.isCompleted).length;
  const total = items.length;

  const handleAdd = async () => {
    if (!newTitle.trim() || !canEdit) return;
    setBusy(true);
    try {
      await addChecklistItem(taskId, newTitle.trim(), items.length);
      setNewTitle('');
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (item: TaskChecklistItem) => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await toggleChecklistItem(item.id, !item.isCompleted, userId);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await deleteChecklistItem(itemId);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={PLANNER_SECTION_TITLE}>Checklist</h4>
        {total > 0 && (
          <span className={PLANNER_TASK_META}>
            {done}/{total}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void handleToggle(item)}
              className={`mt-0.5 shrink-0 ${PLANNER_CHECKLIST_ICON} disabled:opacity-50`}
              aria-label={item.isCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              {item.isCompleted ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <span
              className={`flex-1 text-sm ${item.isCompleted ? PLANNER_CHECKLIST_DONE : PLANNER_CHECKLIST_ACTIVE}`}
            >
              {item.title}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                className="text-gray-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAdd()}
            placeholder="Add checklist item"
            className={PLANNER_INPUT}
          />
          <Button size="sm" onClick={() => void handleAdd()} disabled={busy || !newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
