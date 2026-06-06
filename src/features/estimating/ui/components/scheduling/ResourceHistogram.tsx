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
    ...histogram.map((d) => d.availableCrew),
  );

  const hasOverallocation = histogram.some((d) => d.isOverallocated);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Resource histogram
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-cyan-500" />
            Required crew
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-red-500" />
            Available limit
          </span>
          {hasOverallocation && (
            <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
              Over-allocated days exist
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
              const availLineY =
                BAR_MAX_HEIGHT -
                Math.round((day.availableCrew / maxRequired) * BAR_MAX_HEIGHT);

              return (
                <div
                  key={day.dayOffset}
                  className="relative flex flex-1 flex-col items-center"
                  style={{ minWidth: 8 }}
                  title={`Day ${day.dayOffset}: ${day.requiredCrew} crew (${day.date})`}
                >
                  {/* Available crew line marker */}
                  <div
                    className="absolute left-0 right-0 border-t border-red-400"
                    style={{ top: availLineY }}
                  />
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t ${
                      day.isOverallocated
                        ? 'bg-red-500 dark:bg-red-600'
                        : 'bg-cyan-500 dark:bg-cyan-600'
                    }`}
                    style={{ height: barH }}
                  />
                </div>
              );
            })}
          </div>

          {/* Day labels (every 5) */}
          <div
            className="flex items-center gap-px px-3 pb-2"
            style={{ minWidth: Math.max(400, projectDurationDays * 10) }}
          >
            {histogram.map((day) => (
              <div
                key={day.dayOffset}
                className="flex-1 text-center text-xs text-slate-400 dark:text-slate-600"
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
