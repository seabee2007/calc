import type { EstimateScheduleTaskCandidate } from '../../domain/estimateScheduleTypes';
import { BADGE_BASE, BADGE_INFO, BADGE_WARNING } from '../../../../theme/statusColors';
import {
  formatScheduleDays,
  formatScheduleDurationDays,
  formatScheduleLaborHours,
  formatScheduleTradeActivity,
  formatScheduleWarningList,
} from '../estimateScheduleDisplay';
import { formatEstimateBlank } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  candidate: EstimateScheduleTaskCandidate;
}

export default function EstimateScheduleTaskCandidateCard({ candidate }: Props) {
  const warningLines = formatScheduleWarningList(candidate.warnings);

  return (
    <article
      className={`${PLANNER_FORM_PANEL} border border-slate-200/80 dark:border-slate-700`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>
            {formatEstimateBlank(candidate.title)}
          </h4>
          <p className={`mt-0.5 text-xs ${PLANNER_MUTED}`}>
            {formatScheduleTradeActivity(candidate.trade, candidate.activity)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {candidate.weatherSensitive ? (
            <span className={`${BADGE_BASE} ${BADGE_WARNING}`}>Weather sensitive</span>
          ) : null}
          {candidate.inspectionRequired ? (
            <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Inspection required</span>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className={PLANNER_MUTED}>Labor hours</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {formatScheduleLaborHours(
              candidate.labor.adjustedLaborHours || candidate.labor.laborHours,
            )}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Man-days</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {formatScheduleDays(candidate.labor.manDays)}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Crew-days</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {formatScheduleDays(candidate.labor.crewDays)}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Duration</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {formatScheduleDurationDays(candidate.labor.durationDays)}
          </dd>
        </div>
      </dl>

      {warningLines.length > 0 ? (
        <ul className={`mt-3 space-y-1 text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
          {warningLines.map((line) => (
            <li key={line} className="list-inside list-disc">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
