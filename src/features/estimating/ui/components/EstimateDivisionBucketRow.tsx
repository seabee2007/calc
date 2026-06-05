import { Plus } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import type { EstimateDivisionBucket } from '../../application/estimateWorkBreakdown';
import { filterDraftLinesForDivision } from '../../application/estimateWorkBreakdown';
import type { EstimateDraftLine } from '../../application/estimateDraftLine';
import { groupEstimateDraftLines } from '../../application/estimateLineItemGrouping';
import EstimateGroupTotalsRow from './EstimateGroupTotalsRow';
import EstimateLineItemsGroupedView from './EstimateLineItemsGroupedView';
import { PLANNER_MUTED } from '../estimateWorkspaceTheme';

interface Props {
  bucket: EstimateDivisionBucket;
  draftLines: EstimateDraftLine[];
  canEdit: boolean;
  onAddActivity: (divisionCode: string) => void;
  onEditDraft: (clientId: string) => void;
  onRemoveDraft: (clientId: string) => void;
  onDuplicateDraft?: (clientId: string) => void;
  onMoveDraftUp?: (clientId: string) => void;
  onMoveDraftDown?: (clientId: string) => void;
  defaultOpen?: boolean;
}

export default function EstimateDivisionBucketRow({
  bucket,
  draftLines,
  canEdit,
  onAddActivity,
  onEditDraft,
  onRemoveDraft,
  onDuplicateDraft,
  onMoveDraftUp,
  onMoveDraftDown,
  defaultOpen = true,
}: Props) {
  const divisionDraftLines = filterDraftLinesForDivision(draftLines, bucket.code);
  const draftGroups = groupEstimateDraftLines(divisionDraftLines);

  return (
    <EstimateGroupTotalsRow
      level="division"
      title={bucket.label}
      rollup={bucket.rollup}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-3">
        {divisionDraftLines.length === 0 ? (
          <p className={`px-1 text-sm ${PLANNER_MUTED}`}>
            No activities yet. Add the first work activity under this division.
          </p>
        ) : (
          <EstimateLineItemsGroupedView
            mode="draft"
            groups={draftGroups}
            allDraftLines={draftLines}
            defaultCollapsed={false}
            scopesOnly
            emptyMessage="No draft activities in this division."
            onEditDraft={onEditDraft}
            onRemoveDraft={onRemoveDraft}
            onDuplicateDraft={onDuplicateDraft}
            onMoveDraftUp={onMoveDraftUp}
            onMoveDraftDown={onMoveDraftDown}
          />
        )}

        <div className="px-1 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={() => onAddActivity(bucket.code)}
          >
            Add activity
          </Button>
        </div>
      </div>
    </EstimateGroupTotalsRow>
  );
}
