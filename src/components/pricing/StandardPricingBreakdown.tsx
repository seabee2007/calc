import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ChangeOrderPricingBreakdown } from '../../utils/changeOrderFinancials';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { FOCUS_RING, TEXT_ACCENT, TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';

const PANEL_CLASS =
  'rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-sm dark:border-slate-700/70 dark:bg-slate-950/50';
const PRICING_PANEL_CLASS =
  'rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm shadow-md dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:shadow-lg dark:shadow-cyan-950/20';
const PRICING_SECTION_LABEL = `mb-3 text-xs font-semibold uppercase tracking-wide ${TEXT_ACCENT}`;
const FINAL_TOTAL_CARD =
  'mt-4 rounded-2xl border border-cyan-500/30 bg-slate-900 p-4 dark:border-cyan-400/40 dark:bg-slate-950/70';
const INTERNAL_COST_HEADER =
  'flex w-full items-center justify-between gap-3 rounded-lg text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/40';

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

function InternalCostBreakdownPanel({ breakdown: b }: { breakdown: ChangeOrderPricingBreakdown }) {
  const [expanded, setExpanded] = useState(false);
  const totalEstimatedCost = formatChangeOrderMoney(b.totalEstimatedCost);

  return (
    <div className={PANEL_CLASS}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="internal-cost-breakdown-panel"
        onClick={() => setExpanded((open) => !open)}
        className={`${INTERNAL_COST_HEADER} ${FOCUS_RING}`}
        data-testid="internal-cost-breakdown-toggle"
      >
        <span className={`text-xs font-semibold uppercase tracking-wide ${TEXT_FOREGROUND}`}>
          Internal Cost Breakdown
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className={`text-right text-xs ${TEXT_MUTED}`}>
            Total estimated cost{' '}
            <span className={`font-semibold tabular-nums ${TEXT_FOREGROUND}`}>
              {totalEstimatedCost}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id="internal-cost-breakdown-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1 border-t border-slate-200/80 pt-3 dark:border-slate-700/70">
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
                value={totalEstimatedCost}
                bold
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
        <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}>
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
      <InternalCostBreakdownPanel breakdown={b} />

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
