import React from 'react';
import type { ChangeOrder } from '../../types/changeOrder';
import {
  computeChangeOrderBreakdown,
  formatChangeOrderMoney,
} from '../../utils/changeOrderFinancials';

function SummaryRow({
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

export default function ChangeOrderInternalPricingSummary({ order }: { order: ChangeOrder }) {
  const b = computeChangeOrderBreakdown(
    order.laborItems,
    order.materialItems,
    order.equipmentItems,
    {
      feesAmount: order.feesAmount,
      permitsAmount: order.permitsAmount,
      overheadPercent: order.overheadPercent,
      profitPercent: order.profitPercent,
      markupPercent: order.markupPercent,
    },
  );

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 font-mono text-sm dark:border-slate-600 dark:bg-slate-800/50">
      <p className="mb-3 text-xs font-sans font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        Cost breakdown (internal)
      </p>
      <div className="space-y-1">
        <SummaryRow label="Labor cost" value={formatChangeOrderMoney(b.laborTotal)} />
        <SummaryRow label="Material cost" value={formatChangeOrderMoney(b.materialTotal)} />
        <SummaryRow label="Equipment cost" value={formatChangeOrderMoney(b.equipmentTotal)} />
        <SummaryRow label="Direct cost" value={formatChangeOrderMoney(b.directCost)} bold />
        <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
        <SummaryRow label="Fees" value={formatChangeOrderMoney(b.feesAmount)} muted />
        <SummaryRow label="Permits" value={formatChangeOrderMoney(b.permitsAmount)} muted />
        <SummaryRow
          label={`Overhead (${b.overheadPercent}%)`}
          value={formatChangeOrderMoney(b.overheadAmount)}
          muted
        />
        <SummaryRow
          label={`Profit (${b.profitPercent}%)`}
          value={formatChangeOrderMoney(b.profitAmount)}
          muted
        />
        {b.markupPercent > 0 && (
          <SummaryRow
            label={`Markup on materials (${b.markupPercent}%)`}
            value={formatChangeOrderMoney(b.markupAmount)}
            muted
          />
        )}
        <SummaryRow label="Indirect costs" value={formatChangeOrderMoney(b.indirectCost)} bold />
        <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
        <SummaryRow label="Total price" value={formatChangeOrderMoney(b.totalPrice)} bold />
      </div>
    </div>
  );
}
