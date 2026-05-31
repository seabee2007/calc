import React from 'react';
import { CheckCircle, Copy, CalendarClock, Pencil, Trash2 } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import Button from '../ui/Button';
import { PLANNER_DRAWER_FOOTER } from '../planner/plannerTheme';

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
    <footer className={PLANNER_DRAWER_FOOTER}>
      {event.status !== 'completed' && (
        <Button
          variant="primary"
          fullWidth
          className="min-h-[44px]"
          icon={<CheckCircle className="h-4 w-4" />}
          onClick={onComplete}
          disabled={busy}
          isLoading={busy}
        >
          Mark complete
        </Button>
      )}
      <Button
        variant="outline"
        fullWidth
        className="min-h-[44px]"
        icon={<Pencil className="h-4 w-4" />}
        onClick={onEdit}
        disabled={busy}
      >
        Edit
      </Button>
      <Button
        variant="outline"
        fullWidth
        className="min-h-[44px]"
        icon={<CalendarClock className="h-4 w-4" />}
        onClick={onReschedule}
        disabled={busy}
      >
        Reschedule
      </Button>
      {onDuplicate && (
        <Button
          variant="outline"
          fullWidth
          className="min-h-[44px]"
          icon={<Copy className="h-4 w-4" />}
          onClick={onDuplicate}
          disabled={busy}
        >
          Duplicate
        </Button>
      )}
      {onConvertToTask && !event.taskId && (
        <Button variant="accent" fullWidth className="min-h-[44px]" onClick={onConvertToTask} disabled={busy}>
          Convert to task
        </Button>
      )}
      {event.taskId && (
        <p className="text-center text-xs text-gray-500 dark:text-slate-400">Linked to planner task</p>
      )}
      <Button
        variant="danger"
        fullWidth
        className="min-h-[44px]"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={onDelete}
        disabled={busy}
      >
        Delete
      </Button>
    </footer>
  );
}
