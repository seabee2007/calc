import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Upload,
  Plus,
} from 'lucide-react';
import { ProposalService, SavedProposal } from '../lib/proposalService';
import {
  getPublicProposalUrl,
  markDepositPaid,
  markProposalSent,
  markPaid,
  markScheduled,
} from '../lib/proposalTracking';
import {
  buildProposalDashboardMetrics,
  formatProposalMoney,
  formatWinRate,
} from '../utils/proposalKpis';
import Button from '../components/ui/Button';
import ModalShell from '../components/ui/ModalShell';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import KpiStrip from '../components/ui/KpiStrip';
import EmptyState from '../components/ui/EmptyState';
import InlineNotice from '../components/ui/InlineNotice';
import AppPage from '../components/ui/AppPage';
import { PREMIUM_PANEL } from '../theme/appTheme';
import { soundService } from '../services/soundService';
import ProposalSentLinkModal from '../components/proposals/ProposalSentLinkModal';
import ProposalSendEmailModal from '../components/proposals/ProposalSendEmailModal';
import ProposalPipelineBoard from '../components/proposals/ProposalPipelineBoard';
import ProposalNextActionsPanel from '../components/proposals/ProposalNextActionsPanel';
import ProposalPipelineCard from '../components/proposals/ProposalPipelineCard';
import {
  buildCrmNextActions,
  buildCrmRevenueMetrics,
  proposalMatchesPipelineFilter,
  type CrmPipelineFilter,
} from '../utils/proposalCrm';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { useProposalNextActionEmail } from '../hooks/useProposalNextActionEmail';
import type { ProposalNextAction } from '../types/proposalNextAction';

