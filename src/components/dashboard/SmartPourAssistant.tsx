import React from 'react';
import { Sparkles, AlertTriangle, Info } from 'lucide-react';
import OpsCard from './OpsCard';
import type { SmartPourTip } from '../../utils/operationsDashboard';

const iconFor = (severity: SmartPourTip['severity']) => {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-cyan-400 shrink-0" />;
  }
};

interface SmartPourAssistantProps {
  tips: SmartPourTip[];
  readinessScore: number;
}

const SmartPourAssistant: React.FC<SmartPourAssistantProps> = ({
  tips,
  readinessScore,
}) => (
  <OpsCard>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-400" />
        <h3 className="font-semibold text-white">Smart pour assistant</h3>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase text-slate-500">Ops readiness</p>
        <p className="text-2xl font-bold text-violet-300">{readinessScore}/100</p>
      </div>
    </div>
    <ul className="space-y-2">
      {tips.map((tip) => (
        <li
          key={tip.id}
          className="flex gap-2 text-sm text-slate-300 bg-slate-800/50 rounded-lg p-3 border border-slate-700/80"
        >
          {iconFor(tip.severity)}
          <span>{tip.message}</span>
        </li>
      ))}
    </ul>
  </OpsCard>
);

export default SmartPourAssistant;
