import React from 'react';
import { Calendar } from 'lucide-react';
import { SCHEDULE_MUTED, SCHEDULE_HEADING } from './scheduleTheme';

interface Props {
  title?: string;
  message?: string;
}

export default function ScheduleEmptyState({
  title = 'No events in this range',
  message = 'Add a schedule event or adjust your filters to see work planned for your projects.',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <Calendar className="h-10 w-10 text-[#6B7280]" strokeWidth={1.25} aria-hidden />
      <h3 className={`mt-4 text-base font-semibold ${SCHEDULE_HEADING}`}>{title}</h3>
      <p className={`mt-2 max-w-sm text-sm ${SCHEDULE_MUTED}`}>{message}</p>
    </div>
  );
}
