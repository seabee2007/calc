import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Folder, Clock, Trash2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { Project } from '../../types';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import {
  resolveProjectWorkflow,
  PROJECT_WORKFLOW_LABELS,
  normalizeWorkflowStageForDisplay,
  getProjectCardPresentation,
} from '../../utils/projectWorkflow';
import {
  getQcBreakStatus,
  type ProjectFolder,
} from '../../utils/projectFolders';
import {
  PLACEMENT_ORDER_STATUS_LABELS,
  type PlacementOrderStatus,
} from '../../types/placementOrder';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import type { TrackedProposalRow } from '../../types/proposalTracking';

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

function parsePourDate(iso?: string): Date | null {
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
  const p = project as any;
  const { proposals } = useTrackedProposals();
  const stopCardOpen = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleCardClick = async () => {
    await hapticService.selection();
    onClick();
  };

  const formattedDate = (() => {
    try {
      if (!project.updatedAt) return '—';
      const date = parseISO(project.updatedAt);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', project.updatedAt);
        return '—';
      }
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '—';
    }
  })();

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

  const workflow = resolveProjectWorkflow(project as any, {
    hasProposalDraft: Boolean(matchedProposal),
    proposalStatus: matchedProposal?.status,
    windRisk: 'unknown',
    heatRisk: 'unknown',
    readinessScore: 0,
    now: new Date(),
  });

  const displayStage = normalizeWorkflowStageForDisplay(workflow.stage);
  const pourDate = parsePourDate(p.pourDate);
  const hasPourDate = Boolean(p.pourDate);
  const folderCtx = {
    hasProposalDraft: Boolean(matchedProposal),
    proposalStatus: matchedProposal?.status,
  };

  const qcStatus = getQcBreakStatus(project, workflow.stage, folderCtx);

  const presentation = getProjectCardPresentation(
    workflow.stage,
    workflow.nextAction.label,
    hasPourDate,
    pourDate,
  );

  const badgeLabel =
    folder === 'qc_closeout'
      ? 'QC Closeout'
      : folder === 'archived'
        ? 'Archived'
        : presentation.priorityLabel;

  const badgeClass =
    folder === 'qc_closeout'
      ? 'bg-violet-500/15 text-violet-200 border-violet-500/40'
      : folder === 'archived'
        ? 'bg-slate-600/25 text-slate-200 border-slate-500/50'
        : presentation.priorityBadgeClass;

  const ringClass =
    folder === 'qc_closeout'
      ? 'ring-1 ring-violet-500/35'
      : presentation.priorityRingClass;

  const nextActionLabel =
    folder === 'archived'
      ? 'View project'
      : folder === 'qc_closeout'
        ? qcStatus.qcComplete
          ? 'View project'
          : `Enter ${qcStatus.nextDueLabel}`
        : presentation.nextActionLabel;

  const showPlacementOrder =
    folder === 'active' && !presentation.hidePlacementOrder;

  const volumeYd = (p.calculations ?? []).reduce(
    (s: number, c: any) => s + ((c.result?.volume as number) ?? 0),
    0,
  );
  const psiFromCalc =
    p.calculations?.[0]?.psi ??
    p.calculations?.[0]?.mixDesign?.psi ??
    '';
  const psi = psiFromCalc ? `${psiFromCalc} PSI` : 'Mix: —';
  const plant = p.placementOrder?.batchPlantName?.trim()
    ? p.placementOrder.batchPlantName
    : 'Plant: —';
  const orderStatusKey = (p.placementOrder?.status ?? 'draft') as PlacementOrderStatus;
  const orderStatusLabel = PLACEMENT_ORDER_STATUS_LABELS[orderStatusKey];

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`cursor-pointer h-full ${ringClass}`}
        shadow="md"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center min-w-0" onClick={handleCardClick}>
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white truncate">
                {project.name}
              </h3>
            </div>
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onPointerDownCapture={stopCardOpen}
              onMouseDownCapture={stopCardOpen}
              onTouchStartCapture={stopCardOpen}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soundService.play('trash');
                  onDelete();
                }}
                icon={<Trash2 size={16} />}
                className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3" onClick={handleCardClick}>
            <span
              className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeClass}`}
            >
              {badgeLabel}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0 max-w-[50%] truncate">
              {presentation.cornerDateLabel}
            </span>
          </div>

          <div
            className="rounded-lg border border-gray-200/60 dark:border-gray-700/70 bg-white/40 dark:bg-gray-900/20 p-3 mb-3"
            onClick={handleCardClick}
          >
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              {PROJECT_WORKFLOW_LABELS[displayStage]}
            </p>

            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-2">Next action</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-cyan-500" />
              <span className="truncate">{nextActionLabel}</span>
            </p>
            {showPlacementOrder && (
              <>
                <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-2">
                  Placement order
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 truncate" title={orderStatusLabel}>
                  {orderStatusLabel}
                </p>
              </>
            )}
            {folder === 'active' &&
              workflow.mixDesign &&
              workflow.mixDesign.totalPlacements > 0 && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Mix designs: {workflow.mixDesign.approvedCount}/
                  {workflow.mixDesign.totalPlacements} approved
                </p>
              )}
          </div>

          {folder === 'qc_closeout' && (
            <div
              className="rounded-lg border border-violet-500/25 bg-violet-500/5 dark:bg-violet-950/20 p-3 mb-3 space-y-2"
              onClick={handleCardClick}
            >
              <p className="text-[10px] uppercase tracking-wide text-violet-400/90">
                QC closeout
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Placed:{' '}
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
              <div className="flex items-center justify-between text-xs pt-1 border-t border-violet-500/15">
                <span className="text-gray-500 dark:text-gray-400">
                  Next: <span className="font-medium text-gray-800 dark:text-gray-200">{qcStatus.nextDueLabel}</span>
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
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-1.5 bg-violet-500 rounded-full"
                    style={{ width: `${qcStatus.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {folder !== 'qc_closeout' && (
            <div className="mb-3" onClick={handleCardClick}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{folder === 'archived' ? 'Job progress' : 'Progress'}</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {folder === 'archived' ? 100 : presentation.progressPct}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full ${
                    folder === 'archived' || workflow.stage === 'closed'
                      ? 'bg-slate-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  }`}
                  style={{
                    width: `${folder === 'archived' ? 100 : presentation.progressPct}%`,
                  }}
                />
              </div>
            </div>
          )}

          {folder === 'active' && (
            <div
              className="grid grid-cols-3 gap-2 text-[11px] text-gray-600 dark:text-gray-300"
              onClick={handleCardClick}
            >
              <div className="truncate">{volumeYd > 0 ? `${volumeYd.toFixed(0)} CY` : 'Vol: —'}</div>
              <div className="truncate">{psi}</div>
              <div className="truncate">{plant}</div>
            </div>
          )}

          <div
            className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3"
            onClick={handleCardClick}
          >
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{formattedDate}</span>
            </div>
            {folder === 'archived' ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                <span>Archived</span>
              </div>
            ) : folder === 'qc_closeout' ? (
              <div className="flex items-center gap-1.5">
                {qcStatus.isOverdue ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                )}
                <span>{qcStatus.daysUntilOrOverdueLabel}</span>
              </div>
            ) : presentation.scheduleFooterComplete ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    workflow.stage === 'closed'
                      ? 'text-slate-400'
                      : 'text-emerald-500'
                  }`}
                />
                <span>{presentation.scheduleFooterLabel}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{presentation.scheduleFooterLabel}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;