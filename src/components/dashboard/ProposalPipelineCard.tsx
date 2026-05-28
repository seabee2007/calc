import React from 'react';
import { FileStack } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
import {
  PROPOSAL_PIPELINE_STATUSES,
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from '../../types/proposalTracking';
import type { ProposalPipelineCounts } from '../../utils/proposalKpis';
import { formatProposalMoney } from '../../utils/proposalKpis';

interface ProposalPipelineCardProps {
  pipeline: ProposalPipelineCounts;
  pendingRevenue: number;
}

const ProposalPipelineCard: React.FC<ProposalPipelineCardProps> = ({
  pipeline,
  pendingRevenue,
}) => {
  const navigate = useNavigate();

  return (
    <OpsCard className="rounded-2x1 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <FileStack className="h-5 w-5 text-violet-400" />
        <h3 className="font-semibold text-white">Proposal pipeline</h3>
      </div>

      <div className={`${OPS_PANEL_INNER} p-3 mb-4`}>
        <p className="text-xs text-slate-500 uppercase">Pending revenue</p>
        <p className="text-xl font-bold text-emerald-400">
          {formatProposalMoney(pendingRevenue)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {PROPOSAL_PIPELINE_STATUSES.map((status: ProposalStatus) => (
          <div key={status} className={`${OPS_PANEL_INNER} p-2 text-center`}>
            <p className="text-lg font-bold text-white">{pipeline[status]}</p>
            <p className="text-[10px] text-slate-500 uppercase leading-tight">
              {PROPOSAL_STATUS_LABELS[status]}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/proposals')}
        className="text-sm text-cyan-400 hover:underline w-full text-left"
      >
        Manage proposals →
      </button>
    </OpsCard>
  );
};

export default ProposalPipelineCard;
