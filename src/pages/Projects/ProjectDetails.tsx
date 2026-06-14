import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
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
  FileSpreadsheet,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useProjects } from './useProjects';
import { format } from 'date-fns';
import PlacementOrderStatusPanel from '../../components/projects/PlacementOrderStatusPanel';
import {
  OPS_BODY,
  OPS_HERO_LABEL,
  OPS_HERO_STAT_INNER,
  OPS_HERO_STAT_LABEL,
  OPS_HERO_STAT_VALUE,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_PROJECT_HERO,
  OPS_SECTION,
  OPS_SECTION_EYEBROW,
  OPS_SECTION_TITLE,
} from '../../components/dashboard/opsTheme';
import { TEXT_ACCENT } from '../../theme/appTheme';
import {
  resolveProjectWorkflow,
  PROJECT_LIFECYCLE_LABELS,
  PROJECT_LIFECYCLE_STAGE_ORDER,
  workflowStageProgressIndex,
  shouldShowConfigurePlacement,
  shouldShowEstimatingPathButtons,
  getProjectCardPresentation,
} from '../../utils/projectWorkflow';
import EstimatingCalculatorsModal from '../../features/projects/components/EstimatingCalculatorsModal';
import { workflowQuery } from '../../utils/workflow';
import { formatPlacementPourDateTime } from '../../utils/placementPourDate';
import {
  plannerAdjustmentHref,
  plannerBoardHref,
  plannerDocumentsHref,
  plannerRfiHref,
} from '../../utils/plannerRoutes';
import { projectProposalsHref } from '../../utils/projectProposals';
import { projectHasSavedEstimates } from '../../utils/customEstimateUtils';
import {
  customEstimateCategoryTotals,
  projectHasCustomEstimate,
} from '../../utils/customEstimateUtils';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import { computeProposalFinancials } from '../../utils/proposalFinancials';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import { getQcBreakStatus } from '../../utils/projectFolders';
import ClientPortalActions from '../../components/projects/ClientPortalActions';
import ProjectFieldActivityStrip from '../../components/owner/ProjectFieldActivityStrip';
import { useAuth } from '../../hooks/useAuth';
import { estimateWorkspaceHref } from '../../features/estimating/utils/estimateRoutes';
import { ClipboardList } from 'lucide-react';
import ProposalSendEmailModal, {
  type ProposalSendEmailMode,
} from '../../components/proposals/ProposalSendEmailModal';
import ProposalSentLinkModal from '../../components/proposals/ProposalSentLinkModal';
import { ProposalService } from '../../lib/proposalService';
import { getPublicProposalUrl } from '../../lib/proposalTracking';
import { sendProposalEmail } from '../../services/emailService';
import { resolveProposalSendDefaults } from '../../utils/resolveProposalSendDefaults';
import type { ProposalEmailSendPayload } from '../../utils/proposalEmailRecipient';
import {
  resolveProjectProposalNextAction,
  shouldUseProjectProposalNextAction,
} from '../../utils/projectProposalNextAction';

