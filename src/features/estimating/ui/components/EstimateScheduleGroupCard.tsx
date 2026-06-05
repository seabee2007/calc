import type { EstimateScheduleGroup } from '../../domain/estimateScheduleTypes';
import { formatScheduleGroupLabel } from '../estimateScheduleDisplay';
import { formatEstimateNumber } from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';
import EstimateScheduleTaskCandidateCard from './EstimateScheduleTaskCandidateCard';

interface Props {
  division: EstimateScheduleGroup;
}

export default function EstimateScheduleGroupCard({ division }: Props) {
  return (
    <section className={`${PLANNER_FORM_PANEL} space-y-4`}>
      <div>
        <h3 className={PLANNER_SECTION_TITLE}>
          {formatScheduleGroupLabel(division.key, division.label)}
        </h3>
        <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>
          {formatEstimateNumber(division.rollup.itemCount, { decimals: 0 })} task
          {division.rollup.itemCount === 1 ? '' : 's'} ·{' '}
          {formatEstimateNumber(division.rollup.durationDays, { decimals: 1 })} total duration days
        </p>
      </div>

      <div className="space-y-4">
        {division.scopes.map((scope) => (
          <div key={`${division.key}:${scope.key}`} className="space-y-2">
            <div>
              <h4 className={`text-sm font-semibold ${TEXT_BODY}`}>
                {formatScheduleGroupLabel(scope.key, scope.label)}
              </h4>
              <p className={`text-xs ${PLANNER_MUTED}`}>
                {formatEstimateNumber(scope.rollup.itemCount, { decimals: 0 })} candidate
                {scope.rollup.itemCount === 1 ? '' : 's'}
              </p>
            </div>

            <ul className="space-y-2" role="list">
              {scope.tasks.map((candidate) => (
                <li key={candidate.candidateId}>
                  <EstimateScheduleTaskCandidateCard candidate={candidate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
