import React from 'react';
import type { ChangeOrderPricingBreakdown } from '../../utils/changeOrderFinancials';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { TEXT_ACCENT, TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';

const PANEL_CLASS =
  'rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-sm dark:border-slate-700/70 dark:bg-slate-950/50';
const SECTION_LABEL = `mb-3 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`;
const PRICING_PANEL_CLASS =
  'rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm shadow-md dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:shadow-lg dark:shadow-cyan-950/20';
const PRICING_SECTION_LABEL = `mb-3 text-xs font-semibold uppercase tracking-wide ${TEXT_ACCENT}`;
const FINAL_TOTAL_CARD =
  'mt-4 rounded-2xl border border-cyan-500/30 bg-slate-900 p-4 dark:border-cyan-400/40 dark:bg-slate-950/70';

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
        'flex justify-between gap-4 rounded-lg px-3 py-2 text-sm tabular-nums',
        bold ? 'bg-slate-900 font-semibold text-white' : '',
        !bold && muted ? TEXT_MUTED : '',
        !bold && !muted ? `${TEXT_FOREGROUND}` : '',
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
      <div className={PANEL_CLASS}>
        <p className={SECTION_LABEL}>Cost breakdown (legacy)</p>
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
      <div className={PANEL_CLASS}>
        <p className={SECTION_LABEL}>Internal cost breakdown</p>
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
          {(b.importedIndirectCost ?? 0) > 0 && (
            <Row
              label="Indirect costs"
              value={formatChangeOrderMoney(b.importedIndirectCost ?? 0)}
              muted
            />
          )}
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

      <div className={PRICING_PANEL_CLASS}>
        <p className={PRICING_SECTION_LABEL}>Pricing breakdown</p>
        <div className="space-y-1">
          <Row label="Target margin %" value={`${b.targetMarginPercent}%`} />
          <Row label="Gross profit" value={formatChangeOrderMoney(b.grossProfit)} />
          <Row label="Gross margin %" value={`${b.grossMarginPercent}%`} />
          <Row label="Markup %" value={`${b.markupPercentReporting}%`} />
          <div className={FINAL_TOTAL_CARD}>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
              Final proposal total
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight text-white">
              {formatChangeOrderMoney(b.totalPrice)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
