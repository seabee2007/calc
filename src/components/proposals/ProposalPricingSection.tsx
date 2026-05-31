import React from 'react';
import type { ProposalData } from '../../types/proposal';
import {
  computeProposalBreakdown,
  formatProposalTotal,
} from '../../utils/proposalPricing';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';

function ClientRow({
  label,
  value,
  grand,
}: {
  label: string;
  value: string;
  grand?: boolean;
}) {
  return (
    <div
      className={[
        'flex justify-between gap-4 border-b border-gray-100 py-3 dark:border-gray-700',
        grand
          ? 'border-t-2 border-gray-300 pt-4 mt-2 font-bold text-lg dark:border-gray-500'
          : 'text-sm',
      ].join(' ')}
    >
      <span
        className={
          grand
            ? 'text-gray-900 dark:text-white'
            : 'font-medium text-gray-700 dark:text-gray-300'
        }
      >
        {label}
      </span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function InternalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={[
        'flex justify-between gap-4 text-sm',
        bold ? 'font-bold text-base text-gray-900 dark:text-white pt-1' : '',
      ].join(' ')}
    >
      <span className={bold ? '' : 'text-gray-600 dark:text-gray-400'}>{label}</span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export interface ProposalPricingSectionProps {
  data: ProposalData;
  audience?: 'client' | 'internal';
  /** Optional section title override */
  title?: string;
  className?: string;
}

export default function ProposalPricingSection({
  data,
  audience = 'client',
  title = 'Pricing',
  className = '',
}: ProposalPricingSectionProps) {
  const breakdown = computeProposalBreakdown(data);

  if (audience === 'client') {
    return (
      <section className={className}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden px-4 bg-white/50 dark:bg-gray-900/30">
          <ClientRow
            label="Total Direct Costs"
            value={formatChangeOrderMoney(breakdown.directCost)}
          />
          <ClientRow
            label="Total Indirect costs"
            value={formatChangeOrderMoney(breakdown.indirectCost)}
          />
          <ClientRow
            label="Total Proposal"
            value={formatProposalTotal(data)}
            grand
          />
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-800/50">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
          Cost breakdown (internal)
        </p>
        <div className="space-y-1">
          <InternalRow label="Labor cost" value={formatChangeOrderMoney(breakdown.laborTotal)} />
          <InternalRow
            label="Material cost"
            value={formatChangeOrderMoney(breakdown.materialTotal)}
          />
          <InternalRow
            label="Equipment cost"
            value={formatChangeOrderMoney(breakdown.equipmentTotal)}
          />
          <InternalRow
            label="Direct cost"
            value={formatChangeOrderMoney(breakdown.directCost)}
            bold
          />
          <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
          <InternalRow label="Fees" value={formatChangeOrderMoney(breakdown.feesAmount)} />
          <InternalRow label="Permits" value={formatChangeOrderMoney(breakdown.permitsAmount)} />
          <InternalRow
            label={`Overhead (${breakdown.overheadPercent}%)`}
            value={formatChangeOrderMoney(breakdown.overheadAmount)}
          />
          <InternalRow
            label={`Profit (${breakdown.profitPercent}%)`}
            value={formatChangeOrderMoney(breakdown.profitAmount)}
          />
          {breakdown.markupPercent > 0 && (
            <InternalRow
              label={`Markup on materials (${breakdown.markupPercent}%)`}
              value={formatChangeOrderMoney(breakdown.markupAmount)}
            />
          )}
          <InternalRow
            label="Indirect costs"
            value={formatChangeOrderMoney(breakdown.indirectCost)}
            bold
          />
          <InternalRow
            label="Total proposal price"
            value={formatProposalTotal(data)}
            bold
          />
        </div>
      </div>
    </section>
  );
}
