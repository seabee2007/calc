import React from 'react';
import { CloudSun, Thermometer, Wind, Droplets, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
import type { OpsRiskLevel, OperationsSnapshot } from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

function riskColor(level: OpsRiskLevel): string {
  switch (level) {
    case 'high':
      return 'text-red-400';
    case 'moderate':
      return 'text-amber-400';
    case 'low':
      return 'text-emerald-400';
    default:
      return 'text-slate-400';
  }
}

function overallLabel(level: OpsRiskLevel): string {
  return level === 'unknown' ? 'UNKNOWN' : `${level.toUpperCase()} RISK`;
}

interface FeaturedPlacementConditionsProps {
  snapshot: Pick<
    OperationsSnapshot,
    | 'weatherRisk'
    | 'heatRisk'
    | 'windRisk'
    | 'evaporationRisk'
    | 'rainRisk'
    | 'recommendedStartWindow'
    | 'mitigations'
  >;
  hasPlacementsToday: boolean;
}

const FeaturedPlacementConditions: React.FC<FeaturedPlacementConditionsProps> = ({
  snapshot,
  hasPlacementsToday,
}) => (
  <OpsCard className="border-cyan-900/40">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/90 mb-1">
          Today&apos;s placement conditions
        </p>
        <p
          className={`text-2xl sm:text-3xl font-bold ${riskColor(snapshot.weatherRisk)}`}
        >
          {overallLabel(snapshot.weatherRisk)}
        </p>
      </div>
      <Link
        to={`/pour-planner${workflowQuery()}`}
        className="text-sm text-cyan-400 hover:underline inline-flex items-center gap-1 shrink-0"
      >
        Full analysis <ArrowRight className="h-4 w-4" />
      </Link>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <div className={`${OPS_PANEL_INNER} p-3`}>
        <Thermometer className="h-4 w-4 text-red-400 mb-1" />
        <p className="text-xs text-slate-400">Heat</p>
        <p className={`font-bold uppercase text-sm ${riskColor(snapshot.heatRisk)}`}>
          {snapshot.heatRisk}
        </p>
      </div>
      <div className={`${OPS_PANEL_INNER} p-3`}>
        <Wind className="h-4 w-4 text-cyan-400 mb-1" />
        <p className="text-xs text-slate-400">Wind</p>
        <p className={`font-bold uppercase text-sm ${riskColor(snapshot.windRisk)}`}>
          {snapshot.windRisk}
        </p>
      </div>
      <div className={`${OPS_PANEL_INNER} p-3`}>
        <Droplets className="h-4 w-4 text-blue-400 mb-1" />
        <p className="text-xs text-slate-400">Evaporation</p>
        <p
          className={`font-bold uppercase text-sm ${riskColor(snapshot.evaporationRisk)}`}
        >
          {snapshot.evaporationRisk}
        </p>
      </div>
      <div className={`${OPS_PANEL_INNER} p-3`}>
        <CloudSun className="h-4 w-4 text-amber-400 mb-1" />
        <p className="text-xs text-slate-400">Rain</p>
        <p className={`font-bold uppercase text-sm ${riskColor(snapshot.rainRisk)}`}>
          {snapshot.rainRisk}
        </p>
      </div>
    </div>

    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
          Recommended placement
        </p>
        <p className="font-mono text-lg text-cyan-300">
          {hasPlacementsToday
            ? snapshot.recommendedStartWindow
            : 'Set placement date to activate'}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Mitigations
        </p>
        <ul className="text-sm text-slate-300 space-y-1">
          {snapshot.mitigations.slice(0, 4).map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      </div>
    </div>
  </OpsCard>
);

export default FeaturedPlacementConditions;
