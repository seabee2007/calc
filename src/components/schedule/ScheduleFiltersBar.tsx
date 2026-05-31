import React from 'react';
import type { ScheduleFilters } from '../../types/scheduleEvent';
import {
  SCHEDULE_EVENT_TYPES,
  SCHEDULE_EVENT_STATUSES,
  SCHEDULE_EVENT_TYPE_LABELS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_PRIORITIES,
  SCHEDULE_PRIORITY_LABELS,
  SCHEDULE_WEATHER_RISKS,
} from '../../types/scheduleEvent';
import { SCHEDULE_FILTER_INPUT, SCHEDULE_MUTED } from './scheduleTheme';
import { getDateRangePreset } from '../../utils/scheduleEventUtils';

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  filters: ScheduleFilters;
  onChange: (patch: Partial<ScheduleFilters>) => void;
  projects: ProjectOption[];
  trades: string[];
  crews: string[];
  assignedUsers: string[];
  lockProjectId?: string;
  compact?: boolean;
}

export default function ScheduleFiltersBar({
  filters,
  onChange,
  projects,
  trades,
  crews,
  assignedUsers,
  lockProjectId,
  compact,
}: Props) {
  const gridClass = compact
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 gap-3 sm:grid-cols-2';

  const applyPreset = (preset: 'this_week' | 'this_month' | 'next_30') => {
    const range = getDateRangePreset(preset);
    onChange({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  };

  return (
    <div className={gridClass}>
      <div className="sm:col-span-2">
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Date range</label>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['this_week', 'This week'],
              ['this_month', 'This month'],
              ['next_30', 'Next 30 days'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs text-[#4B5563] hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!lockProjectId && (
        <div>
          <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Project</label>
          <select
            className={SCHEDULE_FILTER_INPUT}
            value={filters.projectId}
            onChange={(e) => onChange({ projectId: e.target.value })}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Trade</label>
        <select className={SCHEDULE_FILTER_INPUT} value={filters.trade} onChange={(e) => onChange({ trade: e.target.value })}>
          <option value="">All trades</option>
          {trades.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Crew</label>
        <select className={SCHEDULE_FILTER_INPUT} value={filters.crew} onChange={(e) => onChange({ crew: e.target.value })}>
          <option value="">All crews</option>
          {crews.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Assigned user</label>
        <select
          className={SCHEDULE_FILTER_INPUT}
          value={filters.assignedUser}
          onChange={(e) => onChange({ assignedUser: e.target.value })}
        >
          <option value="">Anyone</option>
          {assignedUsers.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Priority</label>
        <select
          className={SCHEDULE_FILTER_INPUT}
          value={filters.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
        >
          <option value="">All priorities</option>
          {SCHEDULE_PRIORITIES.map((p) => (
            <option key={p} value={p}>{SCHEDULE_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Weather impact</label>
        <select
          className={SCHEDULE_FILTER_INPUT}
          value={filters.weatherRisk}
          onChange={(e) => onChange({ weatherRisk: e.target.value })}
        >
          <option value="">Any</option>
          {SCHEDULE_WEATHER_RISKS.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Status</label>
        <select className={SCHEDULE_FILTER_INPUT} value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="">All statuses</option>
          {SCHEDULE_EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>{SCHEDULE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>Event type</label>
        <select
          className={SCHEDULE_FILTER_INPUT}
          value={filters.eventType}
          onChange={(e) => onChange({ eventType: e.target.value })}
        >
          <option value="">All types</option>
          {SCHEDULE_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{SCHEDULE_EVENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>From</label>
        <input type="date" className={SCHEDULE_FILTER_INPUT} value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
      </div>
      <div>
        <label className={`mb-1 block text-xs font-medium ${SCHEDULE_MUTED}`}>To</label>
        <input type="date" className={SCHEDULE_FILTER_INPUT} value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
      </div>
    </div>
  );
}
