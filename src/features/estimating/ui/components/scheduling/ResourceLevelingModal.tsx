import type { ResourceLevelingResult } from '../../../scheduling/cpmTypes';

interface Props {
  result: ResourceLevelingResult;
  onApply: () => void;
  onCancel: () => void;
}

export default function ResourceLevelingModal({ result, onApply, onCancel }: Props) {
  const durationChange = result.projectDurationAfter - result.projectDurationBefore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Resource leveling preview
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deterministic float-based schedule shift. CPM dates, durations, and activity crew sizes
            are preserved until you apply leveled offsets.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Available crew size</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {result.availableCrewSize}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Peak crew before</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {result.peakCrewBefore}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Peak crew after</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {result.peakCrewAfter}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Duration before</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {result.projectDurationBefore}d
              </p>
            </div>
            <div
              className={`rounded-lg border p-3 ${
                durationChange > 0
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">Duration after</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  durationChange > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                {result.projectDurationAfter}d{' '}
                {durationChange > 0 && (
                  <span className="text-sm font-normal">(+{durationChange}d)</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Overallocated days</p>
              <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {result.overallocatedDaysBefore} → {result.overallocatedDaysAfter}
              </p>
            </div>
          </div>

          {result.movedActivities.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Activities moved ({result.movedActivities.length})
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                        Code
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                        Old start
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                        New start
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                        Moved
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                        Dependents
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.movedActivities.map((moved) => (
                      <tr
                        key={moved.activityCode}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {moved.activityCode}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          Day {moved.oldStart}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          Day {moved.newStart}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          +{moved.daysMoved}d
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {moved.dependentActivityCodes?.length
                            ? moved.dependentActivityCodes.join(', ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No activities were moved. Schedule is already resource-balanced.
            </p>
          )}

          {result.unmovedActivities.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Activities not movable ({result.unmovedActivities.length})
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                {result.unmovedActivities.map((entry) => (
                  <li key={entry.activityCode} className="text-slate-600 dark:text-slate-300">
                    <span className="font-mono">{entry.activityCode}</span>: {entry.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                Warnings
              </p>
              <ul className="space-y-1">
                {result.warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="text-xs text-amber-700 dark:text-amber-300"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            onClick={onApply}
          >
            Apply resource leveling
          </button>
        </div>
      </div>
    </div>
  );
}
