import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ScheduleConstructionKpis } from '../../utils/scheduleConstructionKpis';
import { SCHEDULE_MUTED } from './scheduleTheme';

interface Props {
  kpis: ScheduleConstructionKpis;
}

function KpiCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-[100px] flex-col gap-0.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <span className={`text-[10px] font-medium uppercase tracking-wide ${SCHEDULE_MUTED}`}>
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums text-[#1F2937] dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export default function ScheduleConstructionKpiBar({ kpis }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0 border-b border-[#E5E7EB] bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/50 sm:px-4"
        aria-expanded={expanded}
        aria-controls="schedule-kpi-panel"
      >
        <span className="text-xs font-semibold text-[#1F2937] dark:text-slate-200">
          Construction snapshot
          {!expanded && (
            <span className={`ml-2 font-normal ${SCHEDULE_MUTED}`}>
              · {kpis.activeEvents} active
              {kpis.deliveries > 0 && ` · ${kpis.deliveries} deliveries`}
              {kpis.inspections > 0 && ` · ${kpis.inspections} inspections`}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform duration-200 dark:text-slate-400 ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {expanded && (
        <div
          id="schedule-kpi-panel"
          className="flex flex-wrap gap-2 border-t border-[#E5E7EB]/80 px-3 pb-2 pt-2 dark:border-slate-700/80 sm:px-4"
        >
          <KpiCell label="Active events" value={kpis.activeEvents} />
          <KpiCell label="Deliveries" value={kpis.deliveries} />
          <KpiCell label="Inspections" value={kpis.inspections} />
          <KpiCell label="Deadlines" value={kpis.deadlines} />
          <KpiCell label="Active crews" value={kpis.activeCrews} />
        </div>
      )}
    </div>
  );
}
