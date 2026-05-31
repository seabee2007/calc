import React from 'react';
import type { ProposalData } from '../../types/proposal';
import {
  computeProposalBreakdown,
  formatProposalTotal,
} from '../../utils/proposalPricing';
import type { CompanyTaxDefaults } from '../../types/pricingParams';
import StandardPricingBreakdown from '../pricing/StandardPricingBreakdown';

function ClientTotalRow({
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

export interface ProposalPricingSectionProps {
  data: ProposalData;
  audience?: 'client' | 'internal';
  title?: string;
  className?: string;
  companyTax?: CompanyTaxDefaults;
}

export default function ProposalPricingSection({
  data,
  audience = 'client',
  title = 'Pricing',
  className = '',
  companyTax,
}: ProposalPricingSectionProps) {
  const breakdown = computeProposalBreakdown(data, companyTax);

  if (audience === 'client') {
    return (
      <section className={className}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden px-4 bg-white/50 dark:bg-gray-900/30">
          <ClientTotalRow
            label="Total Proposal Price"
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
      <StandardPricingBreakdown breakdown={breakdown} />
    </section>
  );
}
