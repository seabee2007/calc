import React from 'react';
import { PREMIUM_KPI_CARD, TEXT_FOREGROUND } from '../../theme/appTheme';

export interface PlannerHubMetric {
  id: string;
  label: string;
  value: React.ReactNode;
}

interface PlannerHubMetricsStripProps {
  metrics: PlannerHubMetric[];
  className?: string;
}

export default function PlannerHubMetricsStrip({
  metrics,
  className = '',
}: PlannerHubMetricsStripProps) {
  if (metrics.length === 0) return null;

  return (
    <div
      data-testid="planner-hub-metrics"
      className={`flex max-w-full flex-wrap gap-2 sm:gap-3 ${className}`}
      role="group"
      aria-label="Planner hub metrics"
    >
      {metrics.map((metric) => (
        <div
          key={metric.id}
          data-testid={`planner-hub-metric-${metric.id}`}
          className={`inline-flex min-w-[7.5rem] flex-col px-3 py-2 sm:px-4 sm:py-2.5 ${PREMIUM_KPI_CARD}`}
        >
          <p className={`text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400`}>
            {metric.label}
          </p>
          <p className={`mt-0.5 text-xl font-bold tabular-nums leading-none ${TEXT_FOREGROUND}`}>
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}
