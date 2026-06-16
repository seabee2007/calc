import React from 'react';
import { CloudSun, Thermometer, Wind, Droplets, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_BODY, OPS_MUTED, OPS_PANEL_INNER, OPS_SUBTLE } from './opsTheme';
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
  embedded?: boolean;
}

const FeaturedPlacementConditions: React.FC<FeaturedPlacementConditionsProps> = ({
  snapshot,
  hasPlacementsToday,
  embedded = false,
}) => {
  const body = (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {!embedded ? (
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-cyan-400/90">
              Today&apos;s placement conditions
            </p>
          ) : null}
          <p className={`text-2xl font-bold sm:text-3xl ${riskColor(snapshot.weatherRisk)}`}>
            {overallLabel(snapshot.weatherRisk)}
          </p>
        </div>
        <Link
          to={`/pour-planner${workflowQuery()}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-cyan-400 hover:underline"
        >
          Full analysis <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${OPS_PANEL_INNER} p-3`}>
          <Thermometer className="mb-1 h-4 w-4 text-red-400" />
          <p className={`text-xs ${OPS_MUTED}`}>Heat</p>
          <p className={`text-sm font-bold uppercase ${riskColor(snapshot.heatRisk)}`}>
            {snapshot.heatRisk}
          </p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-3`}>
          <Wind className="mb-1 h-4 w-4 text-cyan-400" />
          <p className={`text-xs ${OPS_MUTED}`}>Wind</p>
          <p className={`text-sm font-bold uppercase ${riskColor(snapshot.windRisk)}`}>
            {snapshot.windRisk}
          </p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-3`}>
          <Droplets className="mb-1 h-4 w-4 text-blue-400" />
          <p className={`text-xs ${OPS_MUTED}`}>Evaporation</p>
          <p className={`text-sm font-bold uppercase ${riskColor(snapshot.evaporationRisk)}`}>
            {snapshot.evaporationRisk}
          </p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-3`}>
          <CloudSun className="mb-1 h-4 w-4 text-amber-400" />
          <p className={`text-xs ${OPS_MUTED}`}>Rain</p>
          <p className={`text-sm font-bold uppercase ${riskColor(snapshot.rainRisk)}`}>
            {snapshot.rainRisk}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className={`mb-1 text-xs uppercase tracking-wide ${OPS_SUBTLE}`}>
            Recommended placement
          </p>
          <p className="font-mono text-lg text-cyan-300">
            {hasPlacementsToday
              ? snapshot.recommendedStartWindow
              : 'Set placement date to activate'}
          </p>
        </div>
        <div>
          <p className={`mb-2 text-xs uppercase tracking-wide ${OPS_SUBTLE}`}>Mitigations</p>
          <ul className={`space-y-1 text-sm ${OPS_BODY}`}>
            {snapshot.mitigations.slice(0, 4).map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );

  if (embedded) return body;
  return <OpsCard className="border-cyan-900/40">{body}</OpsCard>;
};

export default FeaturedPlacementConditions;
