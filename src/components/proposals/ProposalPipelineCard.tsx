import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { SavedProposal } from '../../lib/proposalService';
import type { ProposalStatus } from '../../types/proposalTracking';
import { formatProposalMoney, formatWinRate } from '../../utils/proposalKpis';
import {
  buildProposalActivityTimeline,
  getProposalAging,
  getProposalMargin,
} from '../../utils/proposalCrm';
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

  const total = Number(proposal.total_amount ?? 0);
  const profit =
    total - Number(proposal.labor_cost ?? 0) - Number(proposal.material_cost ?? 0);
  const margin = getProposalMargin(proposal);
  const status = (proposal.status ?? 'draft') as ProposalStatus;
  const aging = getProposalAging(proposal);
  const timeline = buildProposalActivityTimeline(proposal);

  return (
    <motion.article
      layout
      className={[
        'rounded-2xl border bg-white/70 shadow-sm backdrop-blur-sm transition-colors dark:bg-gray-900/60',
        expanded
          ? 'border-blue-300 dark:border-blue-700/70'
          : 'border-slate-200/70 dark:border-gray-800',
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
              <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                {projectName}
              </h3>
              <p className="truncate text-sm text-slate-600 dark:text-gray-300">
                {displayClient}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <ProposalStatusBadge status={status} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatProposalMoney(total)}
              </p>
              {margin > 0 && (
                <p className="text-sm font-semibold text-slate-600 dark:text-gray-300">
                  {formatWinRate(margin)} margin
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">{aging.activityLine}</p>
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
            <div className="border-t border-slate-200/70 px-4 pb-4 pt-3 dark:border-gray-800">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                    Projected profit
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {formatProposalMoney(profit)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                    Sent
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {proposal.sent_at ? formatDateOnly(proposal.sent_at) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30 col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                    Last viewed
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
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

              <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/40 p-3 dark:border-gray-800 dark:bg-gray-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  Activity timeline
                </p>
                <ul className="mt-2 space-y-2">
                  {timeline.map((ev) => (
                    <li
                      key={`${ev.sortKey}-${ev.label}`}
                      className="flex gap-3 text-sm"
                    >
                      <span className="w-24 shrink-0 text-slate-500 dark:text-gray-400">
                        {formatDateOnly(ev.date)}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-gray-200">
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
