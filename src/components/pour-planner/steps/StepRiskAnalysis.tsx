import React from 'react';
import RiskDashboard from '../RiskDashboard';
import RecommendedActions from '../RecommendedActions';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../../utils/pourScoring';
import Card from '../../ui/Card';
import PlannerStepLocationsCard from '../PlannerStepLocationsCard';
import PourOrderSection from '../PourOrderSection';

interface StepProps {
  planner: PourPlannerContext;
  selectedDay?: ScoredPourDay;
}

export const StepRiskAnalysis: React.FC<StepProps> = ({ planner, selectedDay }) => {
  const { deliveryWindow, hotWeather, slumpRisk, production } = planner;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Risk dashboard
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Combined delivery, weather, slump, and crew risk for this placement plan.
        </p>
        <PlannerStepLocationsCard form={planner.form} className="mb-4" />
        <RiskDashboard planner={planner} selectedDay={selectedDay} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile
          title="Delivery"
          value={deliveryWindow.statusLabel}
          detail={`${Math.round(deliveryWindow.totalElapsedMin)} min elapsed`}
        />
        <SummaryTile
          title="Evaporation"
          value={hotWeather.riskLabel}
          detail={`${hotWeather.evaporationRateLbFt2Hr.toFixed(2)} lb/ft²/hr`}
        />
        <SummaryTile
          title="Slump loss"
          value={slumpRisk.riskLabel}
          detail={`${slumpRisk.requiredSlump}" required`}
        />
      </section>

      <RecommendedActions planner={planner} selectedDay={selectedDay} />

      <Card className="p-4 text-xs text-gray-600 dark:text-gray-400">
        Scores follow ACI 305R (hot weather) and 306R (cold weather). ASTM C94 discharge
        limits apply unless waived. Always follow project specifications and engineer
        requirements.
      </Card>

      <PourOrderSection planner={planner} selectedDay={selectedDay} />
    </div>
  );
};

function SummaryTile({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-3 text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </Card>
  );
}

export default StepRiskAnalysis;
