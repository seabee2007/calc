import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { plannerBoardHref } from '../../../../utils/plannerRoutes';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_EYEBROW,
  PLANNER_LINK,
  PLANNER_SECTION_TITLE,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  projectId: string;
  projectName?: string;
}

export default function EstimateWorkspaceHeader({ projectId, projectName }: Props) {
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
            Estimate Workspace
          </h1>
          {projectName ? (
            <p className={`mt-1 truncate text-sm ${PLANNER_SECTION_TITLE}`}>{projectName}</p>
          ) : null}
          <div className="mt-2">
            <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Foundation Preview</span>
          </div>
        </div>

        <Button
          variant="accent"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          disabled
          className="w-full shrink-0 sm:w-auto"
          title="Coming in a future phase"
        >
          Create estimate
        </Button>
      </div>
    </header>
  );
}
