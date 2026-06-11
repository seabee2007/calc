import React from 'react';
import { DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import { TEXT_SUCCESS } from '../../theme/appTheme';
import type { ProposalFinancialKpis } from '../../utils/proposalKpis';
import { formatProposalMoney, formatWinRate } from '../../utils/proposalKpis';

interface BusinessSnapshotCardProps {
  financial: ProposalFinancialKpis;
}

function SnapshotMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${OPS_PANEL_INNER} flex min-h-[72px] flex-col justify-center p-3`}>
      <p className={`text-[10px] uppercase ${OPS_SUBTLE}`}>{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${highlight ? TEXT_SUCCESS : OPS_TITLE}`}>
        {value}
      </p>
    </div>
  );
}

const BusinessSnapshotCard: React.FC<BusinessSnapshotCardProps> = ({ financial }) => {
  const navigate = useNavigate();
  const grossMarginPct =
    financial.acceptedRevenue > 0 && financial.grossProfit > 0
      ? `${((financial.grossProfit / financial.acceptedRevenue) * 100).toFixed(1)}% gross margin`
      : null;

  return (
    <OpsCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className={`h-5 w-5 ${TEXT_SUCCESS}`} />
          <h3 className={`font-semibold ${OPS_TITLE}`}>Business snapshot</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/financials')}
          className="text-sm text-cyan-700 hover:underline dark:text-cyan-400"
        >
          View financial details →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SnapshotMetric
          label="Pending revenue"
          value={formatProposalMoney(financial.pendingRevenue)}
          highlight
        />
        <SnapshotMetric
          label="Accepted revenue"
          value={formatProposalMoney(financial.acceptedRevenue)}
        />
        <SnapshotMetric
          label="Weighted forecast"
          value={formatProposalMoney(financial.weightedForecast)}
        />
        <SnapshotMetric
          label="Gross profit"
          value={formatProposalMoney(financial.grossProfit)}
          highlight={financial.grossProfit >= 0}
        />
      </div>

      {(grossMarginPct || financial.winRate > 0) && (
        <p className={`mt-3 text-xs ${OPS_SUBTLE}`}>
          {[grossMarginPct, financial.winRate > 0 ? `${formatWinRate(financial.winRate)} win rate` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </OpsCard>
  );
};

export default BusinessSnapshotCard;
