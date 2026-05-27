import React from 'react';
import { DollarSign, TrendingUp, Percent, Hammer, Package } from 'lucide-react';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
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
      <DollarSign className="h-5 w-5 text-emerald-400" />
      <h3 className="font-semibold text-white">Financial snapshot</h3>
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
        icon={<TrendingUp className="h-3 w-3 text-cyan-400" />}
      />
      <Metric
        label="Avg job size"
        value={formatProposalMoney(financial.averageJobSize)}
      />
      <Metric
        label="Win rate"
        value={formatWinRate(financial.winRate)}
        icon={<Percent className="h-3 w-3 text-amber-400" />}
      />
      <Metric
        label="Gross profit"
        value={formatProposalMoney(financial.grossProfit)}
        highlight={financial.grossProfit >= 0}
      />
    </div>

    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
      <div className={`${OPS_PANEL_INNER} p-2`}>
        <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
          <Hammer className="h-3 w-3" /> Labor cost
        </p>
        <p className="text-sm font-semibold text-slate-200">
          {formatProposalMoney(financial.laborCostTotal)}
        </p>
      </div>
      <div className={`${OPS_PANEL_INNER} p-2`}>
        <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
          <Package className="h-3 w-3" /> Material cost
        </p>
        <p className="text-sm font-semibold text-slate-200">
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
      <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-bold ${
          highlight ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default FinancialSnapshotCard;
