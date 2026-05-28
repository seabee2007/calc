import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Plus,
} from 'lucide-react';
import { ProposalService, SavedProposal } from '../lib/proposalService';
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_PIPELINE_STATUSES,
  type ProposalStatus,
} from '../types/proposalTracking';
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
import ProposalStatusBadge from '../components/proposals/ProposalStatusBadge';
import ProposalActionButtons from '../components/proposals/ProposalActionButtons';

const Proposals: React.FC = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<SavedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | ProposalStatus>('all');

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ProposalService.getAll();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      soundService.play('trash');
      await ProposalService.delete(id);
      setProposals(prev => prev.filter(p => p.id !== id));
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
    if (!file) return;

    try {
      const proposalData = await ProposalService.importFromJSON(file);
      const title = `Imported Proposal - ${new Date().toLocaleDateString()}`;
      await ProposalService.create({
        title,
        template_type: 'classic',
        data: proposalData,
      });
      loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import proposal');
    }
    
    // Reset the file input
    event.target.value = '';
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

  const handleCopyClientLink = async (proposal: SavedProposal) => {
    if (proposal.status === 'draft') {
      setError('Send the proposal first to generate a client link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(getPublicProposalUrl(proposal.public_token));
      soundService.play('save');
    } catch {
      setError('Could not copy link.');
    }
  };

  const handleSend = async (proposalId: string) => {
    try {
      await markProposalSent(proposalId);
      await loadProposals();
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

  const filteredProposals = useMemo(() => {
    if (selectedStatus === 'all') return proposals;
    return proposals.filter((p) => (p.status ?? 'draft') === selectedStatus);
  }, [proposals, selectedStatus]);

  const metrics = useMemo(() => buildProposalDashboardMetrics(proposals), [proposals]);
  const awaitingResponseCount = useMemo(() => {
    const pipeline = metrics.pipeline;
    return (pipeline.sent ?? 0) + (pipeline.viewed ?? 0) + (pipeline.opened ?? 0);
  }, [metrics.pipeline]);

  const tabs: Array<{ key: 'all' | ProposalStatus; label: string; count?: number }> =
    useMemo(() => {
      const pipeline = metrics.pipeline;
      return [
        { key: 'all', label: 'All', count: proposals.length },
        ...PROPOSAL_PIPELINE_STATUSES.map((s) => ({
          key: s,
          label: PROPOSAL_STATUS_LABELS[s],
          count: pipeline[s],
        })),
      ];
    }, [metrics.pipeline, proposals.length]);

  const getNextAction = (p: SavedProposal): string => {
    const status = p.status ?? 'draft';
    switch (status) {
      case 'draft':
        return 'Send proposal';
      case 'sent':
      case 'viewed':
      case 'opened':
        return 'Follow up with client';
      case 'accepted':
        return 'Awaiting deposit';
      case 'deposit_paid':
        return 'Schedule placement';
      case 'scheduled':
        return 'Confirm schedule and mobilize crew';
      case 'paid':
        return 'Close out and archive job';
      case 'declined':
        return 'Review feedback and revise bid';
      default:
        return 'Review proposal';
    }
  };

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
                Track bids, client activity, revenue, and upcoming work.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Import Button */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button variant="outline" icon={<Upload size={18} />}>
                  Import
                </Button>
              </label>

              {/* New Proposal Button */}
              <Button
                onClick={() => navigate('/proposal-generator')}
                icon={<Plus size={18} />}
              >
                New Proposal
              </Button>
            </div>
          </motion.div>

          {/* KPI row */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPIStatCard
              label="Pending Revenue"
              value={formatProposalMoney(metrics.financial.pendingRevenue)}
              hint="Sent • Viewed • Opened"
            />
            <KPIStatCard
              label="Accepted This Month"
              value={formatProposalMoney(metrics.financial.monthlyRevenue)}
            />
            <KPIStatCard
              label="Win Rate"
              value={formatWinRate(metrics.financial.winRate)}
              hint={`${metrics.financial.acceptedCount} won • ${metrics.financial.declinedCount} lost`}
            />
            <KPIStatCard
              label="Awaiting Response"
              value={String(awaitingResponseCount)}
              hint="Needs follow-up"
            />
          </div>

          {/* Status filter tabs */}
          <div className="mt-5 flex flex-wrap gap-2">
            {tabs.map((t) => {
              const selected = t.key === selectedStatus;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedStatus(t.key)}
                  className={[
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  <span>{t.label}</span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs',
                      selected
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700',
                    ].join(' ')}
                  >
                    {t.count ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            >
              <p className="text-red-700 dark:text-red-300">{error}</p>
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
                Try another status tab or create a new proposal.
              </p>
              <div className="mt-6">
                <Button onClick={() => navigate('/proposal-generator')} icon={<Plus size={18} />}>
                  New Proposal
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProposals.map((proposal, index) => {
                const projectName =
                  proposal.data?.projectTitle?.trim() || proposal.title || 'Untitled project';
                const clientName = proposal.data?.clientName?.trim() || 'Client';

                const total = Number(proposal.total_amount ?? 0);
                const profit = total - Number(proposal.labor_cost ?? 0) - Number(proposal.material_cost ?? 0);
                const margin = total > 0 ? profit / total : 0;

                const status = proposal.status ?? 'draft';
                const nextAction = getNextAction(proposal);

                const sentAt = proposal.sent_at;
                const viewedAt = proposal.viewed_at ?? proposal.opened_at;
                const acceptedAt = proposal.accepted_at;
                const paidAt = proposal.paid_at;

                return (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.35) }}
                    className="group rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-blue-700/70"
                  >
                    {/* Top */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-slate-900 dark:text-white">
                          {projectName}
                        </div>
                        <div className="truncate text-sm text-slate-600 dark:text-gray-300">
                          {clientName}
                        </div>
                      </div>
                      <ProposalStatusBadge status={status} className="shrink-0" />
                    </div>

                    {/* Middle */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <div className="text-xs font-semibold tracking-wide text-slate-600 dark:text-gray-400">
                          Proposal Value
                        </div>
                        <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                          {formatProposalMoney(total)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                        <div className="text-xs font-semibold text-slate-600 dark:text-gray-400">
                          Projected Profit
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {formatProposalMoney(profit)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                        <div className="text-xs font-semibold text-slate-600 dark:text-gray-400">
                          Margin
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {formatWinRate(margin)}
                        </div>
                      </div>
                    </div>

                    {/* Client activity */}
                    <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                      <div className="text-xs font-semibold tracking-wide text-slate-600 dark:text-gray-400">
                        Client Activity
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 dark:text-gray-400">Sent</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {sentAt ? formatDateOnly(sentAt) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 dark:text-gray-400">Viewed</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {viewedAt ? formatDateTime(viewedAt) : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 dark:text-gray-400">Accepted</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {acceptedAt ? formatDateOnly(acceptedAt) : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 dark:text-gray-400">Paid</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {paidAt ? formatDateOnly(paidAt) : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Next action */}
                    <div className="mt-4 rounded-xl border border-blue-200/60 bg-blue-50/60 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
                      <div className="text-xs font-semibold tracking-wide text-blue-800 dark:text-blue-200">
                        Next Action
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-blue-900 dark:text-blue-100">
                        {nextAction}
                      </div>
                    </div>

                    {/* Project link */}
                    <button
                      type="button"
                      onClick={() => navigate('/projects')}
                      className="mt-4 w-full rounded-xl border border-slate-200/70 bg-white/40 px-3 py-2 text-left transition-colors hover:bg-white/70 dark:border-gray-800 dark:bg-gray-950/30 dark:hover:bg-gray-900/70"
                    >
                      <div className="text-xs font-semibold tracking-wide text-slate-600 dark:text-gray-400">
                        Project
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {projectName}
                      </div>
                    </button>

                    {/* Bottom actions */}
                    <div className="mt-4">
                      <ProposalActionButtons
                        onOpen={() => handlePreview(proposal)}
                        onSend={() => handleSend(proposal.id)}
                        onDuplicate={() => handleDuplicate(proposal)}
                        onPdf={() => handlePreview(proposal)}
                        onShareLink={() => handleCopyClientLink(proposal)}
                        overflowItems={[
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
                            variant: 'danger',
                            onClick: () => {
                              soundService.play('modal');
                              setDeleteConfirm(proposal.id);
                            },
                          },
                        ]}
                      />
                    </div>
                  </motion.div>
                );
              })}
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
        </div>
      </div>
    </div>
  );
};

export default Proposals; 