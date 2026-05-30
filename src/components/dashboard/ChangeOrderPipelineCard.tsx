import React from 'react';
import { FilePen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import {
  CHANGE_ORDER_PIPELINE_STATUSES,
  CHANGE_ORDER_STATUS_LABELS,
  type ChangeOrderPipelineCounts,
  type ChangeOrderPipelineRevenue,
  type ChangeOrderPipelineStatus,
} from '../../utils/changeOrderKpis';
import { formatProposalMoney } from '../../utils/proposalKpis';
import { plannerAllChangeOrdersHref } from '../../utils/plannerRoutes';

interface ChangeOrderPipelineCardProps {
  pipeline: ChangeOrderPipelineCounts;
  pendingRevenue: number;
  weightedForecast: number;
  pipelineRevenue: ChangeOrderPipelineRevenue;
}

const ChangeOrderPipelineCard: React.FC<ChangeOrderPipelineCardProps> = ({
  pipeline,
  pendingRevenue,
  weightedForecast,
  pipelineRevenue,
}) => {
  const navigate = useNavigate();
  const totalCount = CHANGE_ORDER_PIPELINE_STATUSES.reduce((s, st) => s + pipeline[st], 0);

  if (totalCount === 0) return null;

  return (
    <OpsCard className="rounded-2x1 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <FilePen className="h-5 w-5 text-amber-400" />
        <h3 className={`font-semibold ${OPS_TITLE}`}>Change order pipeline</h3>
      </div>

      <div className={`${OPS_PANEL_INNER} p-3 mb-4 grid grid-cols-2 gap-3`}>
        <div>
          <p className={`text-xs uppercase ${OPS_SUBTLE}`}>Awaiting client</p>
          <p className="text-lg font-bold text-emerald-400">
            {formatProposalMoney(pendingRevenue)}
          </p>
          <p className={`text-[10px] mt-0.5 ${OPS_SUBTLE}`}>Sent · viewed</p>
        </div>
        <div>
          <p className={`text-xs uppercase ${OPS_SUBTLE}`}>Weighted forecast</p>
          <p className="text-lg font-bold text-cyan-400">
            {formatProposalMoney(weightedForecast)}
          </p>
          <p className={`text-[10px] mt-0.5 ${OPS_SUBTLE}`}>By CO stage</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {CHANGE_ORDER_PIPELINE_STATUSES.map((status: ChangeOrderPipelineStatus) => (
          <div key={status} className={`${OPS_PANEL_INNER} p-2 text-center`}>
            <p className={`text-lg font-bold ${OPS_TITLE}`}>{pipeline[status]}</p>
            {pipelineRevenue[status] > 0 && (
              <p className="text-[10px] font-semibold text-emerald-400/90 tabular-nums">
                {formatProposalMoney(pipelineRevenue[status])}
              </p>
            )}
            <p className={`text-[10px] uppercase leading-tight ${OPS_SUBTLE}`}>
              {CHANGE_ORDER_STATUS_LABELS[status]}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate(plannerAllChangeOrdersHref())}
        className="text-sm text-cyan-700 dark:text-cyan-400 hover:underline w-full text-left"
      >
        View all change orders →
      </button>
    </OpsCard>
  );
};

export default ChangeOrderPipelineCard;
