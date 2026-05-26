import React from 'react';
import type { ReinforcementPricing } from '../../types/reinforcementPricing';

interface RebarCostEstimateSummaryProps {
  pricing: ReinforcementPricing;
  formatCurrency?: (n: number) => string;
}

const defaultFormat = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const RebarCostEstimateSummary: React.FC<RebarCostEstimateSummaryProps> = ({
  pricing,
  formatCurrency = defaultFormat,
}) => (
  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm">
    <p className="font-medium text-gray-900 dark:text-white">Material estimate (saved to project)</p>
    <p className="text-gray-700 dark:text-gray-300">
      {pricing.barSize} · {pricing.sticksRequired} × {pricing.unit ?? '20ft stick'} @{' '}
      {formatCurrency(pricing.costPerStick ?? 0)}/stick
    </p>
    {pricing.subtotalBeforeRegional != null && pricing.regionalMultiplier != null && (
      <p className="text-gray-600 dark:text-gray-400">
        Subtotal {formatCurrency(pricing.subtotalBeforeRegional)} × {pricing.regionalMultiplier}{' '}
        ({pricing.regionalLabel})
      </p>
    )}
    <p className="text-base font-semibold text-green-700 dark:text-green-400">
      Total: {formatCurrency(pricing.estimatedCost)}
    </p>
  </div>
);

export default RebarCostEstimateSummary;
