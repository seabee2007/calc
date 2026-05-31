import React from 'react';
import type { ChangeOrderPricingBreakdown } from '../../utils/changeOrderFinancials';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        'flex justify-between gap-4 text-sm tabular-nums',
        bold ? 'font-semibold text-gray-900 dark:text-white' : '',
        muted ? 'text-gray-600 dark:text-slate-400' : 'text-gray-800 dark:text-slate-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}

export default function StandardPricingBreakdown({
  breakdown: b,
}: {
  breakdown: ChangeOrderPricingBreakdown;
}) {
  if (b.pricingModel === 'legacy') {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-800/50">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Cost breakdown (legacy)
        </p>
        <div className="space-y-1">
          <Row label="Labor cost" value={formatChangeOrderMoney(b.laborTotal)} />
          <Row label="Material cost" value={formatChangeOrderMoney(b.materialTotal)} />
          <Row label="Equipment cost" value={formatChangeOrderMoney(b.equipmentTotal)} />
          {b.subcontractorTotal > 0 && (
            <Row
              label="Subcontractors"
              value={formatChangeOrderMoney(b.subcontractorTotal)}
            />
          )}
          <Row label="Direct cost" value={formatChangeOrderMoney(b.directCost)} bold />
          <Row label="Fees" value={formatChangeOrderMoney(b.feesAmount)} muted />
          <Row label="Permits" value={formatChangeOrderMoney(b.permitsAmount)} muted />
          <Row
            label={`Overhead (${b.overheadPercent}%)`}
            value={formatChangeOrderMoney(b.overheadAmount)}
            muted
          />
          <Row
            label={`Profit (${b.profitPercent}%)`}
            value={formatChangeOrderMoney(b.profitAmount)}
            muted
          />
          {b.markupPercent > 0 && (
            <Row
              label={`Markup on materials (${b.markupPercent}%)`}
              value={formatChangeOrderMoney(b.markupAmount)}
              muted
            />
          )}
          <Row label="Total price" value={formatChangeOrderMoney(b.totalPrice)} bold />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-800/50">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Internal cost breakdown
        </p>
        <div className="space-y-1">
          <Row label="Materials (base)" value={formatChangeOrderMoney(b.materialCostBase)} />
          <Row label="Waste factor" value={`${b.wasteFactorPercent}%`} muted />
          <Row label="Waste cost" value={formatChangeOrderMoney(b.wasteCost)} muted />
          <Row
            label="Materials (adjusted)"
            value={formatChangeOrderMoney(b.materialCostAdjusted)}
          />
          <Row label="Labor" value={formatChangeOrderMoney(b.laborTotal)} />
          <Row label="Equipment" value={formatChangeOrderMoney(b.equipmentTotal)} />
          {b.subcontractorTotal > 0 && (
            <Row label="Subcontractors" value={formatChangeOrderMoney(b.subcontractorTotal)} />
          )}
          <Row label="Fees" value={formatChangeOrderMoney(b.feesAmount)} muted />
          <Row label="Permits" value={formatChangeOrderMoney(b.permitsAmount)} muted />
          <Row label="Direct cost" value={formatChangeOrderMoney(b.directCost)} bold />
          <Row
            label={`Contingency (${b.contingencyPercent}%)`}
            value={formatChangeOrderMoney(b.contingencyCost)}
            muted
          />
          {b.taxCost > 0 && (
            <Row
              label={`Tax (${b.taxRatePercent}%)`}
              value={formatChangeOrderMoney(b.taxCost)}
              muted
            />
          )}
          <Row
            label={`Overhead (${b.overheadPercent}%)`}
            value={formatChangeOrderMoney(b.overheadAmount)}
            muted
          />
          <Row
            label="Total estimated cost"
            value={formatChangeOrderMoney(b.totalEstimatedCost)}
            bold
          />
        </div>
      </div>

      <div className="rounded-lg border border-cyan-200/60 bg-cyan-50/40 p-4 text-sm dark:border-cyan-800/50 dark:bg-cyan-950/20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
          Pricing breakdown
        </p>
        <div className="space-y-1">
          <Row label="Target margin %" value={`${b.targetMarginPercent}%`} />
          <Row label="Gross profit" value={formatChangeOrderMoney(b.grossProfit)} />
          <Row label="Gross margin %" value={`${b.grossMarginPercent}%`} />
          <Row label="Markup %" value={`${b.markupPercentReporting}%`} />
          <Row label="Proposal price" value={formatChangeOrderMoney(b.totalPrice)} bold />
        </div>
      </div>
    </div>
  );
}
