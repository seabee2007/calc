import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileStack } from 'lucide-react';
import OpsCard from './OpsCard';
import { OPS_COMPACT_CARD, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import { formatProposalMoney } from '../../utils/proposalKpis';

interface DashboardProposalLinkProps {
  pipelineValue: number;
  proposalCount: number;
}

/** Compact proposal summary — one number + link (dashboard discipline). */
const DashboardProposalLink: React.FC<DashboardProposalLinkProps> = ({
  pipelineValue,
  proposalCount,
}) => {
  const navigate = useNavigate();

  return (
    <div className={OPS_COMPACT_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileStack className="h-4 w-4 text-violet-500" aria-hidden />
          <span className={`text-sm font-medium ${OPS_TITLE}`}>Proposal pipeline</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/proposals')}
          className="text-sm text-cyan-700 hover:underline dark:text-cyan-400"
        >
          View pipeline →
        </button>
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${OPS_TITLE}`}>
        {formatProposalMoney(pipelineValue)}
      </p>
      <p className={`mt-0.5 text-xs ${OPS_SUBTLE}`}>
        {proposalCount} active proposal{proposalCount === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export default DashboardProposalLink;
