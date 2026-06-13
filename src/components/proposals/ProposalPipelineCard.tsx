import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { SavedProposal } from '../../lib/proposalService';
import type { ProposalStatus } from '../../types/proposalTracking';
import { formatProposalMoney, formatWinRate } from '../../utils/proposalKpis';
import { resolveProposalGrossProfit, resolveTrackedProposalFinancials } from '../../utils/proposalFinancials';
import {
  buildProposalActivityTimeline,
  getProposalAging,
  getProposalMargin,
} from '../../utils/proposalCrm';
import { PREMIUM_INNER_PANEL } from '../../theme/appTheme';
import ClientAvatar from './ClientAvatar';
import ProposalStatusBadge from './ProposalStatusBadge';
import ProposalActionButtons from './ProposalActionButtons';

export interface ProposalPipelineCardHandlers {
  onOpen: () => void;
  onSend: () => void;
  onDuplicate: () => void;
  onPdf: () => void;
  onShareLink: () => void;
  overflowItems: Parameters<typeof ProposalActionButtons>[0]['overflowItems'];
}

interface ProposalPipelineCardProps {
  proposal: SavedProposal;
  expanded?: boolean;
  onToggleExpand?: () => void;
  handlers: ProposalPipelineCardHandlers;
  formatDateOnly: (iso: string) => string;
  formatDateTime: (iso: string) => string;
}

export default function ProposalPipelineCard({
  proposal,
  expanded: expandedProp,
  onToggleExpand,
  handlers,
  formatDateOnly,
  formatDateTime,
}: ProposalPipelineCardProps) {
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = expandedProp ?? expandedLocal;
  const toggleExpand = onToggleExpand ?? (() => setExpandedLocal((v) => !v));

  const projectName =
    proposal.data?.projectTitle?.trim() || proposal.title || 'Untitled project';
  const clientName = proposal.data?.clientName?.trim() || 'Client';
  const company = proposal.data?.clientCompany?.trim();
  const displayClient = company ? `${clientName} · ${company}` : clientName;

  const financials = resolveTrackedProposalFinancials(proposal);
  const total = financials.total_amount;
  const profit = resolveProposalGrossProfit(financials);
  const margin = getProposalMargin(proposal);
  const status = (proposal.status ?? 'draft') as ProposalStatus;
  const aging = getProposalAging(proposal);
  const timeline = buildProposalActivityTimeline(proposal);

  return (
    <motion.article
      layout
      className={[
        'rounded-xl border bg-white/80 shadow-md shadow-slate-200/50 transition-all dark:bg-slate-800/70 dark:shadow-black/20',
        expanded
          ? 'border-blue-300 shadow-lg shadow-slate-200/60 dark:border-cyan-600/50 dark:shadow-black/25'
          : 'border-slate-200/70 hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:hover:border-slate-600/80 dark:hover:bg-slate-800/85',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={toggleExpand}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <ClientAvatar name={clientName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">
                {projectName}
              </h3>
              <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                {displayClient}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <ProposalStatusBadge status={status} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                {formatProposalMoney(total)}
              </p>
              {margin > 0 && (
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {formatWinRate(margin)} margin
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{aging.activityLine}</p>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/70 px-4 pb-4 pt-3 dark:border-slate-700/70">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className={`p-3 ${PREMIUM_INNER_PANEL}`}>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Projected profit
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {formatProposalMoney(profit)}
                  </p>
                </div>
                <div className={`p-3 ${PREMIUM_INNER_PANEL}`}>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Sent
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {proposal.sent_at ? formatDateOnly(proposal.sent_at) : '—'}
                  </p>
                </div>
                <div className={`p-3 col-span-2 sm:col-span-1 ${PREMIUM_INNER_PANEL}`}>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Last viewed
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {proposal.viewed_at || proposal.opened_at
                      ? formatDateTime(proposal.viewed_at ?? proposal.opened_at!)
                      : '—'}
                  </p>
                </div>
              </div>

              <ProposalActionButtons
                onOpen={handlers.onOpen}
                onSend={handlers.onSend}
                onDuplicate={handlers.onDuplicate}
                onPdf={handlers.onPdf}
                onShareLink={handlers.onShareLink}
                overflowItems={handlers.overflowItems}
              />

              <div className={`mt-4 p-3 ${PREMIUM_INNER_PANEL}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Activity timeline
                </p>
                <ul className="mt-2 space-y-2">
                  {timeline.map((ev) => (
                    <li
                      key={`${ev.sortKey}-${ev.label}`}
                      className="flex gap-3 text-sm"
                    >
                      <span className="w-24 shrink-0 text-slate-500 dark:text-slate-400">
                        {formatDateOnly(ev.date)}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {ev.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
