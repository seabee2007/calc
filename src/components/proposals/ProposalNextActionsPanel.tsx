import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { CrmNextActionItem } from '../../utils/proposalCrm';

interface ProposalNextActionsPanelProps {
  items: CrmNextActionItem[];
  onSelectProposal: (proposalId: string) => void;
}

export default function ProposalNextActionsPanel({
  items,
  onSelectProposal,
}: ProposalNextActionsPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/90 to-slate-50/90 p-4 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-slate-900/40">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
        Next actions
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.proposalId}>
            <button
              type="button"
              onClick={() => onSelectProposal(item.proposalId)}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-700"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  {item.actionTitle}
                </span>
                <span className="block text-sm text-slate-600 dark:text-slate-300">
                  {item.clientName} · {item.projectTitle}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {item.actionDetail}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
