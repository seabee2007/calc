import { Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateStatus, EstimateType } from '../../domain/estimateTypes';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_MUTED,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

interface Props {
  estimateStatus?: EstimateStatus | null;
  estimateType?: EstimateType | null;
  hasEstimate?: boolean;
  creating?: boolean;
  dataLoading?: boolean;
  draftDirty?: boolean;
  canSave?: boolean;
  saving?: boolean;
  onCreateEstimate?: () => void;
  onSaveEstimate?: () => void;
}

export default function EstimateWorkspaceHeader({
  estimateStatus,
  estimateType = null,
  hasEstimate = false,
  creating = false,
  dataLoading = false,
  draftDirty = false,
  canSave = false,
  saving = false,
  onCreateEstimate,
  onSaveEstimate,
}: Props) {
  const createLabel = creating ? 'Creating...' : hasEstimate ? 'Estimate exists' : 'Create estimate';

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {estimateStatus ? (
          <FieldRecordStatusBadge status={estimateStatus} />
        ) : (
          <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Draft</span>
        )}
        {hasEstimate && estimateType ? (
          <span className={`${BADGE_BASE} ${BADGE_INFO}`}>
            {formatEstimateMethodLabel(estimateType)}
          </span>
        ) : null}
        {draftDirty ? (
          <span className={`text-xs ${PLANNER_MUTED}`}>Unsaved draft line items</span>
        ) : null}
        {!hasEstimate ? (
          <span className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
            Select an estimate method below, then create the draft.
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="accent"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          disabled={hasEstimate || creating || dataLoading || !onCreateEstimate}
          isLoading={creating}
          className="w-full shrink-0 sm:w-auto"
          title={
            hasEstimate
              ? 'An estimate already exists for this project'
              : creating
                ? 'Creating draft estimate'
                : undefined
          }
          onClick={onCreateEstimate}
        >
          {createLabel}
        </Button>
        {hasEstimate ? (
          <Button
            variant="outline"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            disabled={!canSave || saving || !onSaveEstimate}
            isLoading={saving}
            className="w-full shrink-0 sm:w-auto"
            title={
              canSave
                ? 'Save draft line items as a new estimate version'
                : 'Add draft line items and make changes to enable save'
            }
            onClick={onSaveEstimate}
          >
            {saving ? 'Saving...' : 'Save estimate'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
