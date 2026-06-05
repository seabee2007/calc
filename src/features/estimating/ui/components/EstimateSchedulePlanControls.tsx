import type { EstimateScheduleDependencyMode } from '../../application/estimateScheduleDatePlanner';
import { listScheduleDependencyModeOptions } from '../estimateScheduleDisplay';
import {
  PLANNER_FORM_LABEL,
  PLANNER_INPUT,
} from '../../../../components/planner/plannerTheme';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

export interface EstimateSchedulePlanControlValues {
  projectStartDate: string;
  dependencyMode: EstimateScheduleDependencyMode;
  includeWeekends: boolean;
}

interface Props {
  values: EstimateSchedulePlanControlValues;
  onChange: (patch: Partial<EstimateSchedulePlanControlValues>) => void;
  disabled?: boolean;
}

export default function EstimateSchedulePlanControls({
  values,
  onChange,
  disabled = false,
}: Props) {
  const dependencyOptions = listScheduleDependencyModeOptions();
  const selectedDependency =
    dependencyOptions.find((option) => option.value === values.dependencyMode) ??
    dependencyOptions[0];

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-4`}>
      <div>
        <p className={PLANNER_SECTION_TITLE}>Date planning</p>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Adjust the project start date and dependency rules to preview planned task dates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="estimate-schedule-project-start" className={PLANNER_FORM_LABEL}>
            Project start date
          </label>
          <input
            id="estimate-schedule-project-start"
            type="date"
            className={PLANNER_INPUT}
            value={values.projectStartDate}
            disabled={disabled}
            onChange={(event) => onChange({ projectStartDate: event.target.value })}
          />
        </div>

        <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor="estimate-schedule-dependency-mode" className={PLANNER_FORM_LABEL}>
            Dependency mode
          </label>
          <select
            id="estimate-schedule-dependency-mode"
            className={PLANNER_INPUT}
            value={values.dependencyMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({ dependencyMode: event.target.value as EstimateScheduleDependencyMode })
            }
          >
            {dependencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <label className={`flex items-center gap-2 text-sm ${TEXT_BODY}`}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
              checked={values.includeWeekends}
              disabled={disabled}
              onChange={(event) => onChange({ includeWeekends: event.target.checked })}
            />
            Include weekends in duration
          </label>
        </div>
      </div>

      <p className={`text-xs ${PLANNER_MUTED}`}>{selectedDependency.description}</p>
    </div>
  );
}
