import type { EstimateScheduleBaseline } from '../../application/estimateScheduleBaseline';
import { formatSchedulePlannedDate } from '../estimateScheduleDisplay';
import { ESTIMATE_BLANK, formatEstimateNumber } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

interface Props {
  baseline: EstimateScheduleBaseline;
  loading?: boolean;
}

export default function EstimateBaselineSummary({ baseline, loading = false }: Props) {
  const durationDisplay =
    baseline.totalDurationDays > 0
      ? `${formatEstimateNumber(baseline.totalDurationDays, { decimals: 0 })} days`
      : ESTIMATE_BLANK;

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Baseline preview</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Preview-only baseline snapshot from the current planned schedule.
        </p>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Baseline start
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {formatSchedulePlannedDate(baseline.projectStartDate)}
            </p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Baseline finish
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {formatSchedulePlannedDate(baseline.projectFinishDate)}
            </p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Baseline duration
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {durationDisplay}
            </p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Baseline tasks
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {formatEstimateNumber(baseline.taskBaselines.length, { decimals: 0 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
