import React from 'react';
import type { LaborCostBreakdown } from '../../utils/placementProduction';

interface LaborCostBreakdownSummaryProps {
  breakdown: LaborCostBreakdown;
  formatCurrency: (n: number) => string;
  laborers: number;
  finishers: number;
}

const LaborCostBreakdownSummary: React.FC<LaborCostBreakdownSummaryProps> = ({
  breakdown,
  formatCurrency,
  laborers,
  finishers,
}) => (
  <>
    <p>
      Placing ({breakdown.placingManHours} man-hrs × ${breakdown.laborerRate.toFixed(0)}/hr):{' '}
      <strong>{formatCurrency(breakdown.placingCost)}</strong>
    </p>
    <p>
      Finishing ({breakdown.finishingManHours} man-hrs × ${breakdown.finisherRate.toFixed(0)}/hr):{' '}
      <strong>{formatCurrency(breakdown.finishingCost)}</strong>
    </p>
    <p>
      Mobilization ({breakdown.mobilizationManHours} man-hrs × ${breakdown.laborerRate.toFixed(0)}
      /hr): <strong>{formatCurrency(breakdown.mobilizationCost)}</strong>
    </p>
    {breakdown.foremanCost > 0 && (
      <p>
        Foreman (${breakdown.foremanRate.toFixed(0)}/hr on site):{' '}
        <strong>{formatCurrency(breakdown.foremanCost)}</strong>
      </p>
    )}
    <p className="text-gray-500 dark:text-gray-400 text-xs sm:col-span-2">
      Crew on pour: {laborers} laborer{laborers !== 1 ? 's' : ''}, {finishers} finisher
      {finishers !== 1 ? 's' : ''}
    </p>
  </>
);

export default LaborCostBreakdownSummary;
