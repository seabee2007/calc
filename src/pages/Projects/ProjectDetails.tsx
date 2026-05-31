import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Save,
  Printer,
  Edit,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Calendar,
  DollarSign,
  ClipboardCheck,
  CloudSun,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useProjects } from './useProjects';
import { format } from 'date-fns';
import CalculationSection from './CalculationSection';
import MixDesignSection from './MixDesignSection';
import LaborSection from './LaborSection';
import QCSection from './QCSection';
import ReinforcementSection from './ReinforcementSection';
import StrengthProgress from '../../components/projects/StrengthProgress';
import PlacementOrderStatusPanel from '../../components/projects/PlacementOrderStatusPanel';
import {
  resolveProjectWorkflow,
  PROJECT_WORKFLOW_LABELS,
  PROJECT_LIFECYCLE_STAGE_ORDER,
  workflowStageProgressIndex,
  normalizeWorkflowStageForDisplay,
  shouldShowConfigurePlacement,
  getProjectCardPresentation,
  type ProjectWorkflowStage,
} from '../../utils/projectWorkflow';
import { workflowQuery } from '../../utils/workflow';
import {
  customEstimateCategoryTotals,
  projectHasCustomEstimate,
} from '../../utils/customEstimateUtils';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import { computeProposalFinancials } from '../../utils/proposalFinancials';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import type { ForecastDay } from '../../types';
import {
  findBestTimeOfDayWindow,
  formatTimeWindow,
  scorePourDay,
  type ScoredPourDay,
} from '../../utils/pourScoring';
import { getQcBreakStatus } from '../../utils/projectFolders';
import ClientPortalActions from '../../components/projects/ClientPortalActions';
import ProjectFieldActivityStrip from '../../components/owner/ProjectFieldActivityStrip';
import { useAuth } from '../../hooks/useAuth';
import { ClipboardList } from 'lucide-react';

