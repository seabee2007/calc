import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProfessionalConcreteLaborResult } from '../../types/concreteLaborEstimate';
import type { ConcreteLaborEstimateInput } from '../../types/concreteLaborEstimate';

const TASK_LABELS: { key: keyof ProfessionalConcreteLaborResult['taskHours']; label: string; pourDay?: boolean }[] = [
  { key: 'mobilization', label: 'Mobilization / setup', pourDay: true },
  { key: 'subgradePrep', label: 'Subgrade prep check (prior day)' },
  { key: 'formworkEdgePrep', label: 'Formwork / edge prep (prior day)' },
  { key: 'vaporBarrier', label: 'Vapor barrier / base prep' },
  { key: 'reinforcement', label: 'Reinforcement install (prior day)' },
  { key: 'placement', label: 'Concrete placement', pourDay: true },
  { key: 'screeding', label: 'Screeding', pourDay: true },
  { key: 'bullFloating', label: 'Bull floating', pourDay: true },
  { key: 'edgingJointing', label: 'Edging / jointing', pourDay: true },
  { key: 'finishing', label: 'Finishing', pourDay: true },
  { key: 'curing', label: 'Curing / protection', pourDay: true },
  { key: 'cleanup', label: 'Cleanup / demobilization', pourDay: true },
];

const PLACEMENT_LABELS: Record<string, string> = {
  chute: 'Chute',
  pump: 'Pump',
  buggy: 'Buggy',
  wheelbarrow: 'Wheelbarrow',
};

const FINISH_LABELS: Record<string, string> = {
  broom: 'Broom',
  hard_trowel: 'Hard trowel',
  burnished: 'Burnished',
  stamp: 'Stamp',
  exposed_aggregate: 'Exposed aggregate',
};

const ACCESS_LABELS: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  severe: 'Severe',
};

const WEATHER_LABELS: Record<string, string> = {
  normal: 'Normal',
  hot: 'Hot',
  extreme_hot: 'Extreme hot',
  rainy: 'Rainy',
  windy: 'Windy',
};

const REINFORCEMENT_LABELS: Record<string, string> = {
  none: 'None',
  wire_mesh: 'Wire mesh',
  rebar_single_mat: 'Rebar — single mat',
  rebar_double_mat: 'Rebar — double mat',
};

interface LaborTaskBreakdownProps {
  input: ConcreteLaborEstimateInput;
  result: ProfessionalConcreteLaborResult;
  formatCurrency: (n: number) => string;
  areaReconciledFromVolume?: boolean;
  /** Project card: task list + costs collapse behind the section header */
  detailsCollapsible?: boolean;
  defaultDetailsExpanded?: boolean;
}

