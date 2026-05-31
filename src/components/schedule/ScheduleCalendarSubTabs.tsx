import React from 'react';
import type { CalendarSubView } from '../../types/scheduleEvent';
import { CALENDAR_SUB_VIEWS } from '../../types/scheduleEvent';
import { SCHEDULE_SUB_TAB } from './scheduleTheme';

const LABELS: Record<CalendarSubView, string> = {
  month: 'Month',
  week: 'Week',
  work_week: 'Work week',
  day: 'Day',
  agenda: 'Agenda',
};

interface Props {
  active: CalendarSubView;
  onChange: (v: CalendarSubView) => void;
}

export default function ScheduleCalendarSubTabs({ active, onChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[#E5E7EB] bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      {CALENDAR_SUB_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`${SCHEDULE_SUB_TAB} ${
            active === v
              ? 'bg-[#2563EB] text-white'
              : 'text-[#4B5563] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {LABELS[v]}
        </button>
      ))}
    </div>
  );
}
