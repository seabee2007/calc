import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Plus } from 'lucide-react';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import InlineNotice from '../../components/ui/InlineNotice';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ModalShell from '../../components/ui/ModalShell';
import ProposalPipelineCard from '../../components/proposals/ProposalPipelineCard';
import ProposalSentLinkModal from '../../components/proposals/ProposalSentLinkModal';
import ProposalSendEmailModal, {
  type ProposalSendEmailMode,
} from '../../components/proposals/ProposalSendEmailModal';
import { useProjectStore } from '../../store';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import { ProposalService, type SavedProposal } from '../../lib/proposalService';
import {
  getPublicProposalUrl,
  markProposalSent,
} from '../../lib/proposalTracking';
import { sendProposalEmail } from '../../services/emailService';
import { resolveProposalSendDefaults } from '../../utils/resolveProposalSendDefaults';
import type { ProposalEmailSendPayload } from '../../utils/proposalEmailRecipient';
import {
  getLinkableProposals,
  getProjectProposals,
  projectProposalCreateHref,
  projectProposalEditHref,
  projectProposalPreviewHref,
} from '../../utils/projectProposals';
import { navigateToProjectDetail } from '../../utils/workflow';
import { PROPOSAL_STATUS_LABELS } from '../../types/proposalTracking';
import { formatProposalMoney } from '../../utils/proposalKpis';

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDateOnly = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function ProjectProposalsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, loadProjects } = useProjectStore();
  const { proposals, loading, error, refresh: loadProposals } = useTrackedProposals();
  const [localError, setLocalError] = useState<string | null>(null);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [sentLinkModal, setSentLinkModal] = useState<{ url: string; title: string } | null>(null);
  const [sendEmailModal, setSendEmailModal] = useState<{
    proposalId: string;
    proposalTitle: string;
    defaultRecipientEmail?: string;
    mode?: ProposalSendEmailMode;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (projects.length === 0) {
      void loadProjects();
    }
  }, [projects.length, loadProjects]);

  const project = useMemo(
    () => projects.find((entry) => entry.id === projectId) ?? null,
    [projects, projectId],
  );

  const projectProposals = useMemo(() => {
    if (!project) return [];
    return getProjectProposals(project, proposals);
  }, [project, proposals]);

  const linkableProposals = useMemo(() => {
    if (!project) return [];
    return getLinkableProposals(project, proposals);
  }, [project, proposals]);

  const displayError = localError ?? error;

  const openProposalLinkModal = (url: string, title: string) => {
    if (!url || !url.includes('/proposal/')) {
      setLocalError('Could not build client link. Try Send first.');
      return;
    }
    setLocalError(null);
    setSentLinkModal({ url, title });
  };

  const handleSend = async (proposalId: string) => {
    const proposal = projectProposals.find((entry) => entry.id === proposalId);
    if (!proposal) {
      setLocalError('Proposal not found.');
      return;
    }
    setLocalError(null);
    const defaultRecipientEmail = await resolveProposalSendDefaults(
      proposal,
      project?.clientInfo?.clientEmail,
    );
    setSendEmailModal({
      proposalId: proposal.id,
      proposalTitle:
        proposal.data?.projectTitle?.trim() || proposal.title?.trim() || 'Proposal',
      defaultRecipientEmail,
      mode: proposal.status === 'draft' ? 'send' : 'followUp',
    });
  };

  const handleSendEmail = async ({ to, cc, messageNote }: ProposalEmailSendPayload) => {
    if (!sendEmailModal) return;
    setSendingEmail(true);
    setLocalError(null);
    try {
      await sendProposalEmail({
        proposalId: sendEmailModal.proposalId,
        recipientEmail: to,
        ccEmails: cc,
        messageNote,
        followUp: sendEmailModal.mode === 'followUp',
      });
      await loadProposals();
      const refreshed = await ProposalService.getById(sendEmailModal.proposalId);
      setSendEmailModal(null);
      openProposalLinkModal(
        getPublicProposalUrl(refreshed.public_token),
        'Proposal sent by email',
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to send proposal email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleShareClientLink = async (proposal: SavedProposal) => {
    try {
      setLocalError(null);
      let token = proposal.public_token?.trim();
      if (proposal.status === 'draft' || !token) {
        const sent = await markProposalSent(proposal.id);
        token = sent.public_token?.trim();
        await loadProposals();
      }
      if (!token) {
        setLocalError('Could not generate client link.');
        return;
      }
      openProposalLinkModal(getPublicProposalUrl(token), 'Share proposal link');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not open share link.');
    }
  };

  const handleLinkProposal = async (proposalId: string) => {
    if (!project) return;
    setLinkingId(proposalId);
    setLocalError(null);
    try {
      await ProposalService.update(proposalId, { project_id: project.id });
      await loadProposals();
      setLinkModalOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to link proposal');
    } finally {
      setLinkingId(null);
    }
  };

  const handleBackToProject = () => {
    if (!projectId) {
      navigate('/projects');
      return;
    }
    navigateToProjectDetail(navigate, projectId);
  };

  if (!projectId) {
    return (
      <AppPage className="pt-6">
        <EmptyState
          title="Project not found"
          description="Choose a project from the projects list to view its proposals."
          action={{ label: 'Back to Projects', onClick: () => navigate('/projects') }}
        />
      </AppPage>
    );
  }

  if (loading && proposals.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Loading proposals…</p>
      </div>
    );
  }

  const projectLabel = project?.name?.trim() || 'Project';

  return (
    <AppPage
      className="pt-6"
      header={
        <PageHeader
          title="Proposals"
          subtitle={`Proposal documents linked to ${projectLabel}.`}
          breadcrumb={
            <>
              <button
                type="button"
                onClick={handleBackToProject}
                className="font-medium text-cyan-700 hover:underline dark:text-cyan-400"
              >
                {projectLabel}
              </button>
              <span aria-hidden className="mx-2">
                →
              </span>
              <span>Proposals</span>
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={handleBackToProject}
              >
                Back to Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Link2 size={16} />}
                onClick={() => setLinkModalOpen(true)}
                disabled={linkableProposals.length === 0}
              >
                Link Existing Proposal
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => navigate(projectProposalCreateHref(projectId))}
              >
                Create Proposal
              </Button>
            </>
          }
          className="!px-0"
        />
      }
    >
      {displayError ? (
        <InlineNotice variant="danger" title={displayError} className="mb-5" />
      ) : null}

      {!project ? (
        <EmptyState
          title="Project not found"
          description="This project may have been removed or you may not have access."
          action={{ label: 'Back to Projects', onClick: () => navigate('/projects') }}
        />
      ) : projectProposals.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="No proposals linked yet"
            description="Create a proposal for this project or link an existing proposal from the proposal pipeline."
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => navigate(projectProposalCreateHref(projectId))}
            >
              Create Proposal
            </Button>
            {linkableProposals.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                icon={<Link2 size={16} />}
                onClick={() => setLinkModalOpen(true)}
              >
                Link Existing Proposal
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleBackToProject}>
              Back to Project
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border border-slate-200/80 bg-white/90 p-5 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/90 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-gray-300">
              {projectProposals.length} proposal{projectProposals.length === 1 ? '' : 's'} linked
            </p>
            <Link
              to="/proposals"
              className="text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
            >
              Open proposal pipeline
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {projectProposals.map((proposal) => (
              <div key={proposal.id} id={`project-proposal-${proposal.id}`}>
                <ProposalPipelineCard
                  proposal={proposal}
                  expanded={expandedProposalId === proposal.id}
                  onToggleExpand={() =>
                    setExpandedProposalId((id) => (id === proposal.id ? null : proposal.id))
                  }
                  formatDateOnly={formatDateOnly}
                  formatDateTime={formatDateTime}
                  handlers={{
                    onOpen: () => navigate(projectProposalEditHref(proposal.id)),
                    onSend: () => void handleSend(proposal.id),
                    onDuplicate: () => {
                      const baseTitle =
                        proposal.data?.projectTitle?.trim() ||
                        proposal.title?.trim() ||
                        'Proposal';
                      void ProposalService.duplicate(proposal.id, `${baseTitle} (Copy)`).then(
                        loadProposals,
                      );
                    },
                    onPdf: () => navigate(projectProposalPreviewHref(proposal.id)),
                    onShareLink: () => void handleShareClientLink(proposal),
                    overflowItems: [
                      {
                        key: 'preview',
                        label: 'Preview',
                        onClick: () => navigate(projectProposalPreviewHref(proposal.id)),
                      },
                      {
                        key: 'edit',
                        label: 'Edit',
                        onClick: () => navigate(projectProposalEditHref(proposal.id)),
                      },
                    ],
                  }}
                />
                <div className="mt-2 flex flex-wrap gap-2 px-1 text-xs text-slate-500 dark:text-gray-400">
                  <span>
                    Status: {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Value: {formatProposalMoney(Number(proposal.total_amount ?? 0))}</span>
                  {proposal.sent_at ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>Sent {formatDateOnly(proposal.sent_at)}</span>
                    </>
                  ) : null}
                  {proposal.accepted_at ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>Accepted {formatDateOnly(proposal.accepted_at)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ModalShell
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Link existing proposal"
        size="md"
        footer={
          <Button variant="outline" size="sm" onClick={() => setLinkModalOpen(false)}>
            Cancel
          </Button>
        }
      >
        {linkableProposals.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-gray-300">
            No other proposals are available to link. Create a new proposal or add one from the
            pipeline first.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {linkableProposals.map((proposal) => {
              const title =
                proposal.data?.projectTitle?.trim() || proposal.title || 'Untitled proposal';
              return (
                <li
                  key={proposal.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {PROPOSAL_STATUS_LABELS[proposal.status]} ·{' '}
                      {formatProposalMoney(Number(proposal.total_amount ?? 0))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={linkingId === proposal.id}
                    isLoading={linkingId === proposal.id}
                    onClick={() => void handleLinkProposal(proposal.id)}
                  >
                    Link
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </ModalShell>

      <ProposalSentLinkModal
        isOpen={Boolean(sentLinkModal)}
        onClose={() => setSentLinkModal(null)}
        title={sentLinkModal?.title ?? 'Proposal link'}
        shareUrl={sentLinkModal?.url}
        proposalUrl={sentLinkModal?.url}
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
        error={localError}
        onSend={handleSendEmail}
      />
    </AppPage>
  );
}
