import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import OpsCard from './OpsCard';
import {
  OPS_ATTENTION_CHIP,
  OPS_BODY,
  OPS_MUTED,
  OPS_SUBTLE,
  OPS_TITLE,
} from './opsTheme';
import type { ProjectRiskLevel, ProjectRiskReview } from '../../utils/projectRiskReview';
import {
  HEALTH_ATTENTION_BADGE,
  HEALTH_ATTENTION_TEXT,
  HEALTH_GOOD_BADGE,
  HEALTH_GOOD_TEXT,
} from '../../theme/statusColors';

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
        badge: HEALTH_ATTENTION_BADGE,
        text: HEALTH_ATTENTION_TEXT,
      };
    default:
      return {
        badge: HEALTH_GOOD_BADGE,
        text: HEALTH_GOOD_TEXT,
      };
  }
}

const headerLinkClass =
  'inline-flex shrink-0 items-center gap-1 text-sm text-cyan-700 hover:underline dark:text-cyan-400';

const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({
  review,
  className = '',
  emptyMessage,
}) => {
  const tone = riskTone(review.riskLevel);
  const hasProject = Boolean(review.projectId);

  return (
    <OpsCard className={`flex h-full flex-col ${className}`.trim()}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <h3 className={`font-semibold ${OPS_TITLE}`}>Project risk review</h3>
        </div>
        {hasProject ? (
          <Link
            to={`/projects?project=${review.projectId}`}
            className={headerLinkClass}
          >
            Open project <ArrowRight className="h-4 w-4" />
          </Link>
        ) : !emptyMessage ? (
          <Link to="/planner/schedule" className={headerLinkClass}>
            Open schedule <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        {!hasProject ? (
          <>
            <p className={`text-lg font-bold ${tone.text}`}>
              {emptyMessage ? 'NOTHING IN QUEUE' : review.riskLabel}
            </p>
            <p className={`mt-2 text-sm ${OPS_MUTED}`}>
              {emptyMessage ?? review.attention[0]}
            </p>
          </>
        ) : (
          <>
            <p className={`truncate text-base font-bold leading-snug ${OPS_TITLE}`}>
              {review.projectName}
            </p>

            <p className={`mt-2 text-xl font-bold ${tone.text}`}>{review.riskLabel}</p>
            <span
              className={`mt-1 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.badge}`}
            >
              {review.riskLevel === 'low' ? 'On track' : 'Attention required'}
            </span>

            {review.attention.length > 0 && (
              <>
                <p className={`mb-1.5 mt-3 text-[10px] uppercase tracking-wide ${OPS_SUBTLE}`}>
                  Attention required
                </p>
                <ul className="space-y-1">
                  {review.attention.map((msg) => (
                    <li
                      key={msg}
                      className={`flex gap-1.5 text-xs ${OPS_BODY} ${OPS_ATTENTION_CHIP}`}
                    >
                      <span className="shrink-0 text-amber-400">•</span>
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {review.good.length > 0 && (
              <>
                <p className={`mb-1.5 mt-3 text-[10px] uppercase tracking-wide ${OPS_SUBTLE}`}>
                  Good
                </p>
                <ul className="space-y-0.5">
                  {review.good.map((msg) => (
                    <li key={msg} className={`flex items-center gap-1.5 text-xs ${OPS_BODY}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {review.attention.length === 0 && review.good.length === 0 && (
              <p className={`mt-2 flex items-start gap-1.5 text-xs ${OPS_MUTED}`}>
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" />
                Confirm plant, crew, and weather before first load.
              </p>
            )}
          </>
        )}
      </div>
    </OpsCard>
  );
};

export default ProjectHealthCard;
