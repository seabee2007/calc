import React from 'react';
import { ArrowRight } from 'lucide-react';
import {
  PREMIUM_ACTION_ROW,
  PREMIUM_ACTIONS_SECTION,
  PREMIUM_CTA_PILL,
} from '../../theme/appTheme';
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
    <div className={`mt-6 p-4 sm:p-5 ${PREMIUM_ACTIONS_SECTION}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-cyan-300/90">
        Next actions
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onAction(item)}
              className={`group flex w-full items-center gap-4 px-4 py-3.5 text-left ${PREMIUM_ACTION_ROW}`}
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
              <span className={PREMIUM_CTA_PILL}>
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
