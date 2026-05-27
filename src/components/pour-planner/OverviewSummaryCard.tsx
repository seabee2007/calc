import React from 'react';
import { Truck, Clock, CloudSun, Timer } from 'lucide-react';
import Card from '../ui/Card';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import { timeRiskColor } from '../../utils/placementWindow';

interface OverviewSummaryCardProps {
  planner: PourPlannerContext;
}

const OverviewSummaryCard: React.FC<OverviewSummaryCardProps> = ({ planner }) => {
  const { overview, deliveryWindow, preferences } = planner;
  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  return (
    <Card className="p-4 bg-white/95 dark:bg-gray-900/95 border border-blue-100 dark:border-blue-900/50">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Placement snapshot
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          label="Total volume"
          value={
            overview.volume > 0
              ? `${overview.volume.toFixed(1)} ${volumeLabel}`
              : '—'
          }
          sub={
            overview.volumeYd > 0
              ? `${overview.volumeYd.toFixed(1)} yd³`
              : undefined
          }
        />
        <Stat
          icon={<Truck className="h-4 w-4 text-blue-600" />}
          label="Est. trucks"
          value={overview.truckCount > 0 ? String(overview.truckCount) : '—'}
        />
        <Stat
          icon={<Clock className="h-4 w-4 text-blue-600" />}
          label="Placement duration"
          value={
            overview.pourDurationHours > 0
              ? `${overview.pourDurationHours.toFixed(1)} hr`
              : '—'
          }
        />
        <Stat
          icon={<CloudSun className="h-4 w-4 text-blue-600" />}
          label="Weather risk"
          value={overview.weatherRisk}
        />
      </div>

      {overview.volume > 0 && (
        <div
          className={`mt-3 rounded-lg border p-3 flex items-start gap-3 ${timeRiskColor(deliveryWindow.riskLevel)}`}
        >
          <Timer className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">
              Delivery status: {deliveryWindow.statusLabel}
            </p>
            <p className="text-xs mt-0.5 opacity-90">
              {deliveryWindow.remainingMinutes > 0
                ? `${Math.round(deliveryWindow.remainingMinutes)} min remaining before ${deliveryWindow.allowedMinutes}-min limit`
                : `${Math.abs(Math.round(deliveryWindow.remainingMinutes))} min over ${deliveryWindow.allowedMinutes}-min ASTM C94 window`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
      )}
    </div>
  );
}

export default OverviewSummaryCard;
