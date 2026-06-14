import React, { useMemo } from 'react';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import {
  OPS_ACTION_ITEM,
  OPS_BODY,
  OPS_CTA_PILL,
  OPS_MUTED,
  OPS_PANEL_INNER,
  OPS_SUBTLE,
  OPS_TITLE,
} from './opsTheme';
import {
  plannerDocumentsHref,
} from '../../utils/plannerRoutes';
import { getProjectFolder, summarizeQcBreakAlerts } from '../../utils/projectFolders';
import { resolveProjectWorkflow } from '../../utils/projectWorkflow';
import type { Project } from '../../types';
import type { TrackedProposalRow } from '../../types/proposalTracking';

interface ControlProjectRef {
  id: string;
  name: string;
}

interface ProjectControlsCardProps {
  testsDue: number;
  testsOverdue?: number;
  totalRecords: number;
  /** When undefined, deadline metrics/rows are omitted (schedule not loaded). */
  deadlineCount?: number;
  projects?: Project[];
  proposals?: TrackedProposalRow[];
  fieldNotesProject?: ControlProjectRef | null;
}

function resolveQcReviewProject(
  projects: Project[],
  proposals: TrackedProposalRow[],
): ControlProjectRef | null {
  const now = new Date();
  let overdueProject: ControlProjectRef | null = null;
  let dueProject: ControlProjectRef | null = null;

  for (const project of projects) {
    const matchedProposal = proposals.find(
      (p) =>
        p.project_id === project.id ||
        p.data?.projectTitle === project.name ||
        p.title.toLowerCase().includes(project.name.toLowerCase()),
    );
    const ctx = {
      hasProposalDraft: Boolean(matchedProposal),
      proposalStatus: matchedProposal?.status,
    };
    if (getProjectFolder(project, ctx) === 'archived') continue;

    const workflow = resolveProjectWorkflow(project, {
      hasProposalDraft: ctx.hasProposalDraft,
      proposalStatus: ctx.proposalStatus,
      windRisk: 'moderate',
      heatRisk: 'moderate',
      readinessScore: 0,
      now,
    });
    const summary = summarizeQcBreakAlerts(project, workflow.stage, ctx, now);
    if (summary.overdue > 0 && !overdueProject) {
      overdueProject = { id: project.id, name: project.name };
    }
    if (summary.openThisWeek > 0 && !dueProject) {
      dueProject = { id: project.id, name: project.name };
    }
  }

  return overdueProject ?? dueProject;
}

const QC_CLOSEOUT_FOLDER = 'qc_closeout';

function alertSummary(testsDue: number, testsOverdue: number): string {
  if (testsOverdue > 0) {
    return `${testsOverdue} break test${testsOverdue === 1 ? '' : 's'} ${testsOverdue === 1 ? 'is' : 'are'} overdue.`;
  }
  return `${testsDue} break test${testsDue === 1 ? '' : 's'} ${testsDue === 1 ? 'is' : 'are'} due this week.`;
}

function MetricChip({
  value,
  label,
  valueClassName,
}: {
  value: number | string;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className={`${OPS_PANEL_INNER} px-3 py-2 min-w-[5.5rem]`}>
      <p className={`text-base font-bold leading-none ${valueClassName ?? OPS_TITLE}`}>{value}</p>
      <p className={`mt-1 text-[10px] uppercase tracking-wide ${OPS_SUBTLE}`}>{label}</p>
    </div>
  );
}

function ActionRow({
  description,
  ctaLabel,
  onClick,
}: {
  description: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full flex-col gap-2 px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${OPS_ACTION_ITEM}`}
      >
        <span className={`min-w-0 flex-1 text-sm ${OPS_BODY}`}>{description}</span>
        <span className={OPS_CTA_PILL}>{ctaLabel}</span>
      </button>
    </li>
  );
}

const ProjectControlsCard: React.FC<ProjectControlsCardProps> = ({
  testsDue,
  testsOverdue = 0,
  totalRecords,
  deadlineCount,
  projects = [],
  proposals = [],
  fieldNotesProject = null,
}) => {
  const navigate = useNavigate();
  const qcReviewProject = useMemo(
    () => resolveQcReviewProject(projects, proposals),
    [projects, proposals],
  );
  const hasQcAlerts = testsDue > 0;
  const showDeadlines = deadlineCount !== undefined;
  const actionsNeeded =
    (hasQcAlerts ? 1 : 0) + (fieldNotesProject ? 1 : 0);

  const statusLines: string[] = [];
  if (showDeadlines) {
    if (deadlineCount > 0) {
      statusLines.push(
        `${deadlineCount} deadline${deadlineCount === 1 ? '' : 's'} in the next two weeks.`,
      );
    } else {
      statusLines.push('No upcoming deadlines in the next two weeks.');
    }
  }

  const actionRows: React.ReactNode[] = [];

  if (hasQcAlerts) {
    actionRows.push(
      <ActionRow
        key="qc"
        description={alertSummary(testsDue, testsOverdue)}
        ctaLabel="Review QC"
        onClick={() => {
          if (qcReviewProject) {
            navigate(plannerDocumentsHref(qcReviewProject.id, { tab: 'qc-reports' }));
            return;
          }
          navigate(`/projects?folder=${QC_CLOSEOUT_FOLDER}`);
        }}
      />,
    );
  }

  if (fieldNotesProject) {
    actionRows.push(
      <ActionRow
        key="field-notes"
        description={`${fieldNotesProject.name} needs QC & field notes.`}
        ctaLabel="Log notes"
        onClick={() =>
          navigate(
            plannerDocumentsHref(fieldNotesProject.id, { tab: 'daily-reports' }),
          )
        }
      />,
    );
  }

  return (
    <OpsCard className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <h3 className={`font-semibold ${OPS_TITLE}`}>Project Controls</h3>
        </div>
        <Link
          to="/planner/hub"
          className="inline-flex shrink-0 items-center gap-1 text-sm text-cyan-700 hover:underline dark:text-cyan-400"
        >
          Open planner <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div className="mb-3 flex flex-wrap gap-2">
        <MetricChip
          value={testsDue}
          label={testsOverdue > 0 ? 'Due / overdue' : 'QC due'}
          valueClassName={
            testsOverdue > 0
              ? 'text-red-600 dark:text-red-400'
              : hasQcAlerts
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-amber-600 dark:text-amber-400'
          }
        />
        <MetricChip value={totalRecords} label="QC records" />
        {showDeadlines ? (
          <MetricChip
            value={deadlineCount}
            label="Deadlines"
            valueClassName={
              deadlineCount > 0 ? 'text-amber-600 dark:text-amber-400' : OPS_TITLE
            }
          />
        ) : null}
        {actionsNeeded > 0 ? (
          <MetricChip
            value={actionsNeeded}
            label="Actions needed"
            valueClassName="text-cyan-700 dark:text-cyan-400"
          />
        ) : null}
        </div>

        {statusLines.length > 0 ? (
          <div className="space-y-1">
            {statusLines.map((line) => (
              <p key={line} className={`text-sm ${OPS_MUTED}`}>
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {actionRows.length > 0 ? (
          <ul className={`space-y-2 ${statusLines.length > 0 ? 'mt-3' : ''}`}>{actionRows}</ul>
        ) : statusLines.length === 0 ? (
          <p className={`text-sm ${OPS_MUTED}`}>No project control issues right now.</p>
        ) : null}
      </div>
    </OpsCard>
  );
};

export default ProjectControlsCard;
