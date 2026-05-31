import React from 'react';
import type { ScheduleView } from '../../types/scheduleEvent';
import { SCHEDULE_VIEWS } from '../../types/scheduleEvent';

const VIEW_LABELS: Record<ScheduleView, string> = {
  calendar: 'Calendar',
  timeline: 'Timeline',
  list: 'List',
  milestone: 'Milestones',
};

interface Props {
  active: ScheduleView;
  onChange: (view: ScheduleView) => void;
  vertical?: boolean;
}

export default function ScheduleViewTabs({ active, onChange, vertical }: Props) {
  return (
    <div
      className={
        vertical
          ? 'flex flex-col gap-1'
          : 'flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0'
      }
      role="tablist"
    >
      {SCHEDULE_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={active === view}
          onClick={() => onChange(view)}
          className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            active === view
              ? 'bg-[#2563EB] text-white'
              : 'text-[#4B5563] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}
