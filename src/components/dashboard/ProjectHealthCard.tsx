import React from 'react';
import { Activity } from 'lucide-react';
import OpsCard from './OpsCard';

interface ProjectHealthCardProps {
  score: number;
  subtitle?: string;
}

const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({ score, subtitle }) => {
  const color =
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-white">Project health</h3>
      </div>
      <p className={`text-4xl font-bold ${color}`}>{score}%</p>
      <p className="text-xs text-slate-500 mt-2">
        {subtitle ??
          'Weighted: weather, materials, schedule, budget signals, labor, and readiness.'}
      </p>
    </OpsCard>
  );
};

export default ProjectHealthCard;
