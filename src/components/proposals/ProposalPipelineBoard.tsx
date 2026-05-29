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
    <div className="mt-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
      {CRM_PIPELINE_COLUMNS.map((col) => {
        const { count, value } = sumPipelineColumn(proposals, col.id);
        const isActive = selected === col.id;
        return (
          <button
            key={col.id}
            type="button"
            onClick={() => onSelect(col.id)}
            className={[
              'shrink-0 min-w-[7.5rem] rounded-xl border px-4 py-3 text-left transition',
              isActive
                ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-600',
            ].join(' ')}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${
                isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {col.label}
            </p>
            <p
              className={`mt-1 text-2xl font-extrabold tabular-nums ${
                isActive ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}
            >
              {count}
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold tabular-nums ${
                isActive ? 'text-blue-100' : 'text-slate-600 dark:text-slate-300'
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
