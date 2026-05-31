import React from 'react';
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
  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 dark:border-slate-700 dark:bg-slate-950 sm:px-4">
      <KpiCell label="Active events" value={kpis.activeEvents} />
      <KpiCell label="Deliveries" value={kpis.deliveries} />
      <KpiCell label="Inspections" value={kpis.inspections} />
      <KpiCell label="Deadlines" value={kpis.deadlines} />
      <KpiCell label="Active crews" value={kpis.activeCrews} />
    </div>
  );
}
