import Button from '../../../../components/ui/Button';
import type { EstimateType } from '../../domain/estimateTypes';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import { BADGE_BASE, BADGE_INFO, PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  hasEstimate: boolean;
  estimateType: EstimateType;
  schedulingEnabled: boolean;
  onActionClick: () => void;
  disabled?: boolean;
}

export default function EstimateTypeHeaderControl({
  hasEstimate,
  estimateType,
  schedulingEnabled,
  onActionClick,
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {hasEstimate ? (
        <>
          <span className={PLANNER_MUTED}>Estimate Type:</span>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateMethodLabel(estimateType)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onActionClick}
          >
            Change
          </Button>
        </>
      ) : (
        <>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>No estimate type selected</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onActionClick}
          >
            Choose Estimate Type
          </Button>
        </>
      )}

      {hasEstimate ? (
        schedulingEnabled ? (
          <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Scheduling enabled</span>
        ) : (
          <span
            className={`${BADGE_BASE} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}
          >
            Scheduling not enabled
          </span>
        )
      ) : null}
    </div>
  );
}
