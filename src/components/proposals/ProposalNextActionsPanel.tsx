import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { ProposalNextAction } from '../../types/proposalNextAction';
import { isProposalEmailAction } from '../../types/proposalNextAction';
import { getClientEmailSubmitLabel } from '../../utils/proposalNextActionEmail';
import { proposalNextActionToEmailMode } from '../../utils/proposalNextActionEmail';

interface ProposalNextActionsPanelProps {
  items: ProposalNextAction[];
  onAction: (action: ProposalNextAction) => void;
}

function actionButtonLabel(action: ProposalNextAction): string {
  if (isProposalEmailAction(action.type)) {
    return getClientEmailSubmitLabel(proposalNextActionToEmailMode(action.type));
  }
  return action.label;
}

export default function ProposalNextActionsPanel({
  items,
  onAction,
}: ProposalNextActionsPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/90 to-slate-50/90 p-4 shadow-inner shadow-slate-200/30 dark:border-cyan-900/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-blue-950/40 dark:shadow-black/20 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-cyan-300/90">
        Next actions
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onAction(item)}
              className="group flex w-full items-center gap-4 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3.5 text-left transition-all hover:border-blue-300 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700/70 dark:bg-slate-800/70 dark:hover:border-cyan-700/60 dark:hover:bg-slate-800 dark:hover:shadow-black/20 dark:focus-visible:ring-offset-slate-900"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
                  {item.clientName} · {item.proposalTitle ?? item.projectName}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-cyan-500 group-active:bg-cyan-700">
                {actionButtonLabel(item)}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
