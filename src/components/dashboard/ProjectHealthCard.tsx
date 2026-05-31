import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Calendar, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import {
  OPS_ATTENTION_CHIP,
  OPS_BODY,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
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
        <h3 className={`font-semibold text-sm uppercase tracking-wide ${OPS_TITLE}`}>
          Project risk review
        </h3>
      </div>

      {!review.projectId ? (
        <>
          <p className={`text-lg font-bold ${tone.text}`}>
            {emptyMessage ? 'NOTHING IN QUEUE' : review.riskLabel}
          </p>
          <p className={`text-sm mt-2 ${OPS_MUTED}`}>
            {emptyMessage ?? review.attention[0]}
          </p>
          {!emptyMessage && (
            <Button
              size="sm"
              variant="outline"
              className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
              icon={<Calendar className="h-4 w-4" />}
              onClick={() => navigate('/projects')}
            >
              Schedule Placement
            </Button>
          )}
        </>
      ) : (
        <>
          <p className={`text-base font-bold leading-snug truncate ${OPS_TITLE}`}>
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
              <p className={`text-[10px] uppercase tracking-wide mt-3 mb-1.5 ${OPS_SUBTLE}`}>
                Attention required
              </p>
              <ul className="space-y-1">
                {review.attention.map((msg) => (
                  <li
                    key={msg}
                    className={`flex gap-1.5 text-xs ${OPS_BODY} ${OPS_ATTENTION_CHIP}`}
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
              <p className={`text-[10px] uppercase tracking-wide mt-3 mb-1.5 ${OPS_SUBTLE}`}>
                Good
              </p>
              <ul className="space-y-0.5">
                {review.good.map((msg) => (
                  <li key={msg} className={`flex items-center gap-1.5 text-xs ${OPS_BODY}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {review.attention.length === 0 && review.good.length === 0 && (
            <p className={`text-xs mt-2 flex gap-1.5 items-start ${OPS_MUTED}`}>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-px" />
              Confirm plant, crew, and weather before first load.
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
            icon={<FolderKanban className="h-4 w-4" />}
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
