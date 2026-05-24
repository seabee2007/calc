import React from 'react';
import { Lightbulb } from 'lucide-react';
import Card from '../ui/Card';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../utils/pourScoring';

interface RecommendedActionsProps {
  planner: PourPlannerContext;
  selectedDay?: ScoredPourDay;
}

const RecommendedActions: React.FC<RecommendedActionsProps> = ({
  planner,
  selectedDay,
}) => {
  const { hotWeather, slumpRisk, deliveryWindow, production } = planner;

  const actions = new Set<string>();

  if (deliveryWindow.riskLevel === 'critical') {
    actions.add('Reduce onsite wait — tighten truck spacing');
    actions.add('Confirm batch plant timing with supplier');
    actions.add('Consider closer plant or earlier batch time');
  } else if (deliveryWindow.riskLevel === 'caution') {
    actions.add('Reduce truck spacing to limit onsite wait');
    actions.add('Coordinate arrival times with dispatcher');
  }

  hotWeather.actions.forEach((a) => actions.add(a));

  if (slumpRisk.riskLevel !== 'low') {
    actions.add('Confirm slump retention admixture with supplier');
    actions.add('Do not add field water unless allowed by mix design/spec');
  }

  if (production.placementDurationHours > 3) {
    actions.add('Plan phased placement or increase crew size');
  }

  selectedDay?.recommendedActions?.forEach((a) => actions.add(a));

  if (actions.size === 0) {
    actions.add('Conditions look favorable — confirm mix design and crew schedule');
    actions.add('Have curing supplies and QC tools ready on site');
  }

  return (
    <Card className="p-5 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Recommended actions
        </h3>
      </div>
      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {[...actions].slice(0, 8).map((action) => (
          <li key={action} className="flex gap-2">
            <span className="text-blue-600 dark:text-blue-400 shrink-0">•</span>
            {action}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        {slumpRisk.recommendation}
      </p>
    </Card>
  );
};

export default RecommendedActions;
