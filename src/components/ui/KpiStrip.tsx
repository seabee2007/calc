import React from 'react';
import {
  BORDER_DEFAULT,
  PREMIUM_KPI_CARD,
  SURFACE,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';

export interface KpiMetric {
  label: string;
  value: React.ReactNode;
  change?: string;
  /** Highlight value (e.g. success metric). */
  highlight?: boolean;
}

export interface KpiStripProps {
  metrics: KpiMetric[];
  loading?: boolean;
  className?: string;
  /** Use premium canvas card styling (light + dark). */
  premium?: boolean;
}

function KpiSkeleton({ premium = false }: { premium?: boolean }) {
  const cardClass = premium
    ? PREMIUM_KPI_CARD
    : `rounded-lg border p-4 ${BORDER_DEFAULT} ${SURFACE}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-none lg:flex lg:flex-wrap">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`min-w-[140px] flex-1 animate-pulse ${cardClass}`}>
          <div className="mb-2 h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

const KpiStrip: React.FC<KpiStripProps> = ({
  metrics,
  loading = false,
  className = '',
  premium = false,
}) => {
  if (loading) {
    return <KpiSkeleton premium={premium} />;
  }

  const cardClass = premium
    ? PREMIUM_KPI_CARD
    : `rounded-lg border p-4 ${BORDER_DEFAULT} ${SURFACE}`;

  const labelClass = premium
    ? 'text-sm font-medium text-slate-600 dark:text-slate-300'
    : `text-sm ${TEXT_MUTED}`;

  const valueClass = premium
    ? 'mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50'
    : `mt-1 text-2xl font-bold tabular-nums ${TEXT_FOREGROUND}`;

  const changeClass = premium
    ? 'mt-0.5 text-xs text-slate-500 dark:text-slate-400'
    : `mt-0.5 text-xs ${TEXT_MUTED}`;

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap ${className}`}
      role="group"
      aria-label="Key metrics"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className={`min-w-[140px] flex-1 ${cardClass}`}>
          <p className={labelClass}>{metric.label}</p>
          <p
            className={`${valueClass} ${
              metric.highlight ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            {metric.value}
          </p>
          {metric.change ? (
            <p className={changeClass}>{metric.change}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
