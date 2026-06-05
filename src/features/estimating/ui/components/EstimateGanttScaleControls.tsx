import { PLANNER_FORM_LABEL } from '../../../../components/planner/plannerTheme';
import {
  GANTT_TIMELINE_SCALE_OPTIONS,
  type GanttTimelineScale,
} from '../estimateGanttDisplay';
import { PLANNER_MUTED, TEXT_BODY } from '../estimateWorkspaceTheme';

interface Props {
  scale: GanttTimelineScale;
  onScaleChange: (scale: GanttTimelineScale) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function EstimateGanttScaleControls({
  scale,
  onScaleChange,
  disabled = false,
  compact = false,
}: Props) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <p className={compact ? `text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}` : PLANNER_FORM_LABEL}>
        Timeline scale
      </p>
      <div
        className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-800/60"
        role="radiogroup"
        aria-label="Gantt timeline scale"
      >
        {GANTT_TIMELINE_SCALE_OPTIONS.map((option) => {
          const isSelected = scale === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-sm dark:bg-cyan-500'
                  : `text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700/80 ${TEXT_BODY}`
              } disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => onScaleChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <p className={`text-xs ${PLANNER_MUTED}`}>
          Long timelines keep horizontal scroll instead of shrinking columns.
        </p>
      ) : null}
    </div>
  );
}
