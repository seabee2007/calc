import React from 'react';
import { BORDER_DEFAULT, SURFACE, TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';

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
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-none lg:flex lg:flex-wrap">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`min-w-[140px] flex-1 animate-pulse rounded-lg border p-4 ${BORDER_DEFAULT} ${SURFACE}`}
        >
          <div className="mb-2 h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

const KpiStrip: React.FC<KpiStripProps> = ({ metrics, loading = false, className = '' }) => {
  if (loading) {
    return <KpiSkeleton />;
  }

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap ${className}`}
      role="group"
      aria-label="Key metrics"
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`min-w-[140px] flex-1 rounded-lg border p-4 ${BORDER_DEFAULT} ${SURFACE}`}
        >
          <p className={`text-sm ${TEXT_MUTED}`}>{metric.label}</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              metric.highlight ? 'text-emerald-600 dark:text-emerald-400' : TEXT_FOREGROUND
            }`}
          >
            {metric.value}
          </p>
          {metric.change ? (
            <p className={`mt-0.5 text-xs ${TEXT_MUTED}`}>{metric.change}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