const LaborTaskBreakdown: React.FC<LaborTaskBreakdownProps> = ({
  input,
  result,
  formatCurrency,
  areaReconciledFromVolume,
  detailsCollapsible = false,
  defaultDetailsExpanded = false,
}) => {
  const { costs, taskHours } = result;
  const [detailsExpanded, setDetailsExpanded] = useState(defaultDetailsExpanded);

  const summaryGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        <p>
          Concrete quantity:{' '}
          <strong className="text-gray-900 dark:text-white">
            {input.concreteYards.toFixed(1)} CY
          </strong>
        </p>
        <p>
          Area:{' '}
          <strong className="text-gray-900 dark:text-white">
            {input.areaSqFt > 0
              ? `${Math.round(input.areaSqFt).toLocaleString()} SF`
              : '—'}
          </strong>
          {input.thicknessInches > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              {' '}
              · {input.thicknessInches.toFixed(1)} in thick
            </span>
          )}
        </p>
        {areaReconciledFromVolume && (
          <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-300">
            Area adjusted from placement volume and thickness — footprint did not match
            volume (would imply ~
            {result.impliedThicknessInches != null
              ? `${result.impliedThicknessInches.toFixed(1)} in`
              : 'incorrect'}{' '}
            if footprint were used).
          </p>
        )}
        <p>
          Crew:{' '}
          <strong className="text-gray-900 dark:text-white">
            {input.crew.laborers} laborer{input.crew.laborers !== 1 ? 's' : ''},{' '}
            {input.crew.finishers} finisher{input.crew.finishers !== 1 ? 's' : ''},{' '}
            {input.crew.foremen} foreman{input.crew.foremen !== 1 ? 's' : ''}
          </strong>
        </p>
        <p>
          Placement:{' '}
          <strong className="text-gray-900 dark:text-white">
            {PLACEMENT_LABELS[input.placementMethod] ?? input.placementMethod}
          </strong>
        </p>
        <p>
          Finish:{' '}
          <strong className="text-gray-900 dark:text-white">
            {FINISH_LABELS[input.finishType] ?? input.finishType}
          </strong>
        </p>
        <p>
          Access:{' '}
          <strong className="text-gray-900 dark:text-white">
            {ACCESS_LABELS[input.accessDifficulty]}
          </strong>
        </p>
        <p>
          Weather:{' '}
          <strong className="text-gray-900 dark:text-white">
            {WEATHER_LABELS[input.weatherCondition]}
          </strong>
        </p>
        <p>
          Reinforcement:{' '}
          <strong className="text-gray-900 dark:text-white">
            {REINFORCEMENT_LABELS[input.reinforcementType]}
          </strong>
        </p>
      </div>
  );

  const detailsBody = (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Placement-day duration uses parallel work — placement and finishing overlap; prior-day prep
        lines are shown for scope but not added to on-site clock.
      </p>
      <ul className="space-y-1">
        {TASK_LABELS.map(({ key, label }) => {
          const hrs = taskHours[key];
          if (hrs <= 0 && key !== 'mobilization') return null;
          return (
            <li key={key} className="flex justify-between gap-4">
              <span>{label}</span>
              <strong className="text-gray-900 dark:text-white tabular-nums">
                {hrs.toFixed(1)} hrs
              </strong>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4 space-y-1">
        <p className="flex justify-between">
          <span>Estimated job duration (clock)</span>
          <strong className="text-gray-900 dark:text-white">
            {result.estimatedJobDurationHours.toFixed(1)} hrs
          </strong>
        </p>
        <p className="flex justify-between">
          <span>Billable job duration (clock)</span>
          <strong className="text-gray-900 dark:text-white">
            {result.billableJobDurationHours.toFixed(1)} hrs
          </strong>
        </p>
        <p className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Total man-hours (clock × crew)</span>
          <strong className="text-gray-900 dark:text-white">
            {result.totalManHours.toFixed(1)}
          </strong>
        </p>
        {result.overtimeJobHours > 0 && (
          <p className="flex justify-between text-amber-700 dark:text-amber-300">
            <span>Overtime (clock / man-hrs)</span>
            <strong>
              {result.overtimeJobHours.toFixed(1)} / {result.overtimeManHours.toFixed(1)}
            </strong>
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
          Placement duration: {taskHours.placement.toFixed(1)} hrs · Regular:{' '}
          {result.regularManHours.toFixed(0)} man-hrs · OT: {result.overtimeManHours.toFixed(0)}{' '}
          man-hrs
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4 space-y-1">
        <p className="flex justify-between">
          <span>Regular labor</span>
          <span>{formatCurrency(costs.regularCost)}</span>
        </p>
        {costs.overtimeCost > 0 && (
          <p className="flex justify-between">
            <span>Overtime</span>
            <span>{formatCurrency(costs.overtimeCost)}</span>
          </p>
        )}
        <p className="flex justify-between">
          <span>Small tools / PPE (5%)</span>
          <span>{formatCurrency(costs.smallToolsAndPpe)}</span>
        </p>
        {costs.contingency > 0 && (
          <p className="flex justify-between">
            <span>Contingency (10%)</span>
            <span>{formatCurrency(costs.contingency)}</span>
          </p>
        )}
        <p className="flex justify-between text-base pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="font-semibold text-gray-900 dark:text-white">Total labor cost</span>
          <strong className="text-gray-900 dark:text-white">
            {formatCurrency(costs.totalLaborCost)}
          </strong>
        </p>
        {input.concreteYards > 0 && (
          <p className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Labor cost per CY</span>
            <span>{formatCurrency(result.unitCosts.laborCostPerCY)}</span>
          </p>
        )}
        {input.areaSqFt > 0 && (
          <p className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Labor cost per SF</span>
            <span>
              {result.unitCosts.laborCostPerSqFt.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      {summaryGrid}

      {detailsCollapsible ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-800 transition-colors"
            aria-expanded={detailsExpanded}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Task breakdown (clock hours per task)
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {!detailsExpanded && (
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(costs.totalLaborCost)}
                </span>
              )}
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  detailsExpanded ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {detailsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 border-t border-gray-200 dark:border-gray-700">
                  {detailsBody}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Task breakdown (clock hours per task)
          </p>
          {detailsBody}
        </div>
      )}
    </div>
  );
};

export default LaborTaskBreakdown;

export const LABOR_ESTIMATE_DISCLAIMER =
  'Labor estimates are planning-level estimates. Actual production may vary based on crew skill, site access, weather, mix design, placement delays, pump availability, inspection delays, and finishing requirements.';
