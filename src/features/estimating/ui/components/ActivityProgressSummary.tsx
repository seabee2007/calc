/**
 * ActivityProgressSummary — compact field-control status panel.
 *
 * Shows:
 *   - Progress bar (% complete)
 *   - Planned vs actual production rate
 *   - Schedule variance
 *   - Forecast finish vs baseline
 *   - Log Today button
 */
import { TrendingUp, TrendingDown, Minus, Target, Calendar } from 'lucide-react';
import type { ActivityProgressRollup, ActivityBaseline } from '../../domain/activityProgressTypes';

interface Props {
  rollup: ActivityProgressRollup;
  baseline: ActivityBaseline | null;
  onLogProgress: () => void;
}

function VarianceBadge({ days }: { days: number }) {
  if (Math.abs(days) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <Minus size={9} /> On schedule
      </span>
    );
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <TrendingUp size={9} /> {Math.abs(days).toFixed(1)}d ahead
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <TrendingDown size={9} /> {days.toFixed(1)}d behind
    </span>
  );
}

export default function ActivityProgressSummary({ rollup, baseline, onLogProgress }: Props) {
  const forecast = rollup.forecast;
  const pct = rollup.percentComplete;

  // Progress bar color
  const barColor =
    pct === 100
      ? 'bg-green-500'
      : forecast && forecast.scheduleVarianceDays >= 5
        ? 'bg-amber-500'
        : 'bg-cyan-500';

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
          <Target size={12} />
          Field Progress
        </span>
        {rollup.latestReportDate && (
          <span className="text-[10px] text-slate-400">
            Last: {rollup.latestReportDate}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{pct}% complete</span>
        {rollup.totalQuantityInstalled > 0 && (
          <span>{rollup.totalQuantityInstalled.toLocaleString()} installed</span>
        )}
      </div>

      {/* Forecast details */}
      {forecast && !forecast.isComplete && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Planned vs actual rate */}
          {forecast.plannedProductionRate > 0 && (
            <span className="text-[10px] text-slate-500">
              Plan: <strong>{forecast.plannedProductionRate.toFixed(1)}</strong>/day
              {forecast.actualProductionRate !== null && (
                <>
                  {' → '}Actual: <strong>{forecast.actualProductionRate.toFixed(1)}</strong>/day
                </>
              )}
            </span>
          )}

          {/* Schedule variance badge */}
          <VarianceBadge days={forecast.scheduleVarianceDays} />

          {/* Forecast basis note */}
          {forecast.forecastBasis === 'remaining-duration' && (
            <span className="text-[10px] text-slate-400 italic">
              (crew estimate)
            </span>
          )}
        </div>
      )}

      {/* Baseline comparison */}
      {baseline && forecast && (
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Calendar size={10} />
          Baseline: {baseline.baselineDurationDays}d
          {' → '}
          Forecast: ~{(forecast.forecastRemainingDays + rollup.totalDaysWorked).toFixed(0)}d total
        </div>
      )}

      {/* Actual start / finish */}
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        {rollup.latestActualStart && (
          <span>Started: <strong className="text-slate-700 dark:text-slate-200">{rollup.latestActualStart}</strong></span>
        )}
        {rollup.latestActualFinish && (
          <span>Finished: <strong className="text-green-600 dark:text-green-400">{rollup.latestActualFinish}</strong></span>
        )}
        {rollup.latestRemainingDurationDays !== null && !rollup.latestActualFinish && (
          <span>Remaining: <strong className="text-slate-700 dark:text-slate-200">{rollup.latestRemainingDurationDays}d</strong></span>
        )}
      </div>

      {/* Warnings */}
      {forecast && forecast.warnings.length > 0 && (
        <div className="space-y-0.5">
          {forecast.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Log button */}
      {pct < 100 && (
        <button
          type="button"
          onClick={onLogProgress}
          className="w-full rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium py-1.5 transition-colors"
        >
          Log Today's Progress
        </button>
      )}
      {pct === 100 && (
        <div className="text-center text-xs font-semibold text-green-600 dark:text-green-400 py-1">
          ✓ Activity Complete
        </div>
      )}
    </div>
  );
}