export default function ProjectDetails() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const { currentProject, ui, handlers } = useProjects();
  const { proposals } = useTrackedProposals();
  const project = (currentProject as any) ?? null;
  const p = (project ?? {}) as any;

  const matchedProposal: TrackedProposalRow | undefined = useMemo(() => {
    if (!project) return undefined;
    const direct = proposals.find((proposal) => proposal.project_id === project.id);
    if (direct) return direct;
    const name = project.name ?? '';
    if (!name) return undefined;
    return proposals.find(
      (proposal) =>
        proposal.data?.projectTitle === name ||
        proposal.title.toLowerCase().includes(name.toLowerCase()),
    );
  }, [proposals, project?.id, project?.name]);

  const proposalStatusLabel = useMemo(() => {
    const s = matchedProposal?.status ?? null;
    if (!s) return 'No proposal linked';
    const map: Record<string, string> = {
      draft: 'Draft',
      sent: 'Proposal Sent',
      opened: 'Proposal Opened',
      viewed: 'Proposal Viewed',
      accepted: 'Accepted',
      declined: 'Declined',
      deposit_paid: 'Deposit Paid',
      scheduled: 'Scheduled',
    };
    return map[String(s)] ?? String(s).replace(/_/g, ' ').toUpperCase();
  }, [matchedProposal?.status]);

  const pourDateLabel = useMemo(() => {
    if (!project?.pourDate) return '—';
    try {
      return format(new Date(project.pourDate), 'EEEE HH:mm');
    } catch {
      return '—';
    }
  }, [project?.pourDate]);

  const workflow = useMemo(() => {
    if (!project) {
      return {
        stage: 'created',
        nextAction: { label: 'Open Project', path: '/projects', search: '' },
      } as any;
    }
    return resolveProjectWorkflow(project as any, {
      hasProposalDraft: Boolean(matchedProposal),
      proposalStatus: matchedProposal?.status,
      windRisk: 'unknown',
      heatRisk: 'unknown',
      readinessScore: 0,
      now: new Date(),
    });
  }, [project, matchedProposal, matchedProposal?.status]);

  const financial = useMemo(() => {
    const data = matchedProposal?.data;
    if (!data || !project) return null;
    const fin = computeProposalFinancials(data);
    const estLabor = project.laborEstimates?.[0]?.laborCost ?? 0;
    const estMaterial = fin.material_cost;
    const value = fin.total_amount;
    const profit = value > 0 ? value - (estLabor + estMaterial) : 0;
    const margin = value > 0 ? profit / value : 0;
    return { value, estLabor, estMaterial, profit, margin };
  }, [matchedProposal?.data, project, project?.laborEstimates]);

  const nextActions = useMemo(() => {
    const issues: { msg: string; action: 'proposal' | 'placement' | 'project' | 'qc' }[] = [];
    if (!project) return issues;
    if (workflow.stage === 'closed') return issues;
    if (!matchedProposal) {
      issues.push({ msg: 'Proposal not created / linked', action: 'proposal' });
    } else if (matchedProposal.status !== 'accepted' && matchedProposal.status !== 'deposit_paid' && matchedProposal.status !== 'scheduled') {
      issues.push({ msg: 'Proposal not accepted', action: 'proposal' });
    }

    const order = project.placementOrder;
    const plantAssigned = Boolean(order?.batchPlantName?.trim() || order?.batchPlantAddress?.trim());
    if (!plantAssigned) issues.push({ msg: 'No batch plant assigned', action: 'placement' });

    const truckSpacing = Boolean(
      order?.summaryLines?.some((l: string) => /Truck Spacing/i.test(l)),
    );
    if (!truckSpacing) issues.push({ msg: 'Truck spacing not configured', action: 'placement' });

    if (!project.pourDate) issues.push({ msg: 'Placement date not scheduled', action: 'project' });

    const volumeYd = (project.calculations ?? []).reduce(
      (s: number, c: any) => s + ((c.result?.volume as number) ?? 0),
      0,
    );
    if (volumeYd <= 0) issues.push({ msg: 'Volume not calculated', action: 'project' });

    const mixCtx = workflow.mixDesign;
    if (mixCtx?.nextPendingCalculation) {
      const label = mixCtx.nextPendingCalculation.type?.replace(/_/g, ' ') ?? 'placement';
      issues.push({
        msg: `Mix design pending for ${label}`,
        action: 'placement',
      });
    }

    const folderCtx = {
      hasProposalDraft: Boolean(matchedProposal),
      proposalStatus: matchedProposal?.status,
    };
    const qcBreak = getQcBreakStatus(project, workflow.stage, folderCtx);
    const needs28DayBreak = ['placed', 'job_completed', 'paid'].includes(workflow.stage);
    if (needs28DayBreak && !qcBreak.twentyEightDayComplete) {
      issues.push({ msg: 'Enter 28-day break result', action: 'qc' });
    }

    return issues.slice(0, 6);
  }, [project, matchedProposal, workflow.mixDesign, workflow.stage]);

  const displayStage = normalizeWorkflowStageForDisplay(
    workflow.stage as ProjectWorkflowStage,
  );
  const stageIndex = workflowStageProgressIndex(workflow.stage as ProjectWorkflowStage);
  const progressPct = getProjectCardPresentation(
    workflow.stage as ProjectWorkflowStage,
    workflow.nextAction.label,
    Boolean(project?.pourDate),
    project?.pourDate ? new Date(project.pourDate) : null,
  ).progressPct;

  const pourDetails = useMemo(() => {
    const order = p.placementOrder;
    const cs = order?.callSheet ?? {};
    const lines: string[] = order?.summaryLines ?? [];

    const volumeYd = (p.calculations ?? []).reduce(
      (s: number, c: any) => s + ((c.result?.volume as number) ?? 0),
      0,
    );

    const psiFromCalc =
      p.calculations?.[0]?.psi ??
      p.calculations?.[0]?.mixDesign?.psi ??
      cs.mixDesignNumber?.match(/\d{3,5}/)?.[0] ??
      '';
    const mixLabel = psiFromCalc ? `${psiFromCalc} PSI` : (cs.mixDesignNumber?.trim() ? cs.mixDesignNumber : '—');

    const placement =
      cs.pumpCompany?.trim()
        ? 'Pump'
        : 'Chute';

    const laborInputs = p.laborEstimates?.[0]?.inputs ?? null;
    const finishType = laborInputs?.finishType ? titleCase(String(laborInputs.finishType)) : '—';

    const production = order?.production ?? p.laborEstimates?.[0]?.production ?? null;
    const crewSize = parseInt(String(production?.crewSize ?? laborInputs?.crewSize ?? ''), 10);
    const finishers = parseInt(String(production?.finishers ?? laborInputs?.finishers ?? ''), 10);
    const laborers = Number.isFinite(crewSize) && Number.isFinite(finishers) ? Math.max(0, crewSize - finishers) : NaN;
    const crewLabel =
      Number.isFinite(crewSize) && crewSize > 0
        ? Number.isFinite(finishers) && finishers > 0
          ? `${laborers} Laborers / ${finishers} Finishers`
          : `${crewSize} crew`
        : '—';

    const batchPlant = order?.batchPlantName?.trim() ? order.batchPlantName : '—';

    const firstTruck =
      parseSummaryValue(lines, /Requested Start Time:\s*(.+)/i) ??
      (p.pourDate ? format(new Date(p.pourDate), 'HH:mm') : null) ??
      '—';

    const spacing =
      parseSummaryValue(lines, /Truck Spacing:\s*(.+)/i) ??
      parseSummaryValue(lines, /Spacing:\s*(.+)/i) ??
      '—';

    return {
      volumeLabel: volumeYd > 0 ? `${volumeYd.toFixed(0)} CY` : '—',
      mixLabel,
      placement,
      finishType,
      crewLabel,
      batchPlant,
      pumpCompany: cs.pumpCompany?.trim() ? cs.pumpCompany : null,
      firstTruck,
      spacing,
    };
  }, [p]);

  const placementConditions = useMemo(() => {
    const pourDate = p.pourDate ? new Date(p.pourDate) : null;
    const forecast: ForecastDay[] | undefined = p.calculations?.[0]?.weather?.forecast;
    if (!forecast || forecast.length === 0) return null;

    const key = pourDate ? toISODate(pourDate) : toISODate(new Date());
    const day = forecast.find((d) => d.date === key) ?? forecast[0];
    if (!day) return null;

    const scored: ScoredPourDay = scorePourDay(day as any, {});
    const bestWindow = findBestTimeOfDayWindow(day as any);
    const windowLabel = bestWindow ? formatTimeWindow(bestWindow) : '—';

    const riskLabel =
      scored.rating === 'excellent' || scored.rating === 'good'
        ? 'LOW RISK'
        : scored.rating === 'fair'
          ? 'MODERATE RISK'
          : 'HIGH RISK';

    const riskTone =
      riskLabel === 'LOW RISK'
        ? 'text-emerald-400'
        : riskLabel === 'MODERATE RISK'
          ? 'text-amber-400'
          : 'text-red-400';

    const hourly = day.hourly ?? [];
    const maxWind = hourly.length
      ? Math.max(...hourly.map((h) => h.windSpeed ?? 0))
      : day.maxWindSpeed ?? 0;
    const maxRainChance = hourly.length
      ? Math.max(...hourly.map((h) => h.chanceOfRain ?? 0))
      : day.chanceOfRain ?? 0;
    const maxTemp = hourly.length ? Math.max(...hourly.map((h) => h.temp ?? 0)) : day.maxTemp ?? 0;

    const after10 = hourly.filter((h) => (h.hour ?? 0) >= 10);
    const before10 = hourly.filter((h) => (h.hour ?? 0) < 10);
    const maxWindAfter10 = after10.length ? Math.max(...after10.map((h) => h.windSpeed ?? 0)) : null;
    const maxWindBefore10 = before10.length ? Math.max(...before10.map((h) => h.windSpeed ?? 0)) : null;

    const concerns: string[] = [...(scored.primaryRisks ?? [])];

    if (
      maxWindAfter10 != null &&
      maxWindBefore10 != null &&
      maxWindAfter10 >= maxWindBefore10 + 6
    ) {
      concerns.unshift('Wind increasing after 10:00');
    }
    if (maxRainChance >= 50) {
      concerns.push(`Rain probability peaks near ${Math.round(maxRainChance)}%`);
    }
    if (scored.evaporationRisk === 'severe') {
      concerns.push('Evaporation severe (plastic shrinkage risk)');
    } else if (scored.evaporationRisk === 'moderate') {
      concerns.push('Evaporation moderate (monitor fogging & windbreaks)');
    }

    const mitigations = (scored.recommendedActions ?? []).slice(0, 4);

    return {
      dateLabel: day.date,
      riskLabel,
      riskTone,
      recommendedWindow: windowLabel,
      stats: {
        heatF: Math.round(maxTemp),
        windMph: Math.round(maxWind),
        rainPct: Math.round(maxRainChance),
        evaporation: scored.evaporationRisk,
        rating: scored.rating,
        score: Math.round(scored.score),
      },
      concerns: concerns.slice(0, 4),
      mitigations,
    };
  }, [p]);

  if (!project) return null;

  return (
    <Card className="p-6 mb-6 dark:bg-gray-800/90">
      {/* SECTION 1 — PROJECT COMMAND HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3">
          <div className="mt-2 sm:mt-0 min-w-0">
            <div className="flex items-center">
              <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2 shrink-0" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
                {project.name}
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Created: {format(new Date(project.createdAt), 'MM/dd/yyyy')} • Last updated:{' '}
              {format(new Date(project.updatedAt), 'MM/dd/yyyy')}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 shrink-0">
            <Button
            size="sm"
            onClick={handlers.saveWasteFactor}
            disabled={ui.isSaving}
            icon={<Save size={16} />}
          >
            <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
            size="sm"
            onClick={handlers.printPDF}
            icon={<Printer size={16} />}
          />
            <Button
            size="sm"
            onClick={handlers.startEditing}
            icon={<Edit size={16} />}
          />
            <Button
            variant="danger"
            size="sm"
            onClick={() => handlers.confirmDelete('project', project.id)}
            icon={<Trash2 size={16} />}
          />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4">
            <p className="text-gray-600 dark:text-gray-300">
              {project.description || 'No description provided'}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-gray-500 dark:text-gray-400">Placement date:</span>
                <span className="font-semibold">{pourDateLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="font-semibold">{proposalStatusLabel}</span>
              </div>
            </div>

            
          </div>

          <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Financial visibility
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" /> Project value
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {financial ? `$${financial.value.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Estimated profit</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {financial ? `$${Math.round(financial.profit).toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Margin</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {financial ? `${Math.round(financial.margin * 100)}%` : '—'}
                </span>
              </div>
              {!financial && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Link a proposal to unlock value/margin.
                </p>
              )}
            </div>
          </div>
        </div>

        <ClientPortalActions
          projectId={project.id}
          clientName={project.clientInfo?.clientName}
          clientEmail={project.clientInfo?.clientEmail}
        />

        {isOwner && (
          <div className="mt-4 space-y-3">
            <Button
              variant="accent"
              className="w-full sm:w-auto"
              icon={<ClipboardList className="h-4 w-4" />}
              onClick={() => navigate(`/projects/${project.id}/planner/board`)}
            >
              Open Field Planner
            </Button>
            <ProjectFieldActivityStrip projectId={project.id} />
          </div>
        )}
      </div>

      {/* SECTION 2 — PROJECT WORKFLOW STATUS */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Project workflow
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {PROJECT_WORKFLOW_LABELS[displayStage]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Progress</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{progressPct}%</p>
          </div>
        </div>
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 text-[10px] uppercase tracking-wide">
          {PROJECT_LIFECYCLE_STAGE_ORDER.map((s, i) => {
            const done = stageIndex >= i;
            return (
              <div
                key={s}
                className={`px-2 py-1 rounded border ${
                  done
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {PROJECT_WORKFLOW_LABELS[s]}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3 — NEXT ACTION PANEL */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Next actions</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Next: <span className="font-semibold">{workflow.nextAction.label}</span>
          </p>
        </div>
        {nextActions.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {workflow.stage === 'closed'
              ? 'This project is closed. No further actions are required.'
              : workflow.stage === 'paid'
                ? 'Final payment recorded — use Close Out Project when you are ready to archive this job.'
                : 'No blockers detected — proceed to placement planning and dispatch confirmation.'}
          </p>
        ) : (
          <ul className="space-y-1.5 mt-2">
            {nextActions.map((x) => (
              <li key={x.msg} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                {x.action === 'qc' ? (
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline text-violet-700 dark:text-violet-300"
                    onClick={() =>
                      document.getElementById('project-qc-section')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    {x.msg}
                  </button>
                ) : (
                  <span>{x.msg}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Button
            size="sm"
            className="whitespace-nowrap"
            onClick={() => {
              const action = workflow.nextAction;
              if (action.kind === 'close_project') {
                void handlers.closeOutProject(project.id);
                return;
              }
              if (action.kind === 'back_to_list') {
                handlers.backToProjectList();
                return;
              }
              if (action.kind === 'scroll_to_qc') {
                document.getElementById('project-qc-section')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
                return;
              }
              const search = action.search?.replace(/^\?/, '') ?? '';
              navigate({ pathname: action.path, search });
            }}
            icon={<ArrowRight size={16} />}
          >
            {workflow.nextAction.label}
          </Button>
          {shouldShowConfigurePlacement(workflow.stage) && (
            <Button
              size="sm"
              variant="outline"
              className="whitespace-nowrap"
              onClick={() =>
                navigate({
                  pathname: '/pour-planner',
                  search: workflowQuery(project.id).replace(/^\?/, ''),
                })
              }
              icon={<ArrowRight size={16} />}
            >
              Configure Placement
            </Button>
          )}
        </div>
        <PlacementOrderStatusPanel project={project} />
      </div>

      {/* SECTION 4 — PLACEMENT INFORMATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-200 mb-2">
            Placement details
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoRow label="Volume" value={pourDetails.volumeLabel} />
            <InfoRow label="Mix" value={pourDetails.mixLabel} />
            <InfoRow label="Placement" value={pourDetails.placement} />
            <InfoRow label="Finish" value={pourDetails.finishType} />
            <InfoRow label="Crew" value={pourDetails.crewLabel} />
            <InfoRow label="Batch plant" value={pourDetails.batchPlant} />
            <InfoRow label="First truck" value={pourDetails.firstTruck} />
            <InfoRow label="Truck spacing" value={pourDetails.spacing} />
          </div>
          {pourDetails.pumpCompany && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Pump: <span className="font-semibold text-gray-700 dark:text-gray-200">{pourDetails.pumpCompany}</span>
            </p>
          )}
        </div>

        {/* SECTION 5 — WEATHER & RISK */}
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CloudSun className="h-5 w-5 text-amber-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Placement conditions</p>
          </div>
          {!placementConditions ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {workflow.stage === 'closed'
                  ? 'No forecast was saved for this completed project.'
                  : 'No forecast saved on this project yet. Run weather in the calculator or open Placement Planner to pull forecast.'}
              </p>
              {shouldShowConfigurePlacement(workflow.stage) && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({
                        pathname: '/pour-planner',
                        search: workflowQuery(project.id).replace(/^\?/, ''),
                      })
                    }
                    icon={<ArrowRight size={16} />}
                  >
                    Open Placement Planner
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className={`text-lg font-bold ${placementConditions.riskTone}`}>
                {placementConditions.riskLabel}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <InfoRow label="Heat (max)" value={`${placementConditions.stats.heatF}°F`} />
                <InfoRow label="Wind (max)" value={`${placementConditions.stats.windMph} mph`} />
                <InfoRow label="Rain chance" value={`${placementConditions.stats.rainPct}%`} />
                <InfoRow
                  label="Evaporation"
                  value={titleCase(String(placementConditions.stats.evaporation))}
                />
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
                Recommended window:{' '}
                <span className="font-semibold">{placementConditions.recommendedWindow}</span>
              </p>

              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-3 mb-1.5">
                Concerns
              </p>
              {placementConditions.concerns.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">No major concerns detected.</p>
              ) : (
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                  {placementConditions.concerns.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-3 mb-1.5">
                Mitigations
              </p>
              {placementConditions.mitigations.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">—</p>
              ) : (
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                  {placementConditions.mitigations.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span className="text-cyan-500">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* SECTION 6 — FINANCIALS */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Financial snapshot</p>
        {financial ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <InfoRow label="Proposal value" value={`$${financial.value.toLocaleString()}`} />
            <InfoRow label="Est material" value={`$${Math.round(financial.estMaterial).toLocaleString()}`} />
            <InfoRow label="Est labor" value={`$${Math.round(financial.estLabor).toLocaleString()}`} />
            <InfoRow label="Projected profit" value={`$${Math.round(financial.profit).toLocaleString()} (${Math.round(financial.margin * 100)}%)`} />
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No proposal linked yet — create/link a proposal to unlock margin and profit tracking.
          </p>
        )}
      </div>

      {/* SECTION 7 — PROJECT DOCUMENTS (starter list; real attachments later) */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Project files</p>
        <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
          <li>• Proposal (tracked)</li>
          <li>• Placement call sheet (Placement Planner)</li>
          <li>• QC logs</li>
          <li>• Mix report / calculator outputs</li>
        </ul>
      </div>

      {/* TECHNICAL DETAILS (downgraded prominence) */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Technical details</p>
        {project.calculations.length > 0 && (
          <StrengthProgress
            project={project}
            mixProfile={ui.mixProfile}
            onMixProfileChange={handlers.mixProfileChange}
            onPourDateChange={handlers.dateChange}
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <MixDesignSection />
          <CalculationSection />
        </div>
      </div>

      {projectHasCustomEstimate(project) && (
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4 mb-6 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Custom estimate</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/calculator/custom${workflowQuery(project.id)}`, {
                  state: { projectId: project.id },
                })
              }
            >
              Edit
            </Button>
          </div>
          {(() => {
            const t = customEstimateCategoryTotals(project);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <InfoRow label="Labor" value={formatChangeOrderMoney(t.labor)} />
                <InfoRow label="Material" value={formatChangeOrderMoney(t.material)} />
                <InfoRow label="Equipment" value={formatChangeOrderMoney(t.equipment)} />
                <InfoRow label="Total" value={formatChangeOrderMoney(t.total)} />
              </div>
            );
          })()}
        </div>
      )}

      <LaborSection />
      <div id="project-qc-section">
        <QCSection />
      </div>
      <ReinforcementSection />
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/70 bg-white/40 dark:bg-gray-900/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}

function parseSummaryValue(lines: string[], pattern: RegExp): string | null {
  for (const line of lines) {
    const m = line.match(pattern);
    if (m?.[1]) return String(m[1]).trim();
  }
  return null;
}

function toISODate(d: Date): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}