import type { EstimateWorkBreakdown } from '../../application/estimateWorkBreakdown';
import type { EstimateDraftLine } from '../../application/estimateDraftLine';
import { ESTIMATE_LINE_ITEMS_PANEL } from '../estimateWorkspaceTheme';
import EstimateDivisionBucketRow from './EstimateDivisionBucketRow';

interface Props {
  breakdown: EstimateWorkBreakdown;
  draftLines: EstimateDraftLine[];
  canEdit: boolean;
  onAddActivity: (divisionCode: string) => void;
  onEditDraft: (clientId: string) => void;
  onRemoveDraft: (clientId: string) => void;
  onDuplicateDraft?: (clientId: string) => void;
  onMoveDraftUp?: (clientId: string) => void;
  onMoveDraftDown?: (clientId: string) => void;
}

export default function EstimateDivisionBucketList({
  breakdown,
  draftLines,
  canEdit,
  onAddActivity,
  onEditDraft,
  onRemoveDraft,
  onDuplicateDraft,
  onMoveDraftUp,
  onMoveDraftDown,
}: Props) {
  if (breakdown.divisions.length === 0) return null;

  return (
    <div className={`${ESTIMATE_LINE_ITEMS_PANEL} space-y-2`}>
      {breakdown.divisions.map((bucket) => (
        <EstimateDivisionBucketRow
          key={bucket.code}
          bucket={bucket}
          draftLines={draftLines}
          canEdit={canEdit}
          onAddActivity={onAddActivity}
          onEditDraft={onEditDraft}
          onRemoveDraft={onRemoveDraft}
          onDuplicateDraft={onDuplicateDraft}
          onMoveDraftUp={onMoveDraftUp}
          onMoveDraftDown={onMoveDraftDown}
        />
      ))}
    </div>
  );
}