const Proposals: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { proposals, loading, error, refresh: loadProposals } = useTrackedProposals();
  const [localError, setLocalError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<CrmPipelineFilter>('all');
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const {
    emailModal,
    sendingEmail,
    emailError,
    handleNextAction,
    handleSendEmail,
    openSendModal,
    closeEmailModal,
  } = useProposalNextActionEmail({
    proposals,
    onRefresh: loadProposals,
    onSent: ({ url, title }) => {
      if (url?.includes('/proposal/')) {
        setLinkModal({ url, title });
      }
    },
  });

  const setError = (msg: string | null) => setLocalError(msg);
  const displayError = localError ?? error ?? emailError;

  const handleDelete = async (id: string) => {
    try {
      soundService.play('trash');
      await ProposalService.delete(id);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete proposal');
    }
  };

  const handleDuplicate = async (proposal: SavedProposal) => {
    try {
      const baseTitle =
        proposal.data?.projectTitle?.trim() || proposal.title?.trim() || 'Proposal';
      const newTitle = `${baseTitle} (Copy)`;
      await ProposalService.duplicate(proposal.id, newTitle);
      loadProposals(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate proposal');
    }
  };

  const handleExport = (proposal: SavedProposal) => {
    try {
      console.log('Downloading proposal:', proposal.title);
      soundService.play('save');
      ProposalService.exportAsJSON(proposal);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download proposal');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    setError(null);
    setImportMessage(null);

    try {
      const imported = await ProposalService.importFromJSON(file);
      const title =
        imported.title?.trim() ||
        `Imported Proposal - ${new Date().toLocaleDateString()}`;
      await ProposalService.create({
        title,
        template_type: imported.template_type,
        data: imported.data,
      });
      soundService.play('save');
      await loadProposals();
      setImportMessage(`Imported “${title}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import proposal');
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = (proposal: SavedProposal) => {
    navigate(`/proposal-generator?preview=${proposal.id}`);
  };

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

  const openProposalLinkModal = (url: string, title: string) => {
    if (!url || !url.includes('/proposal/')) {
      setError('Could not build client link. Try Send first.');
      return;
    }
    setError(null);
    setLinkModal({ url, title });
  };

  const resolvePublicLink = async (
    proposal: SavedProposal,
  ): Promise<string | null> => {
    let token = proposal.public_token?.trim();
    if (proposal.status === 'draft' || !token) {
      const sent = await markProposalSent(proposal.id);
      token = sent.public_token?.trim();
      await loadProposals();
    }
    if (!token) return null;
    return getPublicProposalUrl(token);
  };

  const openSendEmailModal = async (proposal: SavedProposal) => {
    setError(null);
    await openSendModal(proposal, 'send');
  };

  const handleShareClientLink = async (proposal: SavedProposal) => {
    try {
      setError(null);
      const url = await resolvePublicLink(proposal);
      if (!url) {
        setError('Could not generate client link.');
        return;
      }
      openProposalLinkModal(url, 'Share proposal link');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open share link.');
    }
  };

  const handleSend = async (proposalId: string) => {
    const proposal = proposals.find((entry) => entry.id === proposalId);
    if (!proposal) {
      setError('Proposal not found.');
      return;
    }
    await openSendEmailModal(proposal);
  };

  const handleMarkDeposit = async (id: string) => {
    try {
      await markDepositPaid(id);
      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleMarkScheduled = async (id: string) => {
    try {
      await markScheduled(id);
      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await markPaid(id);
      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const filteredProposals = useMemo(
    () => proposals.filter((p) => proposalMatchesPipelineFilter(p, pipelineFilter)),
    [proposals, pipelineFilter],
  );

  const metrics = useMemo(() => buildProposalDashboardMetrics(proposals), [proposals]);

  const crmRevenue = useMemo(
    () =>
      buildCrmRevenueMetrics(
        proposals,
        metrics.financial.winRate,
        metrics.financial.monthlyRevenue,
      ),
    [proposals, metrics.financial.winRate, metrics.financial.monthlyRevenue],
  );

  const nextActions = useMemo(() => buildCrmNextActions(proposals), [proposals]);

  useEffect(() => {
    const state = location.state as { openNextAction?: ProposalNextAction } | null;
    const action = state?.openNextAction;
    if (!action) return;
    void handleNextAction(action);
    navigate(location.pathname, { replace: true, state: null });
  }, [handleNextAction, location.pathname, location.state, navigate]);

  const buildOverflowItems = (proposal: SavedProposal) => [
    ...(proposal.status === 'accepted'
      ? [
          {
            key: 'mark_deposit',
            label: 'Mark deposit paid',
            onClick: () => handleMarkDeposit(proposal.id),
          },
        ]
      : []),
    ...(proposal.status === 'accepted' || proposal.status === 'deposit_paid'
      ? [
          {
            key: 'mark_scheduled',
            label: 'Mark scheduled',
            onClick: () => handleMarkScheduled(proposal.id),
          },
        ]
      : []),
    ...(proposal.status === 'scheduled' || proposal.status === 'deposit_paid'
      ? [
          {
            key: 'mark_paid',
            label: 'Mark paid',
            onClick: () => handleMarkPaid(proposal.id),
          },
        ]
      : []),
    {
      key: 'download_json',
      label: 'Export JSON',
      onClick: () => handleExport(proposal),
    },
    {
      key: 'delete',
      label: 'Delete',
      variant: 'danger' as const,
      onClick: () => {
        soundService.play('modal');
        setDeleteConfirm(proposal.id);
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <p className="text-white dark:white font-semibold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
  Loading proposals...
</p>
        </div>
      </div>
    );
  }

  return (
    <AppPage
      className="w-full !max-w-none pt-6"
      data-testid="proposal-pipeline-page"
      header={
        <PageHeader
          title="Proposal Pipeline"
          subtitle="CRM-style pipeline — see what's stuck, what's won, and what to do next."
          className="[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300"
          actions={
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Upload size={18} />}
                disabled={importing}
                isLoading={importing}
                onClick={() => importInputRef.current?.click()}
                data-testid="proposal-pipeline-import-button"
              >
                Import
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/proposal-generator')}
                icon={<Plus size={18} />}
                data-testid="proposal-pipeline-new-button"
              >
                New Proposal
              </Button>
            </>
          }
        />
      }
    >
      <KpiStrip className="mb-6" premium metrics={[
          {
            label: 'Pipeline value',
            value: formatProposalMoney(crmRevenue.pipelineValue),
            change: 'Excludes declined proposals',
          },
          {
            label: 'Weighted forecast',
            value: formatProposalMoney(crmRevenue.weightedForecast),
            change: 'Probability-weighted active pipeline',
          },
          {
            label: 'Won this month',
            value: formatProposalMoney(crmRevenue.wonThisMonth),
            change: 'Accepted & paid this month',
            highlight: true,
          },
          {
            label: 'Average margin',
            value: formatWinRate(crmRevenue.averageMargin),
            change: `Win rate ${formatWinRate(crmRevenue.winRate)} · active proposals`,
          },
        ]}
      />

      <Card
        className={`${PREMIUM_PANEL} p-5 sm:p-6`}
        data-testid="proposal-pipeline-board-card"
      >
          <ProposalPipelineBoard
            proposals={proposals}
            selected={pipelineFilter}
            onSelect={setPipelineFilter}
          />

          <ProposalNextActionsPanel
            items={nextActions}
            onAction={(action) => void handleNextAction(action)}
          />

          {importMessage && (
            <InlineNotice
              variant="success"
              title={importMessage}
              className="mt-5"
            />
          )}

          {displayError && (
            <InlineNotice
              variant="danger"
              title={displayError}
              className="mt-5"
            />
          )}

          {proposals.length === 0 ? (
            <EmptyState
              className="mt-5"
              title="No proposals yet"
              description="Create your first proposal to start tracking bids and revenue."
              action={{
                label: 'New Proposal',
                onClick: () => navigate('/proposal-generator'),
              }}
            />
          ) : filteredProposals.length === 0 ? (
            <EmptyState
              className="mt-5"
              title="No proposals in this stage"
              description="Try another pipeline stage or create a new proposal."
              action={{
                label: 'New Proposal',
                onClick: () => navigate('/proposal-generator'),
              }}
            />
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredProposals.map((proposal) => (
                <div key={proposal.id} id={`proposal-card-${proposal.id}`}>
                  <ProposalPipelineCard
                    proposal={proposal}
                    expanded={expandedProposalId === proposal.id}
                    onToggleExpand={() =>
                      setExpandedProposalId((id) =>
                        id === proposal.id ? null : proposal.id,
                      )
                    }
                    formatDateOnly={formatDateOnly}
                    formatDateTime={formatDateTime}
                    handlers={{
                      onOpen: () => handlePreview(proposal),
                      onSend: () => void handleSend(proposal.id),
                      onDuplicate: () => void handleDuplicate(proposal),
                      onPdf: () => handlePreview(proposal),
                      onShareLink: () => void handleShareClientLink(proposal),
                      overflowItems: buildOverflowItems(proposal),
                    }}
                  />
                </div>
              ))}
            </div>
          )}

        </Card>

        <ModalShell
          isOpen={Boolean(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
          title="Delete proposal"
          size="sm"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteConfirm && void handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="mb-2 text-gray-600 dark:text-gray-300">
            Are you sure you want to delete this proposal? This action cannot be undone.
          </p>
        </ModalShell>

        <ProposalSentLinkModal
          isOpen={Boolean(linkModal)}
          onClose={() => setLinkModal(null)}
          proposalUrl={linkModal?.url ?? ''}
          title={linkModal?.title}
        />

        <ProposalSendEmailModal
          isOpen={Boolean(emailModal)}
          onClose={closeEmailModal}
          proposalTitle={emailModal?.proposalTitle ?? 'Proposal'}
          mode={emailModal?.mode}
          defaultRecipientEmail={emailModal?.defaultRecipientEmail}
          sending={sendingEmail}
          error={emailError}
          onSend={handleSendEmail}
        />
    </AppPage>
  );
};

export default Proposals; 