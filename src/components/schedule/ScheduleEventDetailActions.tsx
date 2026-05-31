import React from 'react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import Button from '../ui/Button';

interface Props {
  event: ScheduleEvent;
  isOwner: boolean;
  busy?: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onReschedule: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onConvertToTask?: () => void;
}

export default function ScheduleEventDetailActions({
  event,
  isOwner,
  busy,
  onEdit,
  onComplete,
  onReschedule,
  onDelete,
  onDuplicate,
  onConvertToTask,
}: Props) {
  if (!isOwner) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-[#E5E7EB] p-4 dark:border-slate-700">
      <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
        Edit
      </Button>
      {event.status !== 'completed' && (
        <Button size="sm" variant="primary" onClick={onComplete} disabled={busy} isLoading={busy}>
          Mark complete
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onReschedule} disabled={busy}>
        Reschedule
      </Button>
      {onDuplicate && (
        <Button size="sm" variant="outline" onClick={onDuplicate} disabled={busy}>
          Duplicate
        </Button>
      )}
      {onConvertToTask && !event.taskId && (
        <Button size="sm" variant="outline" onClick={onConvertToTask} disabled={busy}>
          Convert to task
        </Button>
      )}
      {event.taskId && (
        <p className="text-xs text-[#6B7280] dark:text-slate-500">Linked to planner task</p>
      )}
      <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
        Delete
      </Button>
    </div>
  );
}
