import React from 'react';
import {
  Truck,
  Thermometer,
  Droplets,
  Users,
  AlertTriangle,
} from 'lucide-react';
import Card from '../ui/Card';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../utils/pourScoring';
interface RiskDashboardProps {
  planner: PourPlannerContext;
  selectedDay?: ScoredPourDay;
}

const riskCardClass = (level: 'ok' | 'caution' | 'critical' | 'low' | 'moderate' | 'high') => {
  if (level === 'ok' || level === 'low') {
    return 'border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-900/20';
  }
  if (level === 'caution' || level === 'moderate') {
    return 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20';
  }
  return 'border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20';
};

const RiskDashboard: React.FC<RiskDashboardProps> = ({ planner, selectedDay }) => {
  const { deliveryWindow, hotWeather, slumpRisk, form, production, placementRateEstimate: est } =
    planner;
  const isPump = form.placementMethod === 'pump';
  const pumpLineLen = parseFloat(form.pumpLineLength) || 0;
  const pumpRisk =
    isPump && (pumpLineLen > 300 || slumpRisk.riskLevel === 'high')
      ? 'high'
      : isPump && pumpLineLen > 150
        ? 'moderate'
        : isPump
          ? 'low'
          : 'low';

  const crewSize = parseInt(form.crewSize, 10) || 0;
  const finishers = parseInt(form.finishers, 10) || 0;
  const qcRisk =
    crewSize < 4 ||
    finishers < 2 ||
    production.placementDurationHours > 4 ||
    est.limitingFactor === 'finishing_crew'
      ? 'moderate'
      : 'low';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RiskCard
        icon={<Truck className="h-5 w-5" />}
        title="Delivery risk"
        level={deliveryWindow.riskLevel}
        items={[
          `Time compliance: ${deliveryWindow.statusLabel}`,
          `${Math.round(deliveryWindow.remainingMinutes)} min remaining`,
          `Travel + wait: ${Math.round(deliveryWindow.travelTimeMin + deliveryWindow.siteWaitMin)} min`,
        ]}
      />
      <RiskCard
        icon={<Thermometer className="h-5 w-5" />}
        title="Hot weather risk"
        level={
          hotWeather.riskLevel === 'high'
            ? 'critical'
            : hotWeather.riskLevel === 'moderate'
              ? 'caution'
              : 'ok'
        }
        items={[
          `Evaporation: ${hotWeather.evaporationRateLbFt2Hr.toFixed(2)} lb/ft²/hr`,
          `Risk: ${hotWeather.riskLabel}`,
          selectedDay
            ? `Forecast: ${selectedDay.maxTemp}°F max`
            : 'Use weather step for forecast',
        ]}
      />
      <RiskCard
        icon={<Droplets className="h-5 w-5" />}
        title="Slump / pumpability"
        level={
          slumpRisk.riskLevel === 'high' || pumpRisk === 'high'
            ? 'critical'
            : slumpRisk.riskLevel === 'moderate' || pumpRisk === 'moderate'
              ? 'caution'
              : 'ok'
        }
        items={[
          `Required slump: ${slumpRisk.requiredSlump} in`,
          `Placement: ${form.placementMethod || 'not set'}`,
          isPump
            ? `Pump line: ${pumpLineLen || '—'} ft · slump loss risk ${slumpRisk.riskLabel}`
            : `Slump loss risk: ${slumpRisk.riskLabel}`,
        ]}
      />
      <RiskCard
        icon={<Users className="h-5 w-5" />}
        title="QC / crew risk"
        level={qcRisk === 'moderate' ? 'caution' : 'ok'}
        items={[
          `Crew: ${crewSize || '—'} (${est.laborers} placing · ${est.finishers} finishing)`,
          `Bottleneck: ${est.limitingFactor.replace('_', ' ')} · ${est.adjustedRateCYHr} CY/hr`,
          est.bottleneckRecommendation ?? `Placement duration: ${production.placementDurationHours.toFixed(1)} hr`,
          `Truck arrival spacing: ${Math.round(production.truckSpacingMinutes)} min (discharge interval)`,
        ]}
      />
    </div>
  );
};

function RiskCard({
  icon,
  title,
  level,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  level: 'ok' | 'caution' | 'critical';
  items: string[];
}) {
  const mapLevel = level === 'ok' ? 'low' : level === 'caution' ? 'moderate' : 'high';
  return (
    <Card className={`p-4 border ${riskCardClass(mapLevel)}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
        {level !== 'ok' && (
          <AlertTriangle
            className={`h-4 w-4 ml-auto ${
              level === 'critical'
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          />
        )}
      </div>
      <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </Card>
  );
}

export default RiskDashboard;
