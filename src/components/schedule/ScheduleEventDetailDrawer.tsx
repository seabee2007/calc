import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventDetailContent from './ScheduleEventDetailContent';
import ScheduleEventDetailActions from './ScheduleEventDetailActions';
import {
  PLANNER_CLOSE_BTN,
  PLANNER_DRAWER_BACKDROP,
  PLANNER_DRAWER_BODY,
  PLANNER_DRAWER_HEADER,
  PLANNER_DRAWER_PANEL_TRANSITION,
  PLANNER_OVERLAY_TRANSITION,
} from '../planner/plannerTheme';
import { SCHEDULE_DRAWER_PANEL } from './scheduleTheme';

interface Props {
  event: ScheduleEvent | null;
  isOpen?: boolean;
  isOwner: boolean;
  onClose: () => void;
  onExited?: () => void;
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

export default function ScheduleEventDetailDrawer({
  event,
  isOpen = true,
  isOwner,
  onClose,
  onExited,
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
  const [bottomSheet, setBottomSheet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const check = () => setBottomSheet(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const panelClass = bottomSheet
    ? `fixed inset-x-0 bottom-0 z-[200] flex max-h-[90vh] flex-col rounded-t-2xl shadow-2xl ${SCHEDULE_DRAWER_PANEL}`
    : `fixed inset-y-0 right-0 z-[200] flex w-full max-w-lg flex-col shadow-2xl ${SCHEDULE_DRAWER_PANEL}`;

  return createPortal(
    <AnimatePresence onExitComplete={onExited}>
      {isOpen && event && (
        <motion.div
          className={PLANNER_DRAWER_BACKDROP}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={PLANNER_OVERLAY_TRANSITION}
          onClick={onClose}
        >
          <motion.div
            key={bottomSheet ? 'schedule-event-bottom-sheet' : 'schedule-event-side-drawer'}
            className={panelClass}
            initial={bottomSheet ? { y: '100%' } : { x: '100%' }}
            animate={bottomSheet ? { y: 0 } : { x: 0 }}
            exit={bottomSheet ? { y: '100%' } : { x: '100%' }}
            transition={PLANNER_DRAWER_PANEL_TRANSITION}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={PLANNER_DRAWER_HEADER}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Event details</h2>
              <button type="button" onClick={onClose} className={PLANNER_CLOSE_BTN} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={`${PLANNER_DRAWER_BODY} flex-1 overflow-y-auto`}>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
