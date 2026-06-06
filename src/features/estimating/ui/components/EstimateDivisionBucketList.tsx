import type { EstimateDivisionBucket } from '../../application/estimateWorkBreakdown';
import type { EstimateDraftLine } from '../../application/estimateDraftLine';
import { ESTIMATE_LINE_ITEMS_PANEL } from '../estimateWorkspaceTheme';
import EstimateDivisionBucketRow from './EstimateDivisionBucketRow';

interface Props {
  divisions: EstimateDivisionBucket[];
  draftLines: EstimateDraftLine[];
  collapsedDivisionCodes?: ReadonlySet<string>;
  canEdit: boolean;
  onDivisionCollapsedChange?: (divisionCode: string, collapsed: boolean) => void;
  onAddActivity: (divisionCode: string) => void;
  onEditDraft: (clientId: string) => void;
  onRemoveDraft: (clientId: string) => void;
  onDuplicateDraft?: (clientId: string) => void;
  onMoveDraftUp?: (clientId: string) => void;
  onMoveDraftDown?: (clientId: string) => void;
}

export default function EstimateDivisionBucketList({
  divisions,
  draftLines,
  collapsedDivisionCodes,
  canEdit,
  onDivisionCollapsedChange,
  onAddActivity,
  onEditDraft,
  onRemoveDraft,
  onDuplicateDraft,
  onMoveDraftUp,
  onMoveDraftDown,
}: Props) {
  if (divisions.length === 0) return null;

  return (
    <div className={`${ESTIMATE_LINE_ITEMS_PANEL} space-y-2`}>
      {divisions.map((bucket) => (
        <EstimateDivisionBucketRow
          key={bucket.code}
          bucket={bucket}
          draftLines={draftLines}
          isOpen={!collapsedDivisionCodes?.has(bucket.code)}
          canEdit={canEdit}
          onOpenChange={(isOpen) => onDivisionCollapsedChange?.(bucket.code, !isOpen)}
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
