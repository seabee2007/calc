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
  const handleChangeClick = () => {
    // #region agent log
    fetch('http://127.0.0.1:7822/ingest/f8847b5c-ebf8-4ffb-8ef5-2ae8f29ce67d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0c8c0'},body:JSON.stringify({sessionId:'d0c8c0',runId:'change-button-pre-fix-1',hypothesisId:'H1,H2',location:'EstimateTypeHeaderControl.tsx:17',message:'estimate type change button handler fired',data:{estimateType,disabled},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    onChangeClick();
  };

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
        onClick={handleChangeClick}
      >
        Change
      </Button>
      <span className={`hidden text-xs sm:inline ${TEXT_BODY} ${PLANNER_MUTED}`}>
        Workflow tabs adapt to this estimate type.
      </span>
    </div>
  );
}
