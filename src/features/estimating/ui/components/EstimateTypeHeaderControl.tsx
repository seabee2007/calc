import Button from '../../../../components/ui/Button';
import type { EstimateType } from '../../domain/estimateTypes';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import { PLANNER_MUTED, TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  estimateType: EstimateType;
  onChangeClick: () => void;
  disabled?: boolean;
}

export default function EstimateTypeHeaderControl({
  estimateType,
  onChangeClick,
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`${PLANNER_MUTED}`}>Estimate Type:</span>
      <span className={`font-medium ${TEXT_FOREGROUND}`}>
        {formatEstimateMethodLabel(estimateType)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onChangeClick}
      >
        Change
      </Button>
      <span className={`hidden text-xs sm:inline ${TEXT_BODY} ${PLANNER_MUTED}`}>
        Workflow tabs adapt to this estimate type.
      </span>
    </div>
  );
}
