import React from 'react';
import { X } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventDetailContent from './ScheduleEventDetailContent';
import ScheduleEventDetailActions from './ScheduleEventDetailActions';
import { SCHEDULE_DETAIL_PANEL, SCHEDULE_HEADING, SCHEDULE_MUTED } from './scheduleTheme';

interface Props {
  event: ScheduleEvent | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onReschedule: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onConvertToTask?: () => void;
  onAddComment?: (body: string) => Promise<void>;
  busy?: boolean;
  commentBusy?: boolean;
}

export default function ScheduleEventDetailPanel({
  event,
  isOwner,
  onClose,
  onEdit,
  onComplete,
  onReschedule,
  onDelete,
  onDuplicate,
  onConvertToTask,
  onAddComment,
  busy,
  commentBusy,
}: Props) {
  if (!event) {
    return (
      <aside className={SCHEDULE_DETAIL_PANEL}>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className={`text-sm ${SCHEDULE_MUTED}`}>
            Select an event to view details, assignments, and documents.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={SCHEDULE_DETAIL_PANEL}>
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 dark:border-slate-700">
        <h2 className={`text-sm font-semibold ${SCHEDULE_HEADING}`}>Event details</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[#6B7280] hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ScheduleEventDetailContent
          event={event}
          canComment={isOwner}
          onAddComment={onAddComment}
          commentBusy={commentBusy}
        />
      </div>
      <ScheduleEventDetailActions
        event={event}
        isOwner={isOwner}
        busy={busy}
        onEdit={onEdit}
        onComplete={onComplete}
        onReschedule={onReschedule}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onConvertToTask={onConvertToTask}
      />
    </aside>
  );
}
