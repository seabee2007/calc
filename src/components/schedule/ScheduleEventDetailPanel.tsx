import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventDetailContent from './ScheduleEventDetailContent';
import ScheduleEventDetailActions from './ScheduleEventDetailActions';
import { SCHEDULE_HEADING } from './scheduleTheme';
import { PLANNER_DRAWER_PANEL_TRANSITION } from '../planner/plannerTheme';

const PANEL_WIDTH = 360;

interface Props {
  event: ScheduleEvent | null;
  open: boolean;
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
  open,
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
  return (
    <motion.div
      className="hidden h-full shrink-0 overflow-hidden lg:block"
      initial={false}
      animate={{ width: open && event ? PANEL_WIDTH : 0 }}
      transition={PLANNER_DRAWER_PANEL_TRANSITION}
    >
      <AnimatePresence mode="wait">
        {open && event && (
          <motion.aside
            key={event.id}
            initial={{ x: PANEL_WIDTH, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: PANEL_WIDTH, opacity: 0 }}
            transition={PLANNER_DRAWER_PANEL_TRANSITION}
            className="flex h-full w-[360px] flex-col border-l border-[#E5E7EB] bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
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
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
