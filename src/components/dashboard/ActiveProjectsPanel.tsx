import React from 'react';
import { ChevronRight, MapPin, Factory } from 'lucide-react';
import OpsCard from './OpsCard';
import type { DashboardProjectCard } from '../../utils/operationsDashboard';
import { useNavigate } from 'react-router-dom';

interface ActiveProjectsPanelProps {
  projects: DashboardProjectCard[];
}

const ActiveProjectsPanel: React.FC<ActiveProjectsPanelProps> = ({ projects }) => {
  const navigate = useNavigate();

  return (
    <OpsCard>
      <h3 className="font-semibold text-white mb-4">Active projects</h3>
      {projects.length === 0 ? (
        <p className="text-sm text-slate-400">
          No projects yet.{' '}
          <button
            type="button"
            className="text-cyan-400 underline hover:text-cyan-300"
            onClick={() => navigate('/projects')}
          >
            Create a project
          </button>
        </p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {projects.slice(0, 8).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="w-full text-left rounded-lg border border-slate-700 bg-slate-800/60 p-3 hover:border-cyan-600/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-white">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.remainingCyLabel}</p>
                    <p className="text-xs text-cyan-400/90 mt-1">Next: {p.nextPourLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-emerald-400">{p.readinessScore}</p>
                    <p className="text-[10px] uppercase text-slate-500">readiness</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
                  <span>Mix: {p.mixLabel}</span>
                  <span className="text-amber-400/90">{p.statusLabel}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  {p.batchPlantName && (
                    <span className="flex items-center gap-1">
                      <Factory className="h-3 w-3" />
                      {p.batchPlantName}
                    </span>
                  )}
                  {p.hasJobsite && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Jobsite set
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {projects.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="mt-3 text-sm text-cyan-400 flex items-center gap-1 hover:underline"
        >
          All projects <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </OpsCard>
  );
};

export default ActiveProjectsPanel;
