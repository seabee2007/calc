import React from 'react';
import { DollarSign, TrendingUp, Percent, Hammer, Package } from 'lucide-react';
import OpsCard from './OpsCard';
import { OPS_MUTED, OPS_PANEL_INNER, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import { TEXT_ACCENT, TEXT_SUCCESS, TEXT_WARNING } from '../../theme/appTheme';
import type { ProposalFinancialKpis } from '../../utils/proposalKpis';
import { formatProposalMoney, formatWinRate } from '../../utils/proposalKpis';

interface FinancialSnapshotCardProps {
  financial: ProposalFinancialKpis;
}

const FinancialSnapshotCard: React.FC<FinancialSnapshotCardProps> = ({
  financial,
}) => (
  <OpsCard>
    <div className="flex items-center gap-2 mb-4">
      <DollarSign className={`h-5 w-5 ${TEXT_SUCCESS}`} />
      <h3 className={`font-semibold ${OPS_TITLE}`}>Financial snapshot</h3>
    </div>

    <div className="grid grid-cols-2 gap-2 mb-3">
      <Metric
        label="Pending revenue"
        value={formatProposalMoney(financial.pendingRevenue)}
        highlight
      />
      <Metric
        label="Accepted revenue"
        value={formatProposalMoney(financial.acceptedRevenue)}
      />
      <Metric
        label="Monthly revenue"
        value={formatProposalMoney(financial.monthlyRevenue)}
        icon={<TrendingUp className={`h-3 w-3 ${TEXT_ACCENT}`} />}
      />
      <Metric
        label="Avg job size"
        value={formatProposalMoney(financial.averageJobSize)}
      />
      <Metric
        label="Win rate"
        value={formatWinRate(financial.winRate)}
        icon={<Percent className={`h-3 w-3 ${TEXT_WARNING}`} />}
      />
      <Metric
        label="Gross profit"
        value={formatProposalMoney(financial.grossProfit)}
        highlight={financial.grossProfit >= 0}
      />
      {financial.acceptedRevenue > 0 && financial.grossProfit > 0 && (
        <Metric
          label="Gross margin"
          value={`${((financial.grossProfit / financial.acceptedRevenue) * 100).toFixed(1)}%`}
          icon={<Percent className={`h-3 w-3 ${TEXT_SUCCESS}`} />}
        />
      )}
      {financial.currentContractValue > 0 && (
        <Metric
          label="Contract value"
          value={formatProposalMoney(financial.currentContractValue)}
        />
      )}
      {financial.changeOrderPendingRevenue > 0 && (
        <Metric
          label="COs awaiting client"
          value={formatProposalMoney(financial.changeOrderPendingRevenue)}
          highlight
        />
      )}
      {financial.changeOrderAcceptedRevenue > 0 && (
        <Metric
          label="Accepted CO revenue"
          value={formatProposalMoney(financial.changeOrderAcceptedRevenue)}
        />
      )}
      {financial.approvedChangeOrderTotal > 0 && (
        <Metric
          label="Contract CO total"
          value={formatProposalMoney(financial.approvedChangeOrderTotal)}
        />
      )}
      {financial.changeOrderWeightedForecast > 0 && (
        <Metric
          label="CO forecast"
          value={formatProposalMoney(financial.changeOrderWeightedForecast)}
          icon={<TrendingUp className={`h-3 w-3 ${TEXT_WARNING}`} />}
        />
      )}
    </div>

    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
      <div className={`${OPS_PANEL_INNER} p-2`}>
        <p className={`text-[10px] uppercase flex items-center gap-1 ${OPS_SUBTLE}`}>
          <Hammer className="h-3 w-3" /> Labor cost
        </p>
        <p className={`text-sm font-semibold ${OPS_TITLE}`}>
          {formatProposalMoney(financial.laborCostTotal)}
        </p>
      </div>
      <div className={`${OPS_PANEL_INNER} p-2`}>
        <p className={`text-[10px] uppercase flex items-center gap-1 ${OPS_SUBTLE}`}>
          <Package className="h-3 w-3" /> Material cost
        </p>
        <p className={`text-sm font-semibold ${OPS_TITLE}`}>
          {formatProposalMoney(financial.materialCostTotal)}
        </p>
      </div>
    </div>
  </OpsCard>
);

function Metric({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`${OPS_PANEL_INNER} p-2`}>
      <p className={`text-[10px] uppercase flex items-center gap-1 ${OPS_SUBTLE}`}>
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-bold ${
          highlight ? TEXT_SUCCESS : OPS_TITLE
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default FinancialSnapshotCard;
