import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Plus } from 'lucide-react';
import type { CalendarSubView, ScheduleView } from '../../types/scheduleEvent';
import { CALENDAR_SUB_VIEWS } from '../../types/scheduleEvent';
import Button from '../ui/Button';
import { SCHEDULE_SUB_TAB, SCHEDULE_TOOLBAR } from './scheduleTheme';

const CAL_LABELS: Record<CalendarSubView, string> = {
  month: 'Month',
  week: 'Week',
  work_week: 'Work week',
  day: 'Day',
  agenda: 'Agenda',
};

const OVERFLOW_VIEWS: { view: ScheduleView; label: string }[] = [
  { view: 'timeline', label: 'Timeline' },
  { view: 'list', label: 'List' },
  { view: 'milestone', label: 'Milestones' },
];

interface Props {
  view: ScheduleView;
  cal: CalendarSubView;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCalChange: (cal: CalendarSubView) => void;
  onViewChange: (view: ScheduleView) => void;
  onOpenFilters: () => void;
  onAddEvent?: () => void;
  isOwner: boolean;
  showCalSwitcher?: boolean;
}

export default function ScheduleCalendarToolbar({
  view,
  cal,
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  onCalChange,
  onViewChange,
  onOpenFilters,
  onAddEvent,
  isOwner,
  showCalSwitcher = true,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className={SCHEDULE_TOOLBAR}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <h1 className="mr-1 text-base font-semibold text-[#1F2937] dark:text-slate-100">Schedule</h1>
        {view === 'calendar' && (
          <>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onPrev}
                className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToday}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button
                type="button"
                onClick={onNext}
                className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="truncate text-sm font-medium text-[#1F2937] dark:text-slate-200">
              {rangeLabel}
            </span>
          </>
        )}
        {view !== 'calendar' && (
          <span className="text-sm font-medium capitalize text-[#4B5563] dark:text-slate-400">
            {view === 'milestone' ? 'Milestones' : view}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showCalSwitcher && view === 'calendar' && (
          <div className="hidden flex-wrap gap-0.5 rounded-lg border border-slate-300 bg-white p-0.5 sm:flex dark:border-slate-700 dark:bg-slate-900">
            {CALENDAR_SUB_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onCalChange(v)}
                className={`${SCHEDULE_SUB_TAB} ${
                  cal === v
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {CAL_LABELS[v]}
              </button>
            ))}
          </div>
        )}

        <Button size="sm" variant="outline" icon={<Filter className="h-4 w-4" />} onClick={onOpenFilters}>
          Filters
        </Button>

        {isOwner && onAddEvent && (
          <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onAddEvent}>
            <span className="hidden sm:inline">Add event</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="More views"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {view !== 'calendar' && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onViewChange('calendar');
                    setMenuOpen(false);
                  }}
                >
                  Calendar
                </button>
              )}
              {OVERFLOW_VIEWS.map(({ view: v, label }) => (
                <button
                  key={v}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    view === v ? 'font-semibold text-[#2563EB]' : ''
                  }`}
                  onClick={() => {
                    onViewChange(v);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
              {view === 'calendar' && (
                <div className="border-t border-slate-200 px-2 py-2 dark:border-slate-700 sm:hidden">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">View</p>
                  <div className="flex flex-wrap gap-1">
                    {CALENDAR_SUB_VIEWS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          onCalChange(v);
                          setMenuOpen(false);
                        }}
                        className={`${SCHEDULE_SUB_TAB} ${
                          cal === v ? 'bg-[#2563EB] text-white' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {CAL_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
