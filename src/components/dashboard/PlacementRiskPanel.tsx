import React from 'react';
import { CloudSun, Wind, Droplets, Thermometer } from 'lucide-react';
import Card from '../ui/Card';
import type { OpsRiskLevel, OperationsSnapshot } from '../../utils/operationsDashboard';
import { Link } from 'react-router-dom';

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

interface PlacementRiskPanelProps {
  snapshot: Pick<
    OperationsSnapshot,
    | 'heatRisk'
    | 'rainRisk'
    | 'windRisk'
    | 'weatherRiskLabel'
    | 'recommendedStartWindow'
    | 'mitigations'
  >;
}

const PlacementRiskPanel: React.FC<PlacementRiskPanelProps> = ({ snapshot }) => (
  <Card className="p-5 bg-slate-900/95 border border-slate-700 text-white">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <CloudSun className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold">Concrete placement risk</h3>
      </div>
      <Link
        to="/pour-planner"
        className="text-xs text-cyan-400 hover:underline"
      >
        Full analysis →
      </Link>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="rounded-lg bg-slate-800/80 p-3">
        <Thermometer className="h-4 w-4 text-red-400 mb-1" />
        <p className="text-xs text-slate-400">Heat risk</p>
        <p className={`font-bold uppercase ${riskColor(snapshot.heatRisk)}`}>
          {snapshot.heatRisk}
        </p>
      </div>
      <div className="rounded-lg bg-slate-800/80 p-3">
        <Droplets className="h-4 w-4 text-blue-400 mb-1" />
        <p className="text-xs text-slate-400">Rain risk</p>
        <p className={`font-bold uppercase ${riskColor(snapshot.rainRisk)}`}>
          {snapshot.rainRisk}
        </p>
      </div>
      <div className="rounded-lg bg-slate-800/80 p-3">
        <Wind className="h-4 w-4 text-cyan-400 mb-1" />
        <p className="text-xs text-slate-400">Wind risk</p>
        <p className={`font-bold uppercase ${riskColor(snapshot.windRisk)}`}>
          {snapshot.windRisk}
        </p>
      </div>
      <div className="rounded-lg bg-slate-800/80 p-3">
        <CloudSun className="h-4 w-4 text-amber-400 mb-1" />
        <p className="text-xs text-slate-400">Overall</p>
        <p className="font-bold text-white">{snapshot.weatherRiskLabel}</p>
      </div>
    </div>

    <p className="text-sm text-slate-300 mb-2">
      Recommended start:{' '}
      <span className="font-mono text-cyan-300">{snapshot.recommendedStartWindow}</span>
    </p>

    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Mitigations</p>
    <ul className="text-sm text-slate-300 space-y-1">
      {snapshot.mitigations.map((m) => (
        <li key={m}>• {m}</li>
      ))}
    </ul>
  </Card>
);

export default PlacementRiskPanel;