export default function ProjectDetails() {
  const navigate = useNavigate();
  const [showEstimatingCalculatorsModal, setShowEstimatingCalculatorsModal] = useState(false);
  const { isOwner } = useAuth();
  const { currentProject, ui, handlers } = useProjects();
  const { proposals, refresh: refreshProposals } = useTrackedProposals();
  const project = (currentProject as any) ?? null;
  const [sendEmailModal, setSendEmailModal] = useState<{
    proposalId: string;
    proposalTitle: string;
    defaultRecipientEmail?: string;
    mode: ProposalSendEmailMode;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sentLinkModal, setSentLinkModal] = useState<{ url: string; title: string } | null>(null);

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
    const label = formatPlacementPourDateTime(project.pourDate);
    return label ?? '—';
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
    const estLabor = fin.labor_cost ?? 0;
    const estMaterial = fin.material_cost ?? 0;
    const value = fin.total_amount ?? 0;
    const grossProfit = fin.gross_profit ?? 0;
    const grossMarginPercent = fin.gross_margin_percent ?? 0;
    const profit =
      grossProfit > 0
        ? grossProfit
        : value > 0
          ? value - (estLabor + estMaterial)
          : 0;
    const margin =
      grossMarginPercent > 0
        ? grossMarginPercent / 100
        : value > 0
          ? profit / value
          : 0;
    return { value, estLabor, estMaterial, profit, margin };
  }, [matchedProposal?.data, project]);

  const proposalNextAction = useMemo(
    () => resolveProjectProposalNextAction(project?.id ?? '', matchedProposal),
    [project?.id, matchedProposal],
  );

  const useProposalEmailAction = useMemo(
    () => shouldUseProjectProposalNextAction(workflow.stage, matchedProposal),
    [workflow.stage, matchedProposal],
  );

  const primaryNextActionLabel = useProposalEmailAction
    ? proposalNextAction.label
    : workflow.nextAction.label;

  const openProposalEmailModal = async (
    mode: ProposalSendEmailMode,
    proposal: TrackedProposalRow,
  ) => {
    setSendEmailError(null);
    const defaultRecipientEmail = await resolveProposalSendDefaults(
      proposal,
      project?.clientInfo?.clientEmail,
    );
    setSendEmailModal({
      proposalId: proposal.id,
      proposalTitle:
        proposal.data?.projectTitle?.trim() || proposal.title?.trim() || 'Proposal',
      defaultRecipientEmail,
      mode,
    });
  };

  const handleProposalEmailSend = async ({ to, cc, messageNote }: ProposalEmailSendPayload) => {
    if (!sendEmailModal) return;
    setSendingEmail(true);
    setSendEmailError(null);
    try {
      await sendProposalEmail({
        proposalId: sendEmailModal.proposalId,
        recipientEmail: to,
        ccEmails: cc,
        messageNote,
        followUp: sendEmailModal.mode === 'followUp',
      });
      await refreshProposals();
      const refreshed = await ProposalService.getById(sendEmailModal.proposalId);
      setSendEmailModal(null);
      setSentLinkModal({
        url: getPublicProposalUrl(refreshed.public_token),
        title:
          sendEmailModal.mode === 'followUp'
            ? 'Proposal follow-up sent'
            : 'Proposal sent by email',
      });
    } catch (err) {
      setSendEmailError(err instanceof Error ? err.message : 'Failed to send proposal email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrimaryNextAction = () => {
    if (useProposalEmailAction) {
      if (proposalNextAction.type === 'email') {
        void openProposalEmailModal(proposalNextAction.mode, proposalNextAction.proposal);
        return;
      }
      if (proposalNextAction.type === 'navigate') {
        navigate(proposalNextAction.path);
        return;
      }
    }

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
      navigate(documentsQcHref);
      return;
    }
    const search = action.search?.replace(/^\?/, '') ?? '';
    navigate({ pathname: action.path, search });
  };

  const nextActions = useMemo(() => {
    const issues: { msg: string; action: 'proposal' | 'placement' | 'project' | 'qc' }[] = [];
    if (!project) return issues;
    if (workflow.stage === 'closed') return issues;
    if (!matchedProposal) {
      issues.push({ msg: 'Proposal not created / linked', action: 'proposal' });
    } else if (matchedProposal.status !== 'accepted' && matchedProposal.status !== 'deposit_paid' && matchedProposal.status !== 'scheduled') {
      issues.push({ msg: 'Proposal not accepted', action: 'proposal' });
    }

    if (
      (workflow.stage === 'created' || workflow.stage === 'estimating') &&
      !projectHasSavedEstimates(project)
    ) {
      issues.push({ msg: 'No estimates saved yet', action: 'project' });
    }

    if (workflow.stage === 'accepted' || workflow.stage === 'in_progress') {
      const order = project.placementOrder;
      const plantAssigned = Boolean(
        order?.batchPlantName?.trim() || order?.batchPlantAddress?.trim(),
      );
      if (!plantAssigned) {
        issues.push({ msg: 'No batch plant assigned (optional)', action: 'placement' });
      }

      const truckSpacing = Boolean(
        order?.summaryLines?.some((l: string) => /Truck Spacing/i.test(l)),
      );
      if (!truckSpacing) {
        issues.push({ msg: 'Truck spacing not configured (optional)', action: 'placement' });
      }

      const mixCtx = workflow.mixDesign;
      if (mixCtx?.nextPendingCalculation) {
        const label = mixCtx.nextPendingCalculation.type?.replace(/_/g, ' ') ?? 'placement';
        issues.push({
          msg: `Mix design pending for ${label} (optional)`,
          action: 'placement',
        });
      }
    }

    const folderCtx = {
      hasProposalDraft: Boolean(matchedProposal),
      proposalStatus: matchedProposal?.status,
    };
    const qcBreak = getQcBreakStatus(project, workflow.stage, folderCtx);
    const needs28DayBreak = ['job_completed', 'paid'].includes(workflow.stage);
    if (needs28DayBreak && !qcBreak.twentyEightDayComplete) {
      issues.push({ msg: 'Enter 28-day break result', action: 'qc' });
    }

    return issues.slice(0, 6);
  }, [project, matchedProposal, workflow.mixDesign, workflow.stage]);

  const displayStage = workflow.stage;
  const stageIndex = workflowStageProgressIndex(displayStage);
  const progressPct = getProjectCardPresentation(
    displayStage,
    workflow.nextAction.label,
    Boolean(project?.pourDate),
    project?.pourDate ? new Date(project.pourDate) : null,
  ).progressPct;

  if (!project) return null;

  const documentsQcHref = plannerDocumentsHref(project.id, { tab: 'qc-reports' });

  return (
    <div className="space-y-4 sm:space-y-5 mb-6">
      {/* SECTION 1 — PROJECT COMMAND HEADER */}
      <section className={`px-4 py-4 sm:px-5 ${OPS_PROJECT_HERO}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3">
          <div className="mt-2 sm:mt-0 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${OPS_HERO_LABEL}`}>
              {workflow.stageLabel}
            </p>
            <div className="flex items-center mt-2">
              <FolderOpen className={`h-6 w-6 ${TEXT_ACCENT} mr-2 shrink-0`} />
              <h2 className={`text-2xl font-semibold truncate ${OPS_HERO_STAT_VALUE}`}>
                {project.name}
              </h2>
            </div>
            <p className={`text-sm ${OPS_MUTED} mt-1`}>
              Created: {format(new Date(project.createdAt), 'MM/dd/yyyy')} • Last updated:{' '}
              {format(new Date(project.updatedAt), 'MM/dd/yyyy')}
            </p>
          </div>

          <ProjectDetailsActionsMenu
            saveDisabled={ui.isSaving}
            onSave={handlers.saveWasteFactor}
            onOpenEstimateWorkspace={() => navigate(estimateWorkspaceHref(project.id))}
            onPrint={handlers.printPDF}
            onEdit={handlers.startEditing}
            onDelete={() => handlers.confirmDelete('project', project.id)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
          <div className={`lg:col-span-2 ${OPS_HERO_STAT_INNER} p-4`}>
            <p className={`text-xs uppercase tracking-wide ${OPS_SECTION_EYEBROW} mb-2`}>
              Project scope
            </p>
            <div
              className={`max-h-[min(420px,60vh)] lg:max-h-[min(260px,38vh)] overflow-y-auto overscroll-contain pr-1 sm:pr-2 text-sm leading-relaxed whitespace-pre-wrap ${OPS_BODY}`}
            >
              {project.description || 'No description provided'}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className={`flex items-center gap-2 ${OPS_BODY}`}>
                <Calendar className={`h-4 w-4 ${TEXT_ACCENT}`} />
                <span className={OPS_HERO_STAT_LABEL}>Placement date:</span>
                <span className={`font-semibold ${OPS_HERO_STAT_VALUE}`}>{pourDateLabel}</span>
              </div>
              <div className={`flex items-center gap-2 ${OPS_BODY}`}>
                <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                <span className={OPS_HERO_STAT_LABEL}>Status:</span>
                <span className={`font-semibold ${OPS_HERO_STAT_VALUE}`}>{proposalStatusLabel}</span>
              </div>
            </div>

            
          </div>

          <div className={`${OPS_HERO_STAT_INNER} p-4`}>
            <p className={`text-xs uppercase tracking-wide ${OPS_SECTION_EYEBROW}`}>
              Financial visibility
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className={`${OPS_HERO_STAT_LABEL} flex items-center gap-2`}>
                  <DollarSign className="h-4 w-4 text-emerald-500" /> Project value
                </span>
                <span className={`font-semibold ${OPS_HERO_STAT_VALUE}`}>
                  {financial ? `$${financial.value.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={OPS_HERO_STAT_LABEL}>Estimated profit</span>
                <span className={`font-semibold ${OPS_HERO_STAT_VALUE}`}>
                  {financial ? `$${Math.round(financial.profit).toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={OPS_HERO_STAT_LABEL}>Margin</span>
                <span className={`font-semibold ${OPS_HERO_STAT_VALUE}`}>
                  {financial ? `${Math.round(financial.margin * 100)}%` : '—'}
                </span>
              </div>
              {!financial && (
                <p className={`text-xs ${OPS_MUTED} mt-2`}>
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
            <div className="flex flex-wrap gap-3">
              <Button
                variant="accent"
                className="w-full sm:w-auto"
                icon={<ClipboardList className="h-4 w-4" />}
                onClick={() => navigate(`/projects/${project.id}/planner/board`)}
              >
                Open Field Planner
              </Button>
            
            </div>
            <ProjectFieldActivityStrip projectId={project.id} />
          </div>
        )}
      </div>
      </section>

      {/* SECTION 2 — PROJECT WORKFLOW STATUS */}
      <div className={OPS_SECTION}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className={`text-xs uppercase tracking-wide ${OPS_SECTION_EYEBROW}`}>
              Project workflow
            </p>
            <p className={`text-sm ${OPS_SECTION_TITLE}`}>
              {workflow.stageLabel}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xs ${OPS_MUTED}`}>Progress</p>
            <p className={`text-sm ${OPS_SECTION_TITLE}`}>{progressPct}%</p>
          </div>
        </div>
        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[10px] uppercase tracking-wide">
          {PROJECT_LIFECYCLE_STAGE_ORDER.map((s, i) => {
            const done = stageIndex >= i;
            return (
              <div
                key={s}
                className={`px-2 py-1 rounded border ${
                  done
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {PROJECT_LIFECYCLE_LABELS[s]}
              </div>
            );
          })}
        </div>
        <PlacementOrderStatusPanel project={project} resolvedStage={displayStage} />
      </div>

      {/* SECTION 3 — NEXT ACTION PANEL */}
      <div className={OPS_SECTION}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className={OPS_SECTION_TITLE}>Next actions</p>
          <p className={`text-xs ${OPS_MUTED}`}>
            Next: <span className="font-semibold">{workflow.nextAction.label}</span>
          </p>
        </div>
        {nextActions.length === 0 ? (
          <p className={`text-sm ${OPS_BODY}`}>
            {workflow.stage === 'closed'
              ? 'This project is closed. No further actions are required.'
              : workflow.stage === 'paid'
                ? 'Final payment recorded — use Close Out Project when you are ready to archive this job.'
                : 'No blockers detected — update project stage when work is complete or use Tools for field planning.'}
          </p>
        ) : (
          <ul className="space-y-1.5 mt-2">
            {nextActions.map((x) => (
              <li key={x.msg} className={`flex items-start gap-2 text-sm ${OPS_BODY}`}>
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                {x.action === 'qc' ? (
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline text-violet-700 dark:text-violet-300"
                    onClick={() => navigate(documentsQcHref)}
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
          {shouldShowEstimatingPathButtons(
            workflow.stage,
            projectHasSavedEstimates(project),
          ) ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className={`whitespace-nowrap ${OPS_OUTLINE_BTN}`}
                onClick={() => setShowEstimatingCalculatorsModal(true)}
              >
                Calculators
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => navigate(estimateWorkspaceHref(project.id))}
                icon={<ArrowRight size={16} />}
              >
                Estimate Workspace
              </Button>
            </>
          ) : (
            <Button
              variant="accent"
              size="sm"
              className="whitespace-nowrap"
              onClick={handlePrimaryNextAction}
              icon={<ArrowRight size={16} />}
            >
              {primaryNextActionLabel}
            </Button>
          )}
          {shouldShowConfigurePlacement(workflow.stage) && (
            <Button
              size="sm"
              variant="outline"
              className={`whitespace-nowrap ${OPS_OUTLINE_BTN}`}
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
      </div>

      {/* SECTION 4 — FINANCIALS */}
      <div className={OPS_SECTION}>
        <p className={`${OPS_SECTION_TITLE} mb-2`}>Financial snapshot</p>
        {financial ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <InfoRow label="Proposal value" value={`$${financial.value.toLocaleString()}`} />
            <InfoRow label="Est material" value={`$${Math.round(financial.estMaterial).toLocaleString()}`} />
            <InfoRow label="Est labor" value={`$${Math.round(financial.estLabor).toLocaleString()}`} />
            <InfoRow label="Projected profit" value={`$${Math.round(financial.profit).toLocaleString()} (${Math.round(financial.margin * 100)}%)`} />
          </div>
        ) : (
          <p className={`text-sm ${OPS_BODY}`}>
            No proposal linked yet — create/link a proposal to unlock margin and profit tracking.
          </p>
        )}
      </div>

      {/* SECTION 7 — PROJECT FILES */}
      <div className={OPS_SECTION}>
        <p className={`${OPS_SECTION_TITLE} mb-2`}>Project files</p>
        <nav
          className="flex flex-wrap items-center gap-y-1 text-sm"
          aria-label="Jump to project file areas"
        >
          {(
            [
              { key: 'files', label: 'Files', to: plannerDocumentsHref(project.id) },
              { key: 'rfis', label: "RFI's", to: plannerRfiHref(project.id) },
              { key: 'fars', label: "FAR's", to: plannerAdjustmentHref(project.id) },
              {
                key: 'proposals',
                label: 'Proposals',
                to: projectProposalsHref(project.id),
              },
              { key: 'photos', label: 'Photos', to: plannerBoardHref(project.id) },
            ] as const
          ).map((item, index) => (
            <span key={item.key} className="inline-flex items-center">
              {index > 0 && (
                <span className={`mx-2 ${OPS_MUTED}`} aria-hidden>
                  |
                </span>
              )}
              <Link
                to={item.to}
                className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
              >
                {item.label}
              </Link>
            </span>
          ))}
          <span className="inline-flex items-center">
            <span className={`mx-2 ${OPS_MUTED}`} aria-hidden>
              |
            </span>
            <Link
              to={documentsQcHref}
              className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
            >
              QC
            </Link>
          </span>
        </nav>
      </div>

      {projectHasCustomEstimate(project) && (
        <div className={OPS_SECTION}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className={OPS_SECTION_TITLE}>Custom estimate</p>
            <Button
              variant="outline"
              className={OPS_OUTLINE_BTN}
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

      <EstimatingCalculatorsModal
        isOpen={showEstimatingCalculatorsModal}
        onClose={() => setShowEstimatingCalculatorsModal(false)}
        projectId={project.id}
      />

      <ProposalSentLinkModal
        isOpen={Boolean(sentLinkModal)}
        onClose={() => setSentLinkModal(null)}
        proposalUrl={sentLinkModal?.url ?? ''}
        title={sentLinkModal?.title}
      />

      <ProposalSendEmailModal
        isOpen={Boolean(sendEmailModal)}
        onClose={() => {
          if (!sendingEmail) setSendEmailModal(null);
        }}
        proposalTitle={sendEmailModal?.proposalTitle ?? 'Proposal'}
        mode={sendEmailModal?.mode}
        defaultRecipientEmail={sendEmailModal?.defaultRecipientEmail}
        sending={sendingEmail}
        error={sendEmailError}
        onSend={handleProposalEmailSend}
      />
    </div>
  );
}

const PROJECT_DETAILS_ACTIONS_MENU_WIDTH_PX = 220;

interface ProjectDetailsActionsMenuProps {
  saveDisabled: boolean;
  onSave: () => void;
  onOpenEstimateWorkspace: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProjectDetailsActionsMenu({
  saveDisabled,
  onSave,
  onOpenEstimateWorkspace,
  onPrint,
  onEdit,
  onDelete,
}: ProjectDetailsActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const updateMenuPosition = () => {
    const anchor = wrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - PROJECT_DETAILS_ACTIONS_MENU_WIDTH_PX;
    left = Math.max(margin, Math.min(left, window.innerWidth - PROJECT_DETAILS_ACTIONS_MENU_WIDTH_PX - margin));
    let top = rect.bottom + margin;
    const menuHeight = menuRef.current?.offsetHeight ?? 220;
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - margin);
    }
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      data-testid="project-details-actions-menu"
      style={{ top: menuPos.top, left: menuPos.left, width: PROJECT_DETAILS_ACTIONS_MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        role="menuitem"
        type="button"
        disabled={saveDisabled}
        data-testid="project-details-actions-item-save"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          if (saveDisabled) return;
          setOpen(false);
          onSave();
        }}
      >
        <Save className="h-4 w-4 shrink-0" aria-hidden />
        <span>Save</span>
      </button>
      <button
        role="menuitem"
        type="button"
        data-testid="project-details-actions-item-estimate-workspace"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          setOpen(false);
          onOpenEstimateWorkspace();
        }}
      >
        <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
        <span>Estimate Workspace</span>
      </button>
      <button
        role="menuitem"
        type="button"
        data-testid="project-details-actions-item-print"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          setOpen(false);
          onPrint();
        }}
      >
        <Printer className="h-4 w-4 shrink-0" aria-hidden />
        <span>Print</span>
      </button>
      <button
        role="menuitem"
        type="button"
        data-testid="project-details-actions-item-edit"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          setOpen(false);
          onEdit();
        }}
      >
        <Edit className="h-4 w-4 shrink-0" aria-hidden />
        <span>Edit</span>
      </button>
      <div role="separator" className="my-1 border-t border-slate-200 dark:border-slate-700" />
      <button
        role="menuitem"
        type="button"
        data-testid="project-details-actions-item-delete"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50 focus:text-red-300 dark:text-red-300 dark:hover:bg-red-950/40"
        onClick={() => {
          setOpen(false);
          onDelete();
        }}
      >
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>Delete</span>
      </button>
    </div>
  ) : null;

  return (
    <div className="relative flex shrink-0 items-center justify-center" ref={wrapRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={OPS_OUTLINE_BTN}
        data-testid="project-details-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Actions</span>
        <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
      </Button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${OPS_HERO_STAT_INNER} px-3 py-2`}>
      <p className={`text-[10px] uppercase tracking-wide ${OPS_HERO_STAT_LABEL}`}>{label}</p>
      <p className={`text-sm font-semibold ${OPS_HERO_STAT_VALUE} mt-0.5 truncate`}>{value}</p>
    </div>
  );
}
