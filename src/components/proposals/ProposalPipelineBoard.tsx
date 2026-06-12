import React from 'react';
import {
  CRM_PIPELINE_COLUMNS,
  sumPipelineColumn,
  type CrmPipelineFilter,
} from '../../utils/proposalCrm';
import { formatProposalMoney } from '../../utils/proposalKpis';
import type { SavedProposal } from '../../lib/proposalService';

interface ProposalPipelineBoardProps {
  proposals: SavedProposal[];
  selected: CrmPipelineFilter;
  onSelect: (filter: CrmPipelineFilter) => void;
}

export default function ProposalPipelineBoard({
  proposals,
  selected,
  onSelect,
}: ProposalPipelineBoardProps) {
  return (
    <div
      className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1"
      role="group"
      aria-label="Proposal pipeline stage"
    >
      {CRM_PIPELINE_COLUMNS.map((col) => {
        const { count, value } = sumPipelineColumn(proposals, col.id);
        const isActive = selected === col.id;
        return (
          <button
            key={col.id}
            type="button"
            aria-pressed={isActive}
            data-testid={`proposal-pipeline-stage-${col.id}`}
            onClick={() => onSelect(col.id)}
            className={[
              'shrink-0 min-w-[7.75rem] rounded-lg border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
              isActive
                ? 'border-blue-600 bg-blue-600 text-white shadow-md dark:border-cyan-600 dark:bg-cyan-600 dark:shadow-lg dark:shadow-cyan-950/40'
                : 'border-slate-300 bg-white/80 text-slate-900 shadow-sm shadow-slate-200/50 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-100 dark:shadow-black/15 dark:hover:border-slate-600 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${
                isActive
                  ? 'text-blue-100 dark:text-cyan-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {col.label}
            </p>
            <p
              className={`mt-1 text-2xl font-extrabold tabular-nums ${
                isActive ? 'text-white' : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {count}
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold tabular-nums ${
                isActive
                  ? 'text-blue-100 dark:text-cyan-100'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {formatProposalMoney(value)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
