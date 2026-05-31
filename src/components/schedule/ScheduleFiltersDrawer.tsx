import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ScheduleFilters } from '../../types/scheduleEvent';
import ScheduleFiltersBar from './ScheduleFiltersBar';
import ScheduleFilterPresetsControl from './ScheduleFilterPresetsControl';

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ScheduleFilters;
  onChange: (patch: Partial<ScheduleFilters>) => void;
  onApplyPreset: (filters: ScheduleFilters) => void;
  projects: ProjectOption[];
  trades: string[];
  crews: string[];
  assignedUsers: string[];
  lockProjectId?: string;
  userId?: string;
}

export default function ScheduleFiltersDrawer({
  open,
  onClose,
  filters,
  onChange,
  onApplyPreset,
  projects,
  trades,
  crews,
  assignedUsers,
  lockProjectId,
  userId,
}: Props) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[180] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-[190] flex w-full max-w-sm flex-col border-r border-[#E5E7EB] bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h2>
              <button type="button" onClick={onClose} className="rounded-md p-1" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ScheduleFiltersBar
                filters={filters}
                onChange={onChange}
                projects={projects}
                trades={trades}
                crews={crews}
                assignedUsers={assignedUsers}
                lockProjectId={lockProjectId}
              />
              {userId && (
                <ScheduleFilterPresetsControl
                  userId={userId}
                  filters={filters}
                  onApply={onApplyPreset}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
