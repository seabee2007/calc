import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Folder, Clock, Trash2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { Project } from '../../types';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';
import { resolveProjectWorkflow, PROJECT_WORKFLOW_LABELS, type ProjectWorkflowStage } from '../../utils/projectWorkflow';
import {
  PLACEMENT_ORDER_STATUS_LABELS,
  type PlacementOrderStatus,
} from '../../types/placementOrder';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import type { TrackedProposalRow } from '../../types/proposalTracking';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

const STAGE_ORDER: ProjectWorkflowStage[] = [
  'created',
  'estimating',
  'proposal_sent',
  'accepted',
  'mix_approved',
  'placement_scheduled',
  'ordered',
  'placed',
  'closed',
];

function parsePourDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function priorityTone(stage: ProjectWorkflowStage, hasPourDate: boolean): {
  ring: string;
  badge: string;
  label: string;
} {
  if (stage === 'created' || stage === 'estimating') {
    return {
      ring: 'ring-1 ring-amber-500/40',
      badge: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
      label: 'Waiting',
    };
  }
  if ((stage === 'proposal_sent' || stage === 'accepted') && !hasPourDate) {
    return {
      ring: 'ring-1 ring-red-500/35',
      badge: 'bg-red-500/15 text-red-200 border-red-500/40',
      label: 'Needs attention',
    };
  }
  if (stage === 'ordered' || stage === 'placement_scheduled' || stage === 'mix_approved') {
    return {
      ring: 'ring-1 ring-emerald-500/35',
      badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
      label: 'Ready',
    };
  }
  return {
    ring: 'ring-1 ring-slate-500/30',
    badge: 'bg-slate-500/15 text-slate-200 border-slate-500/40',
    label: 'On track',
  };
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onDelete }) => {
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

  const stageIdx = Math.max(0, STAGE_ORDER.indexOf(workflow.stage));
  const progressPct = Math.round((stageIdx / (STAGE_ORDER.length - 1)) * 100);
  const pourDate = parsePourDate(p.pourDate);
  const pourLabel = pourDate ? format(pourDate, 'EEE HH:mm') : 'Placement date: —';
  const tone = priorityTone(workflow.stage, Boolean(p.pourDate));

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
        className={`cursor-pointer h-full ${tone.ring}`}
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
              className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${tone.badge}`}
            >
              {tone.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{pourLabel}</span>
          </div>

          <div
            className="rounded-lg border border-gray-200/60 dark:border-gray-700/70 bg-white/40 dark:bg-gray-900/20 p-3 mb-3"
            onClick={handleCardClick}
          >
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              {PROJECT_WORKFLOW_LABELS[workflow.stage]}
            </p>

            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-2">Next action</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-cyan-500" />
              <span className="truncate">{workflow.nextAction.label}</span>
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-2">
              Placement order
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 truncate" title={orderStatusLabel}>
              {orderStatusLabel}
            </p>
            {workflow.mixDesign && workflow.mixDesign.totalPlacements > 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Mix designs: {workflow.mixDesign.approvedCount}/
                {workflow.mixDesign.totalPlacements} approved
              </p>
            )}
          </div>

          <div className="mb-3" onClick={handleCardClick}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">{progressPct}%</span>
            </div>
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-2 text-[11px] text-gray-600 dark:text-gray-300"
            onClick={handleCardClick}
          >
            <div className="truncate">{volumeYd > 0 ? `${volumeYd.toFixed(0)} CY` : 'Vol: —'}</div>
            <div className="truncate">{psi}</div>
            <div className="truncate">{plant}</div>
          </div>

          <div
            className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3"
            onClick={handleCardClick}
          >
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{formattedDate}</span>
            </div>
            {p.pourDate ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Scheduled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Needs schedule</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;