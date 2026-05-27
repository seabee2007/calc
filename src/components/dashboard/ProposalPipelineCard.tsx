import React from 'react';
import { DollarSign, FileStack } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
import type { ProposalPipelineStats } from '../../utils/projectWorkflow';

interface ProposalPipelineCardProps {
  pipeline: ProposalPipelineStats;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

const ProposalPipelineCard: React.FC<ProposalPipelineCardProps> = ({ pipeline }) => {
  const navigate = useNavigate();

  const rows = [
    { label: 'Drafts', value: pipeline.drafts },
    { label: 'Sent', value: pipeline.sent },
    { label: 'Viewed', value: pipeline.viewed },
    { label: 'Accepted', value: pipeline.accepted },
    { label: 'Declined', value: pipeline.declined },
  ];

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <FileStack className="h-5 w-5 text-violet-400" />
        <h3 className="font-semibold text-white">Proposal pipeline</h3>
      </div>

      <div className={`${OPS_PANEL_INNER} p-4 mb-4 flex items-center justify-between`}>
        <div>
          <p className="text-xs text-slate-500 uppercase">Pending revenue</p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatMoney(pipeline.pendingRevenue)}
          </p>
        </div>
        <DollarSign className="h-8 w-8 text-emerald-500/40" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {rows.map((r) => (
          <div key={r.label} className={`${OPS_PANEL_INNER} p-2 text-center`}>
            <p className="text-lg font-bold text-white">{r.value}</p>
            <p className="text-[10px] text-slate-500 uppercase">{r.label}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/proposals')}
        className="text-sm text-cyan-400 hover:underline w-full text-left"
      >
        Open proposals →
      </button>
    </OpsCard>
  );
};

export default ProposalPipelineCard;
