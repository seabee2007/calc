import type { ReactNode, RefObject } from 'react';
import type { PositiveIntegerInputHandle } from './PositiveIntegerInput';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import type { EstimateSettings } from '../../domain/estimateTypes';
import type { EstimateType } from '../../domain/estimateTypes';
import { formatEstimateMethodLabel } from '../estimateMethodDisplay';
import { getEstimateMethod } from '../../domain/estimateMethods';
import { parseEstimateFormNumber } from '../estimateFormDefaults';
import type { UseEstimateSettingsResult } from '../hooks/useEstimateSettings';
import PositiveIntegerInput from './PositiveIntegerInput';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
} from '../estimateWorkspaceTheme';
import ProjectLaborRateScheduleSection from './ProjectLaborRateScheduleSection';

export const ESTIMATE_SETTINGS_DESCRIPTION =
  'Project-wide workflow and labor-rate defaults.';

interface Props {
  settingsState: UseEstimateSettingsResult;
  canEdit: boolean;
  projectId: string;
  estimateType: EstimateType;
  schedulingEnabled: boolean;
  onEstimateTypeChange: () => void;
  onSchedulingEnabledChange: (enabled: boolean) => void;
  projectCrewSize: number;
  onProjectCrewSizeChange: (value: number) => void;
  onProjectCrewSizeDraftChange?: (raw: string) => void;
  projectCrewSizeInputRef?: RefObject<PositiveIntegerInputHandle | null>;
  projectCrewSizeSaving?: boolean;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-700">
      <h3 className={PLANNER_SECTION_TITLE}>{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default function EstimateSettingsPanel({
  settingsState,
  canEdit,
  projectId,
  estimateType,
  schedulingEnabled,
  onEstimateTypeChange,
  onSchedulingEnabledChange,
  projectCrewSize,
  onProjectCrewSizeChange,
  onProjectCrewSizeDraftChange,
  projectCrewSizeInputRef,
  projectCrewSizeSaving = false,
}: Props) {
  const {
    settings,
    importing,
    importError,
    updateSettings,
    importFromUserSettings,
  } = settingsState;

  const patch = (next: Partial<EstimateSettings>) => {
    if (!canEdit) return;
    updateSettings(next);
  };

  return (
    <div className={`${PLANNER_FORM_PANEL} mx-auto max-w-5xl space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Estimate settings
        </h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>{ESTIMATE_SETTINGS_DESCRIPTION}</p>
      </div>

      <SettingsSection title="Estimate workflow">
        <div className="sm:col-span-2 lg:col-span-3">
          <p className={`text-sm ${PLANNER_MUTED}`}>Estimate type</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatEstimateMethodLabel(estimateType)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit}
              onClick={onEstimateTypeChange}
            >
              Change
            </Button>
          </div>
          <p className={`mt-2 text-xs ${PLANNER_MUTED}`}>
            {getEstimateMethod(estimateType).shortDescription}
          </p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={schedulingEnabled}
              disabled={!canEdit}
              onChange={(event) => onSchedulingEnabledChange(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Scheduling enabled
              </span>
              <span className={`mt-1 block text-xs ${PLANNER_MUTED}`}>
                When enabled, construction activities can feed Schedule Preview, Logic Network,
                CPM, and Level III Gantt. Turning this off hides schedule tabs but preserves
                saved schedule data.
              </span>
            </span>
          </label>
        </div>
      </SettingsSection>

      <ProjectLaborRateScheduleSection projectId={projectId} canEdit={canEdit} />

      <SettingsSection title="Schedule resources">
        <PositiveIntegerInput
          ref={projectCrewSizeInputRef}
          label="Project Crew Size"
          value={projectCrewSize}
          disabled={!canEdit || projectCrewSizeSaving}
          min={1}
          max={999}
          onCommit={onProjectCrewSizeChange}
          onDraftChange={onProjectCrewSizeDraftChange}
        />
        <p className={`text-xs ${PLANNER_MUTED} sm:col-span-2 lg:col-span-3`}>
          Total workers normally available for this project per workday. Used for the Level III
          Gantt resource histogram and resource leveling. Saved to the project record.
        </p>
      </SettingsSection>

      <SettingsSection title="Defaults">
        <Input
          label="Hours per day"
          type="number"
          min={0}
          step="any"
          value={settings.hoursPerDay}
          disabled={!canEdit}
          onChange={(event) =>
            patch({ hoursPerDay: parseEstimateFormNumber(event.target.value) })
          }
          fullWidth
        />
        <PositiveIntegerInput
          label="Default activity crew size"
          value={settings.defaultCrewSize}
          disabled={!canEdit}
          min={1}
          onCommit={(value) => patch({ defaultCrewSize: value })}
        />
        <p className={`text-xs ${PLANNER_MUTED} sm:col-span-2 lg:col-span-3`}>
          Workers required for a new estimate line item when no activity-specific crew size is set.
          This is not the project daily labor cap.
        </p>
        <Input
          label="Currency"
          value={settings.currency}
          disabled={!canEdit}
          onChange={(event) => patch({ currency: event.target.value.trim() || 'USD' })}
          fullWidth
        />
      </SettingsSection>

      <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className={PLANNER_SECTION_TITLE}>Import from user settings</h3>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Pull available defaults from your user and company settings. Missing values are left
          unchanged; only app defaults apply when no saved setting exists.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit || importing}
            isLoading={importing}
            onClick={() => void importFromUserSettings()}
          >
            Import from user settings
          </Button>
          {settings.importedFromUserSettingsAt ? (
            <span className={`text-xs ${PLANNER_MUTED}`}>
              Last imported {new Date(settings.importedFromUserSettingsAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        {importError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{importError}</p>
        ) : null}
      </section>
    </div>
  );
}
