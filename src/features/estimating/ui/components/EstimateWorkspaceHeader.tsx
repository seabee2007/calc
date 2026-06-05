import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { plannerBoardHref } from '../../../../utils/plannerRoutes';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateStatus } from '../../domain/estimateTypes';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_EYEBROW,
  PLANNER_LINK,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  projectId: string;
  projectName?: string;
  estimateName?: string | null;
  estimateStatus?: EstimateStatus | null;
  hasEstimate?: boolean;
  creating?: boolean;
  dataLoading?: boolean;
  draftDirty?: boolean;
  onCreateEstimate?: () => void;
}

export default function EstimateWorkspaceHeader({
  projectId,
  projectName,
  estimateName,
  estimateStatus,
  hasEstimate = false,
  creating = false,
  dataLoading = false,
  draftDirty = false,
  onCreateEstimate,
}: Props) {
  const createLabel = creating ? 'Creating...' : hasEstimate ? 'Estimate exists' : 'Create estimate';

  return (
    <header className="mb-4 space-y-3">
      <Link to={plannerBoardHref(projectId)} className={PLANNER_LINK}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to board
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={PLANNER_EYEBROW}>Project estimate</p>
          <h1 className={`mt-1 text-xl font-semibold sm:text-2xl ${TEXT_FOREGROUND}`}>
            {estimateName ?? 'Estimate Workspace'}
          </h1>
          {projectName ? (
            <p className={`mt-1 truncate text-sm ${PLANNER_MUTED}`}>{projectName}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {estimateStatus ? (
              <FieldRecordStatusBadge status={estimateStatus} />
            ) : (
              <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Foundation Preview</span>
            )}
            {!estimateName ? (
              <span className={`text-xs ${PLANNER_SECTION_TITLE}`}>Read-only workspace</span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
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
              disabled
              className="w-full shrink-0 sm:w-auto"
              title="Save will be added in the next phase"
            >
              Save coming next phase
            </Button>
          ) : null}
          {draftDirty ? (
            <span className={`text-xs ${PLANNER_MUTED}`}>Unsaved draft line items</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
