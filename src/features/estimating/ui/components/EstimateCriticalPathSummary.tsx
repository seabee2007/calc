import type { EstimateCriticalPathResult } from '../../application/estimateCriticalPath';
import { formatSchedulePlannedDate } from '../estimateScheduleDisplay';
import { ESTIMATE_BLANK, formatEstimateNumber } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

interface Props {
  result: EstimateCriticalPathResult;
  loading?: boolean;
}

export default function EstimateCriticalPathSummary({ result, loading = false }: Props) {
  const criticalCount = result.criticalTaskIds.length;
  const durationDisplay =
    result.projectDurationDays > 0
      ? `${formatEstimateNumber(result.projectDurationDays, { decimals: 0 })} days`
      : ESTIMATE_BLANK;
  const finishDisplay = formatSchedulePlannedDate(result.projectFinishDate);

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-3`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Critical path preview</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Read-only preview based on planned dates and finish-to-start dependencies.
        </p>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Critical tasks
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {formatEstimateNumber(criticalCount, { decimals: 0 })}
            </p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Project duration
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {durationDisplay}
            </p>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Project finish
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${TEXT_BODY}`}>
              {finishDisplay}
            </p>
          </div>
        </div>
      )}

      {result.warnings.length > 0 ? (
        <ul className={`space-y-1 text-sm ${PLANNER_MUTED}`}>
          {result.warnings.map((warning) => (
            <li key={warning.code} className="list-inside list-disc">
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
