import React from 'react';
import { REBAR_PRICING_2026 } from '../../data/rebarPricing2026';
import {
  REGIONAL_MULTIPLIER_LABELS,
  REGIONAL_MULTIPLIERS,
  type RegionalMultiplierKey,
} from '../../data/regionalMultipliers';

interface RebarPricingCatalogProps {
  activeRegionalKey?: RegionalMultiplierKey;
  className?: string;
}

const RebarPricingCatalog: React.FC<RebarPricingCatalogProps> = ({
  activeRegionalKey = 'continentalUS',
  className = '',
}) => {
  const mult = REGIONAL_MULTIPLIERS[activeRegionalKey];

  return (
    <div className={className}>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Rebar pricing ({REBAR_PRICING_2026.grade}, {REBAR_PRICING_2026.unit})
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Regional multiplier for this project:{' '}
        <strong>
          {REGIONAL_MULTIPLIER_LABELS[activeRegionalKey]} ×{mult}
        </strong>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3">Bar</th>
              <th className="py-2 pr-3">$/stick</th>
              <th className="py-2 pr-3">Adj. $/stick</th>
              <th className="py-2">Wt / 20 ft</th>
            </tr>
          </thead>
          <tbody>
            {REBAR_PRICING_2026.sizes.map((row) => (
              <tr
                key={row.bar}
                className="border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"
              >
                <td className="py-2 pr-3 font-medium">{row.bar}</td>
                <td className="py-2 pr-3">${row.estimatedCostEach.toFixed(2)}</td>
                <td className="py-2 pr-3">
                  ${(row.estimatedCostEach * mult).toFixed(2)}
                </td>
                <td className="py-2">{row.weightPer20Ft} lb</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RebarPricingCatalog;
