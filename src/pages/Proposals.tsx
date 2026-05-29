import React, { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { soundService } from '../services/soundService';
import KPIStatCard from '../components/proposals/KPIStatCard';
import ProposalSentLinkModal from '../components/proposals/ProposalSentLinkModal';
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

const Proposals: React.FC = () => {
  const navigate = useNavigate();
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

  const setError = (msg: string | null) => setLocalError(msg);
  const displayError = localError ?? error;

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
    try {
      const sent = await markProposalSent(proposalId);
      await loadProposals();
      openProposalLinkModal(
        getPublicProposalUrl(sent.public_token),
        'Proposal Sent',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send proposal');
    }
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

  const scrollToProposal = (proposalId: string) => {
    setExpandedProposalId(proposalId);
    requestAnimationFrame(() => {
      document
        .getElementById(`proposal-card-${proposalId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

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
      key: 'duplicate',
      label: 'Duplicate',
      onClick: () => handleDuplicate(proposal),
    },
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
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-800/70 sm:p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Proposal Pipeline
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                CRM-style pipeline — see what&apos;s stuck, what&apos;s won, and what to do next.
              </p>
            </div>

            <div className="flex items-center gap-3">
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
                icon={<Upload size={18} />}
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
              >
                {importing ? 'Importing…' : 'Import'}
              </Button>

              {/* New Proposal Button */}
              <Button
                onClick={() => navigate('/proposal-generator')}
                icon={<Plus size={18} />}
              >
                New Proposal
              </Button>
            </div>
          </motion.div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPIStatCard
              label="Pipeline Value"
              value={formatProposalMoney(crmRevenue.pipelineValue)}
              hint="All active proposals"
            />
            <KPIStatCard
              label="Weighted Forecast"
              value={formatProposalMoney(crmRevenue.weightedForecast)}
              hint="Draft 10% · Sent 25% · Viewed 50% · Won 100%"
            />
            <KPIStatCard
              label="Won This Month"
              value={formatProposalMoney(crmRevenue.wonThisMonth)}
            />
            <KPIStatCard
              label="Average Margin"
              value={formatWinRate(crmRevenue.averageMargin)}
              hint={`Win rate ${formatWinRate(crmRevenue.winRate)} · Need follow-up ${crmRevenue.needFollowUpCount}${
                crmRevenue.oldestFollowUpDays != null
                  ? ` · Oldest ${crmRevenue.oldestFollowUpDays}d`
                  : ''
              }`}
            />
          </div>

          <ProposalPipelineBoard
            proposals={proposals}
            selected={pipelineFilter}
            onSelect={setPipelineFilter}
          />

          <ProposalNextActionsPanel
            items={nextActions}
            onSelectProposal={scrollToProposal}
          />

          {importMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
            >
              <p className="text-emerald-800 dark:text-emerald-200">{importMessage}</p>
              <button
                type="button"
                onClick={() => setImportMessage(null)}
                className="mt-1 text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* Error Message */}
          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            >
              <p className="text-red-700 dark:text-red-300">{displayError}</p>
              <button
                onClick={() => setError(null)}
                className="mt-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* Proposals Grid */}
          {proposals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
            >
              <h3 className="text-xl font-semibold text-slate-200 dark:text-white">
                No proposals yet
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                Create your first proposal to start tracking bids and revenue.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/proposal-generator')} icon={<Plus size={18} />}>
                  New Proposal
                </Button>
              </div>
            </motion.div>
          ) : filteredProposals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                No proposals in this stage
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                Try another pipeline stage or create a new proposal.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/proposal-generator')} icon={<Plus size={18} />}>
                  New Proposal
                </Button>
              </div>
            </motion.div>
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
                      onRequestDeposit: () => void handleMarkDeposit(proposal.id),
                      overflowItems: buildOverflowItems(proposal),
                    }}
                  />
                </div>
              ))}
            </div>
          )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Proposal</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete this proposal? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDelete(deleteConfirm)}
                  className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        <ProposalSentLinkModal
          isOpen={Boolean(linkModal)}
          onClose={() => setLinkModal(null)}
          proposalUrl={linkModal?.url ?? ''}
          title={linkModal?.title}
        />
        </div>
      </div>
    </div>
  );
};

export default Proposals; 