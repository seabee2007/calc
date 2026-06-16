import React, { useMemo } from 'react';
import { FileStack } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import type {
  ProposalPipelineCounts,
} from '../../utils/proposalKpis';
import { formatProposalMoney } from '../../utils/proposalKpis';
import { buildCrmRevenueMetrics } from '../../utils/proposalCrm';

interface ProposalPipelineCardProps {
  pipeline: ProposalPipelineCounts;
  pipelineValue: number;
  weightedForecast: number;
  proposals: TrackedProposalRow[];
  winRate: number;
  wonThisMonth: number;
  embedded?: boolean;
}

const ProposalPipelineCard: React.FC<ProposalPipelineCardProps> = ({
  pipeline,
  pipelineValue,
  weightedForecast,
  proposals,
  winRate,
  wonThisMonth,
  embedded = false,
}) => {
  const navigate = useNavigate();

  const needFollowUpCount = useMemo(
    () => buildCrmRevenueMetrics(proposals, winRate, wonThisMonth).needFollowUpCount,
    [proposals, winRate, wonThisMonth],
  );

  const sentCount = pipeline.sent + pipeline.viewed + pipeline.opened;
  const acceptedCount =
    pipeline.accepted + pipeline.deposit_paid + pipeline.scheduled;

  const statusChips = [
    { label: 'Needs follow-up', value: String(needFollowUpCount), highlight: needFollowUpCount > 0 },
    { label: 'Draft', value: String(pipeline.draft) },
    { label: 'In review', value: String(sentCount) },
    { label: 'Accepted', value: String(acceptedCount) },
  ];

  const body = (
    <>
      <header className={`${embedded ? 'mb-3' : 'mb-4'} flex flex-wrap items-center justify-end gap-3`}>
        {!embedded ? (
          <div className="mr-auto flex items-center gap-2">
            <FileStack className="h-5 w-5 text-violet-400" />
            <h3 className={`font-semibold ${OPS_TITLE}`}>Proposal pipeline</h3>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => navigate('/proposals')}
          className="text-sm text-cyan-700 hover:underline dark:text-cyan-400"
        >
          Manage proposals →
        </button>
      </header>

      <div className={`${OPS_PANEL_INNER} mb-4 grid grid-cols-2 gap-3 p-3`}>
        <div>
          <p className={`text-xs uppercase ${OPS_SUBTLE}`}>Pipeline value</p>
          <p className="text-lg font-bold tabular-nums text-emerald-400">
            {formatProposalMoney(pipelineValue)}
          </p>
          <p className={`mt-0.5 text-[10px] ${OPS_SUBTLE}`}>Active proposals</p>
        </div>
        <div>
          <p className={`text-xs uppercase ${OPS_SUBTLE}`}>Weighted forecast</p>
          <p className="text-lg font-bold tabular-nums text-cyan-400">
            {formatProposalMoney(weightedForecast)}
          </p>
          <p className={`mt-0.5 text-[10px] ${OPS_SUBTLE}`}>Probability-weighted</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusChips.map((chip) => (
          <div
            key={chip.label}
            className={`${OPS_PANEL_INNER} min-w-[4.5rem] flex-1 px-3 py-2 text-center`}
          >
            <p
              className={`text-lg font-bold tabular-nums ${
                chip.highlight ? 'text-amber-400' : OPS_TITLE
              }`}
            >
              {chip.value}
            </p>
            <p className={`text-[10px] uppercase leading-tight ${OPS_SUBTLE}`}>{chip.label}</p>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return body;
  return <OpsCard className="rounded-2x1 overflow-hidden">{body}</OpsCard>;
};

export default ProposalPipelineCard;
