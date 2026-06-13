import React from 'react';
import { DollarSign, Hammer, Package, Percent, TrendingUp, Wrench } from 'lucide-react';
import {
  PREMIUM_INNER_PANEL,
  PREMIUM_KPI_CARD,
  TEXT_ACCENT,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUCCESS,
  TEXT_WARNING,
} from '../../theme/appTheme';
import type { ProposalFinancialKpis } from '../../utils/proposalKpis';
import { formatProposalMoney, formatWinRate } from '../../utils/proposalKpis';

interface FinancialDetailsPanelProps {
  financial: ProposalFinancialKpis;
}

function DetailMetric({
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
    <div className={`${PREMIUM_KPI_CARD} flex min-h-[88px] flex-col justify-center p-4`}>
      <p
        className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}
      >
        {icon}
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${
          highlight ? TEXT_SUCCESS : TEXT_FOREGROUND
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const FinancialDetailsPanel: React.FC<FinancialDetailsPanelProps> = ({ financial }) => (
  <div>
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 dark:border-cyan-400/30 dark:bg-cyan-500/10">
        <DollarSign className={`h-5 w-5 ${TEXT_ACCENT}`} aria-hidden />
      </div>
      <div>
        <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>Revenue &amp; costs</h2>
        <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
          Pipeline revenue, forecast, and direct cost totals from accepted proposals.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <DetailMetric
        label="Pending revenue"
        value={formatProposalMoney(financial.pendingRevenue)}
        highlight
      />
      <DetailMetric
        label="Accepted revenue"
        value={formatProposalMoney(financial.acceptedRevenue)}
      />
      <DetailMetric
        label="Monthly revenue"
        value={formatProposalMoney(financial.monthlyRevenue)}
        icon={<TrendingUp className={`h-3.5 w-3.5 ${TEXT_ACCENT}`} aria-hidden />}
      />
      <DetailMetric
        label="Avg job size"
        value={formatProposalMoney(financial.averageJobSize)}
      />
      <DetailMetric
        label="Win rate"
        value={formatWinRate(financial.winRate)}
        icon={<Percent className={`h-3.5 w-3.5 ${TEXT_WARNING}`} aria-hidden />}
      />
      <DetailMetric
        label="Gross profit"
        value={formatProposalMoney(financial.grossProfit)}
        highlight={financial.grossProfit >= 0}
      />
      {financial.acceptedRevenue > 0 && financial.grossProfit > 0 ? (
        <DetailMetric
          label="Gross margin"
          value={`${((financial.grossProfit / financial.acceptedRevenue) * 100).toFixed(1)}%`}
          icon={<Percent className={`h-3.5 w-3.5 ${TEXT_SUCCESS}`} aria-hidden />}
        />
      ) : null}
      <DetailMetric
        label="Weighted forecast"
        value={formatProposalMoney(financial.weightedForecast)}
        icon={<TrendingUp className={`h-3.5 w-3.5 ${TEXT_ACCENT}`} aria-hidden />}
      />
      {financial.currentContractValue > 0 ? (
        <DetailMetric
          label="Contract value"
          value={formatProposalMoney(financial.currentContractValue)}
        />
      ) : null}
      {financial.changeOrderPendingRevenue > 0 ? (
        <DetailMetric
          label="COs awaiting client"
          value={formatProposalMoney(financial.changeOrderPendingRevenue)}
          highlight
        />
      ) : null}
      {financial.changeOrderAcceptedRevenue > 0 ? (
        <DetailMetric
          label="Accepted CO revenue"
          value={formatProposalMoney(financial.changeOrderAcceptedRevenue)}
        />
      ) : null}
      {financial.approvedChangeOrderTotal > 0 ? (
        <DetailMetric
          label="Contract CO total"
          value={formatProposalMoney(financial.approvedChangeOrderTotal)}
        />
      ) : null}
      {financial.changeOrderWeightedForecast > 0 ? (
        <DetailMetric
          label="CO forecast"
          value={formatProposalMoney(financial.changeOrderWeightedForecast)}
          icon={<TrendingUp className={`h-3.5 w-3.5 ${TEXT_WARNING}`} aria-hidden />}
        />
      ) : null}
    </div>

    <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h3 className={`mb-4 text-sm font-semibold uppercase tracking-wide ${TEXT_ACCENT}`}>
        Direct costs
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`${PREMIUM_INNER_PANEL} p-4`}>
          <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}>
            <Hammer className="h-3.5 w-3.5" aria-hidden />
            Labor cost
          </p>
          <p className={`mt-2 text-xl font-bold tabular-nums ${TEXT_FOREGROUND}`}>
            {formatProposalMoney(financial.laborCostTotal)}
          </p>
        </div>
        <div className={`${PREMIUM_INNER_PANEL} p-4`}>
          <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}>
            <Package className="h-3.5 w-3.5" aria-hidden />
            Material cost
          </p>
          <p className={`mt-2 text-xl font-bold tabular-nums ${TEXT_FOREGROUND}`}>
            {formatProposalMoney(financial.materialCostTotal)}
          </p>
        </div>
        <div className={`${PREMIUM_INNER_PANEL} p-4`}>
          <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}>
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            Equipment cost
          </p>
          <p className={`mt-2 text-xl font-bold tabular-nums ${TEXT_FOREGROUND}`}>
            {formatProposalMoney(financial.equipmentCostTotal)}
          </p>
        </div>
        {financial.totalEstimatedCost > 0 ? (
          <div className={`${PREMIUM_INNER_PANEL} p-4 sm:col-span-2 lg:col-span-3`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}>
              Total estimated cost
            </p>
            <p className={`mt-2 text-xl font-bold tabular-nums ${TEXT_FOREGROUND}`}>
              {formatProposalMoney(financial.totalEstimatedCost)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

export default FinancialDetailsPanel;
