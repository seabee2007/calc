import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Folder,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import Card from '../ui/Card';
import { PREMIUM_PANEL, TEXT_FOREGROUND, TEXT_MUTED, TEXT_SUBTLE } from '../../theme/appTheme';
import type { Project } from '../../types';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  resolveProjectWorkflow,
  getProjectCardPresentation,
} from '../../utils/projectWorkflow';
import {
  getQcBreakStatus,
  type ProjectFolder,
} from '../../utils/projectFolders';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  formatProjectCardCreatedDate,
  formatProjectCardEstimateLine,
  formatProjectCardOpenItemsLine,
  formatProjectCardScheduleLine,
  formatProjectCardTargetDate,
  getProjectCardEstimateState,
  getProjectCardFinancialLine,
  getProjectCardRiskIndicator,
  getProjectCardScheduleState,
  getProjectCardStatusBadge,
  getProjectCardWorkflowReadiness,
  inferProjectCardScopeChip,
  resolveProjectCardNextActionLabel,
} from '../../utils/projectCardDisplay';

interface ProjectCardProps {
  project: Project;
  folder?: ProjectFolder;
  onClick: () => void;
  onDelete: () => void;
}

function breakStatusLabel(complete: boolean, overdue?: boolean): string {
  if (complete) return 'Complete';
  if (overdue) return 'Overdue';
  return 'Pending';
}

function parseTargetDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  folder = 'active',
  onClick,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { proposals } = useTrackedProposals();

  const stopCardOpen = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCardClick = async () => {
    await hapticService.selection();
    onClick();
  };

  const matchedProposal: TrackedProposalRow | undefined = useMemo(() => {
    const direct = proposals.find((proposal) => proposal.project_id === project.id);
    if (direct) return direct;
    const name = project.name?.trim() ?? '';
    if (!name) return undefined;
    const lower = name.toLowerCase();
    return proposals.find(
      (proposal) =>
        proposal.data?.projectTitle === name ||
        proposal.title?.toLowerCase().includes(lower),
    );
  }, [proposals, project.id, project.name]);

  const workflow = resolveProjectWorkflow(project, {
    hasProposalDraft: Boolean(matchedProposal),
    proposalStatus: matchedProposal?.status,
    windRisk: 'unknown',
    heatRisk: 'unknown',
    readinessScore: 0,
    now: new Date(),
  });

  const targetDate = parseTargetDate(project.pourDate);
  const hasTargetDate = Boolean(project.pourDate);
  const folderCtx = {
    hasProposalDraft: Boolean(matchedProposal),
    proposalStatus: matchedProposal?.status,
  };

  const qcStatus = getQcBreakStatus(project, workflow.stage, folderCtx);

  const presentation = getProjectCardPresentation(
    workflow.stage,
    workflow.nextAction.label,
    hasTargetDate,
    targetDate,
  );

  const statusBadge = getProjectCardStatusBadge(folder, presentation);
  const readiness = getProjectCardWorkflowReadiness(workflow.stage);
  const estimateState = getProjectCardEstimateState(
    project,
    workflow.stage,
    Boolean(matchedProposal),
    matchedProposal?.status,
  );
  const scheduleState = getProjectCardScheduleState(
    workflow.stage,
    project.pourDate,
  );
  const financialLine = getProjectCardFinancialLine(matchedProposal);
  const openItemsLine = formatProjectCardOpenItemsLine();
  const nextActionLabel = resolveProjectCardNextActionLabel({
    folder,
    rawNextActionLabel: presentation.nextActionLabel,
    qcNextDueLabel: qcStatus.nextDueLabel,
    qcComplete: qcStatus.qcComplete,
  });
  const riskIndicator = getProjectCardRiskIndicator({
    folder,
    stage: workflow.stage,
    project,
    proposalStatus: matchedProposal?.status,
    hasProposalDraft: Boolean(matchedProposal),
    qcOverdue: qcStatus.isOverdue,
  });
  const scopeChip = inferProjectCardScopeChip(project.name, project.description);
  const createdLabel = formatProjectCardCreatedDate(project.createdAt);
  const targetDateLabel = formatProjectCardTargetDate(project.pourDate);

  const riskTone =
    riskIndicator === 'QC overdue' || riskIndicator === 'Deposit due'
      ? 'text-amber-600 dark:text-amber-400'
      : riskIndicator === 'Needs estimate' || riskIndicator === 'Follow up'
        ? 'text-amber-600 dark:text-amber-400'
        : riskIndicator === 'Closeout pending'
          ? 'text-violet-600 dark:text-violet-400'
          : riskIndicator === 'Archived'
            ? 'text-slate-500 dark:text-slate-400'
            : 'text-emerald-600 dark:text-emerald-400';

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => void handleCardClick()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleCardClick();
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={`project-card-${project.id}`}
      className="w-full min-w-0"
    >
      <Card
        className={`h-full w-full min-w-0 cursor-pointer overflow-hidden ${PREMIUM_PANEL} ${statusBadge.ringClass}`}
        shadow="md"
      >
        <div className="p-4 sm:p-5 md:p-6">
          <div className="mb-4 flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-xl font-bold leading-tight line-clamp-2 break-words sm:text-2xl ${TEXT_FOREGROUND}`}
                    title={project.name}
                  >
                    {project.name}
                  </h3>
                  {scopeChip ? (
                    <span className="mt-0.5 inline-block text-[10px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                      {scopeChip}
                    </span>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge.badgeClass}`}
                  >
                    {statusBadge.label}
                  </span>
                  <div
                    className="relative"
                    onClick={stopCardOpen}
                    onPointerDownCapture={stopCardOpen}
                    onMouseDownCapture={stopCardOpen}
                    onTouchStartCapture={stopCardOpen}
                  >
                    <button
                      type="button"
                      aria-label="Project actions"
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      onClick={() => setMenuOpen((open) => !open)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10"
                          aria-label="Close menu"
                          onClick={() => setMenuOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMenuOpen(false);
                              soundService.play('trash');
                              onDelete();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete project
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {targetDateLabel && folder === 'active' ? (
            <p className={`text-xs ${TEXT_SUBTLE} mb-3 text-right`}>
              Target {targetDateLabel}
            </p>
          ) : null}

          <div className="mb-3 w-full min-w-0 overflow-hidden rounded-lg border border-gray-200/60 bg-white/40 p-3 dark:border-gray-700/70 dark:bg-gray-900/20 sm:p-4 space-y-3">
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-wide ${TEXT_SUBTLE}`}>
                Next action
              </p>
              <p
                className={`mt-0.5 flex items-start gap-2 text-sm font-semibold ${TEXT_FOREGROUND}`}
              >
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                <span className="min-w-0 break-words">{nextActionLabel}</span>
              </p>
            </div>

            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className={`text-[10px] uppercase tracking-wide ${TEXT_SUBTLE}`}>
                  Workflow readiness
                </p>
                <span className={`shrink-0 text-xs font-semibold ${TEXT_FOREGROUND}`}>
                  {readiness.label}
                </span>
              </div>
              <div className="h-1.5 w-full max-w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-1.5 rounded-full ${
                    folder === 'archived' || workflow.stage === 'closed'
                      ? 'bg-slate-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  }`}
                  style={{ width: `${folder === 'archived' ? 100 : readiness.percent}%` }}
                />
              </div>
            </div>

            <div className={`min-w-0 space-y-1 text-xs break-words ${TEXT_MUTED}`}>
              <p>{formatProjectCardEstimateLine(estimateState)}</p>
              <p>{formatProjectCardScheduleLine(scheduleState)}</p>
              <p>{financialLine}</p>
              <p>
                <span className={TEXT_SUBTLE}>Open items: </span>
                {openItemsLine}
              </p>
            </div>
          </div>

          {folder === 'qc_closeout' && (
            <div className="mb-3 w-full min-w-0 overflow-hidden rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 dark:bg-violet-950/20 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-violet-400/90">
                QC closeout
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Work completed:{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {qcStatus.placedDateLabel}
                </span>
              </p>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">7-day</p>
                  <p
                    className={`font-semibold ${
                      qcStatus.sevenDayComplete
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : qcStatus.sevenDayOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {breakStatusLabel(qcStatus.sevenDayComplete, qcStatus.sevenDayOverdue)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">14-day</p>
                  <p
                    className={`font-semibold ${
                      qcStatus.fourteenDayComplete
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : qcStatus.fourteenDayOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {breakStatusLabel(
                      qcStatus.fourteenDayComplete,
                      qcStatus.fourteenDayOverdue,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">28-day</p>
                  <p
                    className={`font-semibold ${
                      qcStatus.twentyEightDayComplete
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : qcStatus.twentyEightDayOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {breakStatusLabel(
                      qcStatus.twentyEightDayComplete,
                      qcStatus.twentyEightDayOverdue,
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-violet-500/15 pt-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Next:{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {qcStatus.nextDueLabel}
                  </span>
                </span>
                <span
                  className={
                    qcStatus.isOverdue
                      ? 'font-semibold text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-300'
                  }
                >
                  {qcStatus.daysUntilOrOverdueLabel}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  <span>QC progress</span>
                  <span>{qcStatus.progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full max-w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-1.5 bg-violet-500 rounded-full"
                    style={{ width: `${qcStatus.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={`mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between ${TEXT_SUBTLE}`}>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 shrink-0" />
              <span>{createdLabel}</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${riskTone}`}>
              {riskIndicator === 'On track' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{riskIndicator}</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;
