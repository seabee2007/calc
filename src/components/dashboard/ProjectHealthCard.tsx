import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { ProjectRiskLevel, ProjectRiskReview } from '../../utils/projectRiskReview';

interface ProjectHealthCardProps {
  review: ProjectRiskReview;
  className?: string;
  emptyMessage?: string;
}

function riskTone(level: ProjectRiskLevel): { badge: string; text: string } {
  switch (level) {
    case 'high':
      return { badge: 'bg-red-500/15 text-red-300 border-red-500/40', text: 'text-red-400' };
    case 'moderate':
      return {
        badge: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
        text: 'text-amber-400',
      };
    default:
      return {
        badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
        text: 'text-emerald-400',
      };
  }
}

const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({
  review,
  className,
  emptyMessage,
}) => {
  const navigate = useNavigate();
  const tone = riskTone(review.riskLevel);

  return (
    <OpsCard className={className}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-5 w-5 text-cyan-400 shrink-0" />
        <h3 className="font-semibold text-white text-sm uppercase tracking-wide">
          Project risk review
        </h3>
      </div>

      {!review.projectId ? (
        <>
          <p className={`text-lg font-bold ${tone.text}`}>
            {emptyMessage ? 'NOTHING IN QUEUE' : review.riskLabel}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {emptyMessage ?? review.attention[0]}
          </p>
          {!emptyMessage && (
            <Button
              size="sm"
              className="!bg-cyan-600 hover:!bg-cyan-500 !text-white mt-3 w-full"
              onClick={() => navigate('/projects')}
            >
              Schedule Placement
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-base font-bold text-white leading-snug truncate">
            {review.projectName}
          </p>

          <p className={`text-xl font-bold mt-2 ${tone.text}`}>{review.riskLabel}</p>
          <span
            className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${tone.badge}`}
          >
            {review.riskLevel === 'low' ? 'On track' : 'Attention required'}
          </span>

          {review.attention.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
                Attention required
              </p>
              <ul className="space-y-1">
                {review.attention.map((msg) => (
                  <li
                    key={msg}
                    className="flex gap-1.5 text-xs text-slate-300"
                  >
                    <span className="text-amber-400 shrink-0">•</span>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {review.good.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
                Good
              </p>
              <ul className="space-y-0.5">
                {review.good.map((msg) => (
                  <li key={msg} className="flex items-center gap-1.5 text-xs text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {review.attention.length === 0 && review.good.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 flex gap-1.5 items-start">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-px" />
              Confirm plant, crew, and weather before first load.
            </p>
          )}

          <Button
            size="sm"
            className="!bg-cyan-600 hover:!bg-cyan-500 !text-white mt-3 w-full"
            onClick={() => navigate(`/projects?project=${review.projectId}`)}
          >
            Open Project
          </Button>
        </>
      )}
    </OpsCard>
  );
};

export default ProjectHealthCard;
