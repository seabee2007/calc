import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Loader2 } from 'lucide-react';
import ProposalTemplateClassic from '../components/proposals/ProposalTemplateClassic';
import ProposalTemplateModern from '../components/proposals/ProposalTemplateModern';
import ProposalTemplateMinimal from '../components/proposals/ProposalTemplateMinimal';
import type { ProposalData } from '../types/proposal';
import type { TrackedProposalRow } from '../types/proposalTracking';
import {
  acceptProposal,
  declineProposal,
  fetchProposalByPublicToken,
  markProposalOpened,
} from '../lib/proposalTracking';
import { parseProposalAmount } from '../utils/proposalFinancials';
import Button from '../components/ui/Button';

function formatTotal(total: number): string {
  return total.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function proposalTotal(data: ProposalData): number {
  return (data.pricing ?? []).reduce((s, row) => s + parseProposalAmount(row.amount), 0);
}

const PublicProposal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<TrackedProposalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid proposal link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const row = await fetchProposalByPublicToken(token);
        if (cancelled) return;
        if (!row) {
          setError('This proposal is unavailable or has not been sent yet.');
          setLoading(false);
          return;
        }
        setProposal(row);
        if (!openedRef.current) {
          openedRef.current = true;
          const updated = await markProposalOpened(token);
          if (!cancelled) setProposal(updated);
        }
      } catch {
        if (!cancelled) setError('Could not load this proposal.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setActionLoading('accept');
    try {
      const updated = await acceptProposal(token);
      setProposal(updated);
    } catch {
      setError('Could not record acceptance. Please contact your contractor.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionLoading('decline');
    try {
      const updated = await declineProposal(token);
      setProposal(updated);
    } catch {
      setError('Could not record decline. Please contact your contractor.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Proposal unavailable
          </p>
          <p className="text-gray-600 dark:text-gray-300">{error ?? 'Not found'}</p>
        </div>
      </div>
    );
  }

  const data = proposal.data;
  const total = formatTotal(proposalTotal(data));
  const isFinal = proposal.status === 'accepted' || proposal.status === 'declined';

  const templateProps = {
    data,
    total,
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {data.businessName} — Project proposal
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {data.projectTitle || proposal.title}
          </h1>
        </div>

        {proposal.status === 'accepted' && (
          <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-4 text-center text-emerald-800 dark:text-emerald-200">
            You accepted this proposal. Your contractor will follow up to schedule work.
          </div>
        )}
        {proposal.status === 'declined' && (
          <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center text-slate-700 dark:text-slate-300">
            This proposal was declined.
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-6">
          {proposal.template_type === 'modern' && (
            <ProposalTemplateModern {...templateProps} />
          )}
          {proposal.template_type === 'minimal' && (
            <ProposalTemplateMinimal {...templateProps} />
          )}
          {(proposal.template_type === 'classic' || !proposal.template_type) && (
            <ProposalTemplateClassic {...templateProps} />
          )}
        </div>

        {!isFinal && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center sticky bottom-4 pb-safe">
            <Button
              size="lg"
              className="!bg-emerald-600 hover:!bg-emerald-500 !text-white flex-1 sm:flex-none"
              onClick={handleAccept}
              disabled={actionLoading !== null}
              icon={
                actionLoading === 'accept' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )
              }
            >
              Accept Proposal
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 sm:flex-none border-slate-400 dark:border-slate-600"
              onClick={handleDecline}
              disabled={actionLoading !== null}
              icon={
                actionLoading === 'decline' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <X className="h-5 w-5" />
                )
              }
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProposal;
