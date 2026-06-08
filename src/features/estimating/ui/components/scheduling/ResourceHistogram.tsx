import type { ResourceHistogramDay } from '../../../scheduling/cpmTypes';

const BAR_MAX_HEIGHT = 80;
const MIN_BAR_HEIGHT = 2;

interface Props {
  histogram: ResourceHistogramDay[];
  projectDurationDays: number;
}

export default function ResourceHistogram({ histogram, projectDurationDays }: Props) {
  if (histogram.length === 0) return null;

  const maxRequired = Math.max(
    1,
    ...histogram.map((d) => d.requiredCrew),
    ...histogram.map((d) => d.criticalRequiredCrew),
    ...histogram.map((d) => d.availableCrew),
  );

  const hasOverallocation = histogram.some((d) => d.isOverallocated);
  const overallocatedDayCount = histogram.filter((d) => d.isOverallocated).length;
  const availableCrew = histogram[0]?.availableCrew ?? 0;
  const peakRequired = Math.max(...histogram.map((d) => d.requiredCrew));
  const peakCritical = Math.max(...histogram.map((d) => d.criticalRequiredCrew));

  return (
    <div className="space-y-2">
      {/* Header + legend */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Resource histogram
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-cyan-500" />
            Required crew
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-amber-400" />
            Critical resources
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-red-500" />
            Available crew
          </span>
          {hasOverallocation && (
            <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              Overallocated days: {overallocatedDayCount}
            </span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Peak required crew</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{peakRequired}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Peak critical resources</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{peakCritical}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Available crew</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{availableCrew}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Overallocated days</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{overallocatedDayCount}</p>
        </div>
      </div>

      {/* Histogram chart */}
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <div
            className="relative flex items-end gap-px px-3 pb-3 pt-4"
            style={{ minWidth: Math.max(400, projectDurationDays * 10) }}
          >
            {histogram.map((day) => {
              const barH = Math.max(
                MIN_BAR_HEIGHT,
                Math.round((day.requiredCrew / maxRequired) * BAR_MAX_HEIGHT),
              );
              const criticalH = Math.max(
                0,
                Math.round((day.criticalRequiredCrew / maxRequired) * BAR_MAX_HEIGHT),
              );
              const availLineY =
                BAR_MAX_HEIGHT -
                Math.round((day.availableCrew / maxRequired) * BAR_MAX_HEIGHT);

              return (
                <div
                  key={day.dayOffset}
                  className="relative flex flex-1 flex-col items-center"
                  style={{ minWidth: 8 }}
                  title={`Day ${day.dayOffset}: required ${day.requiredCrew}, critical ${day.criticalRequiredCrew}, available ${day.availableCrew} (${day.date})`}
                >
                  <div
                    className="absolute left-0 right-0 border-t border-red-400"
                    style={{ top: availLineY }}
                  />
                  <div
                    className={`relative w-full rounded-t ${
                      day.isOverallocated
                        ? 'bg-red-500 dark:bg-red-600'
                        : 'bg-cyan-500 dark:bg-cyan-600'
                    }`}
                    style={{ height: barH }}
                  >
                    {criticalH > 0 ? (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-amber-400 dark:bg-amber-500"
                        style={{ height: Math.min(barH, criticalH) }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day offset axis labels */}
          <div
            className="flex items-center gap-px px-3 pb-2"
            style={{ minWidth: Math.max(400, projectDurationDays * 10) }}
          >
            {histogram.map((day) => (
              <div
                key={day.dayOffset}
                className="flex-1 text-center text-xs text-slate-500 dark:text-slate-600"
                style={{ minWidth: 8 }}
              >
                {day.dayOffset % 5 === 0 ? day.dayOffset : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
