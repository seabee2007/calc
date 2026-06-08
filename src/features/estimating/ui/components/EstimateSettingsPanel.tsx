import type { ReactNode } from 'react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Button from '../../../../components/ui/Button';
import type { EstimateSettings } from '../../domain/estimateTypes';
import { parseEstimateFormNumber } from '../estimateFormDefaults';
import type { UseEstimateSettingsResult } from '../hooks/useEstimateSettings';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
} from '../estimateWorkspaceTheme';

interface Props {
  settingsState: UseEstimateSettingsResult;
  canEdit: boolean;
  projectCrewSize: number;
  onProjectCrewSizeChange: (value: number) => void;
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

function PercentInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      label={label}
      type="number"
      min={0}
      max={100}
      step="any"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(parseEstimateFormNumber(event.target.value))}
      fullWidth
    />
  );
}

export default function EstimateSettingsPanel({
  settingsState,
  canEdit,
  projectCrewSize,
  onProjectCrewSizeChange,
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
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Project-wide pricing and estimate rules.
        </p>
      </div>

      <SettingsSection title="Pricing">
        <Input
          label="Labor rate"
          type="number"
          min={0}
          step="any"
          value={settings.defaultLaborRate}
          disabled={!canEdit}
          onChange={(event) =>
            patch({ defaultLaborRate: parseEstimateFormNumber(event.target.value) })
          }
          fullWidth
        />
        <PercentInput
          label="Burden %"
          value={settings.burdenPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ burdenPercent: value })}
        />
        <PercentInput
          label="Material markup %"
          value={settings.materialMarkupPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ materialMarkupPercent: value })}
        />
        <PercentInput
          label="Equipment markup %"
          value={settings.equipmentMarkupPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ equipmentMarkupPercent: value })}
        />
        <PercentInput
          label="Subcontractor markup %"
          value={settings.subcontractorMarkupPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ subcontractorMarkupPercent: value })}
        />
        <PercentInput
          label="Indirect cost %"
          value={settings.indirectCostPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ indirectCostPercent: value })}
        />
        <PercentInput
          label="Overhead %"
          value={settings.overheadPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ overheadPercent: value })}
        />
        <PercentInput
          label="Profit %"
          value={settings.profitPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ profitPercent: value })}
        />
        <PercentInput
          label="Contingency %"
          value={settings.contingencyPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ contingencyPercent: value })}
        />
        <PercentInput
          label="Tax %"
          value={settings.taxPercent}
          disabled={!canEdit}
          onChange={(value) => patch({ taxPercent: value })}
        />
      </SettingsSection>

      <SettingsSection title="Schedule resources">
        <Input
          label="Project Crew Size"
          type="number"
          min={1}
          max={999}
          step={1}
          value={projectCrewSize}
          disabled={!canEdit || projectCrewSizeSaving}
          onChange={(event) =>
            onProjectCrewSizeChange(parseEstimateFormNumber(event.target.value))
          }
          fullWidth
        />
        <p className={`text-xs ${PLANNER_MUTED} sm:col-span-2 lg:col-span-3`}>
          Total workers normally available for this project per workday. Used for the Level III
          Gantt resource histogram and resource leveling. Saved to the project record.
        </p>
      </SettingsSection>

      <SettingsSection title="Rules">
        <Select
          label="Apply overhead to"
          value={settings.overheadBase}
          disabled={!canEdit}
          options={[
            { value: 'direct_cost', label: 'Direct cost' },
            { value: 'labor_only', label: 'Labor only' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(value) =>
            patch({
              overheadBase: value as EstimateSettings['overheadBase'],
            })
          }
          fullWidth
        />
        <Select
          label="Apply profit to"
          value={settings.profitBase}
          disabled={!canEdit}
          options={[
            { value: 'direct_plus_overhead', label: 'Direct + overhead' },
            { value: 'direct_only', label: 'Direct only' },
          ]}
          onChange={(value) =>
            patch({
              profitBase: value as EstimateSettings['profitBase'],
            })
          }
          fullWidth
        />
        <Select
          label="Tax applies to"
          value={settings.taxBase}
          disabled={!canEdit}
          options={[
            { value: 'materials_only', label: 'Materials only' },
            { value: 'total_estimate', label: 'Total estimate' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(value) =>
            patch({
              taxBase: value as EstimateSettings['taxBase'],
            })
          }
          fullWidth
        />
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
        <Input
          label="Default activity crew size"
          type="number"
          min={0}
          step="any"
          value={settings.defaultCrewSize}
          disabled={!canEdit}
          onChange={(event) =>
            patch({ defaultCrewSize: parseEstimateFormNumber(event.target.value) })
          }
          fullWidth
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
