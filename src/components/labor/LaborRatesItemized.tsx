import React from 'react';
import { LABOR_RATES_2026, type LaborTradeRate } from '../../data/nationalLaborRates2026';

const TRADE_ORDER: (keyof typeof LABOR_RATES_2026.laborRates)[] = [
  'concreteLaborer',
  'concreteFinisher',
  'foreman',
];

function TradeRateRow({ rate }: { rate: LaborTradeRate }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/80 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{rate.trade}</h4>
        {rate.nationalAverage2026 && (
          <span className="text-xs text-cyan-700 dark:text-cyan-400">2026 national avg.</span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        Base{' '}
        <strong>${rate.hourlyRateBase.toFixed(2)}</strong>/hr · Burdened{' '}
        <strong>${rate.hourlyRateWithBurden.toFixed(2)}</strong>/hr · OT ×
        {rate.overtimeMultiplier}
      </p>
      {rate.includes && rate.includes.length > 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-white">
          Burden includes: {rate.includes.join(', ')}
        </p>
      )}
    </div>
  );
}

interface LaborRatesItemizedProps {
  className?: string;
  compact?: boolean;
}

const LaborRatesItemized: React.FC<LaborRatesItemizedProps> = ({ className = '', compact }) => {
  const { laborRates } = LABOR_RATES_2026;

  return (
    <div className={className}>
      <h3
        className={
          compact
            ? 'text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
            : 'text-base font-semibold text-slate-800 dark:text-slate-200 mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
        }
      >
        Labor rates (itemized)
      </h3>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {TRADE_ORDER.map((key) => (
          <TradeRateRow key={key} rate={laborRates[key]} />
        ))}
      </div>
    </div>
  );
};

export default LaborRatesItemized;
