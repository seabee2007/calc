import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import ConstructionUnitCombobox from './ConstructionUnitCombobox';
import FieldLabelWithTooltip from './FieldLabelWithTooltip';
import LaborFieldDefinitionsModal from './LaborFieldDefinitionsModal';
import { getLaborFieldDefinition } from '../../data/laborFieldDefinitions';
import {
  applyDivisionScopeDefaults,
  applyDraftLaborDefaults,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';
import {
  getCsiDivisionLabel,
  getCsiDivisionOptions,
  isKnownCsiDivision,
  normalizeCsiDivisionCode,
} from '../../domain/csiDivisions';
import {
  CUSTOM_UNASSIGNED_SCOPE_LABEL,
  getScopeTemplateOptions,
  isKnownScopeTemplate,
  normalizeScopeName,
} from '../../domain/csiScopeTemplates';
import type { EstimateRelationshipType, ProductionRateType } from '../../domain/estimateTypes';
import { syncActivityCodeFromParsedManualCode } from '../../application/estimateActivityCoding';
import { getCsiDivisionByCode } from '../../domain/csiDivisions';
import {
  parseEstimateFormNumber,
  PRODUCTION_RATE_TYPE_OPTIONS,
} from '../estimateFormDefaults';
import {
  PLANNER_FORM_LABEL,
  PLANNER_INPUT,
  PLANNER_SECTION_TITLE,
} from '../../../../components/planner/plannerTheme';

const RELATIONSHIP_OPTIONS = [
  { value: 'FS', label: 'Finish-to-start (FS)' },
  { value: 'SS', label: 'Start-to-start (SS)' },
  { value: 'FF', label: 'Finish-to-finish (FF)' },
  { value: 'SF', label: 'Start-to-finish (SF)' },
] as const;

interface Props {
  draft: EstimateDraftLine;
  onChange: (draft: EstimateDraftLine) => void;
  predecessorOptions?: Array<{ value: string; label: string }>;
  formError?: string | null;
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const UNASSIGNED_DIVISION_VALUE = '';
const CUSTOM_UNASSIGNED_SCOPE_VALUE = '';

function laborTooltip(id: string): string {
  return getLaborFieldDefinition(id)?.short ?? '';
}

export default function EstimateManualLineItemForm({
  draft,
  onChange,
  predecessorOptions = [],
  formError = null,
}: Props) {
  const [laborHelpOpen, setLaborHelpOpen] = useState(false);
  const { task } = draft;
  const labor = task.lineItem.labor ?? {};

  const storedDivision = task.lineItem.csiDivision ?? '';
  const normalizedDivision = normalizeCsiDivisionCode(storedDivision);
  const selectedDivisionValue =
    storedDivision.trim() === ''
      ? UNASSIGNED_DIVISION_VALUE
      : isKnownCsiDivision(storedDivision)
        ? normalizedDivision
        : storedDivision.trim();

  const csiDivisionSelectOptions = useMemo(() => {
    const options = getCsiDivisionOptions().map((division) => ({
      value: division.code,
      label: division.label,
    }));

    if (
      selectedDivisionValue &&
      selectedDivisionValue !== UNASSIGNED_DIVISION_VALUE &&
      !isKnownCsiDivision(selectedDivisionValue)
    ) {
      options.push({
        value: selectedDivisionValue,
        label: getCsiDivisionLabel(selectedDivisionValue) || selectedDivisionValue,
      });
    }

    return [
      { value: UNASSIGNED_DIVISION_VALUE, label: 'Unassigned division of work' },
      ...options,
    ];
  }, [selectedDivisionValue]);

  const divisionForScopeTemplates = isKnownCsiDivision(selectedDivisionValue)
    ? normalizedDivision
    : '';
  const storedScope = normalizeScopeName(task.scopeName);
  const hasKnownScopeTemplates = divisionForScopeTemplates.length > 0;

  const scopeSelectOptions = useMemo(() => {
    if (!hasKnownScopeTemplates) return [];

    const options = getScopeTemplateOptions(divisionForScopeTemplates).map((scope) => ({
      value: scope.scopeName,
      label: scope.label,
    }));

    if (
      storedScope &&
      !isKnownScopeTemplate(divisionForScopeTemplates, storedScope)
    ) {
      options.push({
        value: storedScope,
        label: storedScope,
      });
    }

    return [
      { value: CUSTOM_UNASSIGNED_SCOPE_VALUE, label: CUSTOM_UNASSIGNED_SCOPE_LABEL },
      ...options,
    ];
  }, [divisionForScopeTemplates, hasKnownScopeTemplates, storedScope]);

  const selectedScopeValue = !hasKnownScopeTemplates
    ? storedScope
    : storedScope === ''
      ? CUSTOM_UNASSIGNED_SCOPE_VALUE
      : isKnownScopeTemplate(divisionForScopeTemplates, storedScope)
        ? storedScope
        : storedScope;

  const showCustomScopeInput =
    hasKnownScopeTemplates &&
    (selectedScopeValue === CUSTOM_UNASSIGNED_SCOPE_VALUE ||
      (storedScope !== '' &&
        !isKnownScopeTemplate(divisionForScopeTemplates, storedScope)));

  const emitChange = (next: EstimateDraftLine) => {
    onChange(applyDivisionScopeDefaults(applyDraftLaborDefaults(next)));
  };

  const patchTask = (patch: Partial<EstimateDraftLine['task']>) => {
    emitChange({
      ...draft,
      task: { ...task, ...patch },
    });
  };

  const patchLineItem = (patch: Partial<EstimateDraftLine['task']['lineItem']>) => {
    const next = {
      ...draft,
      task: {
        ...task,
        lineItem: { ...task.lineItem, ...patch },
      },
    };
    emitChange(
      patch.csiDivision !== undefined
        ? applyDivisionScopeDefaults(next)
        : next,
    );
  };

  const patchQuantity = (patch: Partial<EstimateDraftLine['task']['lineItem']['quantity']>) => {
    patchLineItem({
      quantity: { ...task.lineItem.quantity, ...patch },
    });
  };

  const patchLabor = (patch: Partial<NonNullable<EstimateDraftLine['task']['lineItem']['labor']>>) => {
    patchLineItem({
      labor: { ...labor, ...patch },
    });
  };

  const patchMaterial = (value: number) => {
    patchLineItem({ material: { unitCost: value } });
  };

  const patchEquipment = (value: number) => {
    patchLineItem({
      equipment: { rate: value, rateType: 'lump_sum', usageUnits: 1 },
    });
  };

  const patchSubcontractor = (value: number) => {
    patchLineItem({ subcontractor: { cost: value } });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className={PLANNER_SECTION_TITLE}>Identity</h3>
        <FieldGrid>
          <Select
            label="Division of Work"
            value={selectedDivisionValue}
            options={csiDivisionSelectOptions}
            onChange={(value) => {
              const division = getCsiDivisionByCode(value);
              patchTask({
                divisionCode: value,
                divisionName: division?.name ?? value,
              });
              patchLineItem({
                csiDivision: value,
                csiSection: task.lineItem.csiSection,
              });
            }}
            fullWidth
          />
          <Input
            label="CSI Section"
            value={task.lineItem.csiSection ?? ''}
            onChange={(event) => patchLineItem({ csiSection: event.target.value })}
            fullWidth
          />
          {hasKnownScopeTemplates ? (
            <>
              <Select
                label="Work Package / Scope"
                value={selectedScopeValue}
                options={scopeSelectOptions}
                onChange={(value) => {
                  if (value === CUSTOM_UNASSIGNED_SCOPE_VALUE) {
                    patchTask({ scopeName: '' });
                    return;
                  }
                  patchTask({ scopeName: value });
                }}
                fullWidth
              />
              {showCustomScopeInput ? (
                <Input
                  label="Custom work package name"
                  value={task.scopeName ?? ''}
                  onChange={(event) =>
                    patchTask({ scopeName: normalizeScopeName(event.target.value) })
                  }
                  fullWidth
                />
              ) : null}
            </>
          ) : (
            <Input
              label="Work Package / Scope"
              value={task.scopeName ?? ''}
              onChange={(event) =>
                patchTask({ scopeName: normalizeScopeName(event.target.value) })
              }
              fullWidth
            />
          )}
          <Input
            label="Activity code"
            value={task.activityCode ?? ''}
            placeholder="03-01-02"
            onChange={(event) => {
              const next = {
                ...draft,
                task: { ...task, activityCode: event.target.value.trim() },
              };
              onChange(syncActivityCodeFromParsedManualCode(next, [next]));
            }}
            fullWidth
          />
          <Input
            label="Activity name"
            value={task.title}
            onChange={(event) => patchTask({ title: event.target.value })}
            fullWidth
          />
          <Input
            label="Trade"
            value={task.trade ?? ''}
            onChange={(event) => patchTask({ trade: event.target.value })}
            fullWidth
          />
          <Input
            label="Activity type"
            value={task.activity ?? ''}
            onChange={(event) => patchTask({ activity: event.target.value })}
            fullWidth
          />
        </FieldGrid>
        <div>
          <label className={PLANNER_FORM_LABEL}>Activity notes</label>
          <textarea
            className={`mt-1 min-h-[72px] w-full ${PLANNER_INPUT}`}
            value={task.description ?? ''}
            onChange={(event) => patchTask({ description: event.target.value })}
            rows={3}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={PLANNER_SECTION_TITLE}>Schedule logic</h3>
        <FieldGrid>
          <Select
            label="Predecessor activity"
            value={task.predecessorActivityCode ?? ''}
            options={[
              { value: '', label: 'No predecessor' },
              ...predecessorOptions,
            ]}
            onChange={(value) =>
              patchTask({
                predecessorActivityCode: value || undefined,
                relationshipType: (task.relationshipType ?? 'FS') as EstimateRelationshipType,
                lagDays: task.lagDays ?? 0,
              })
            }
            fullWidth
          />
          <Select
            label="Relationship"
            value={task.relationshipType ?? 'FS'}
            options={[...RELATIONSHIP_OPTIONS]}
            onChange={(value) =>
              patchTask({ relationshipType: value as EstimateRelationshipType })
            }
            fullWidth
          />
          <Input
            label="Lag days"
            type="number"
            min={0}
            step={1}
            value={task.lagDays ?? 0}
            onChange={(event) =>
              patchTask({ lagDays: parseEstimateFormNumber(event.target.value) })
            }
            fullWidth
          />
        </FieldGrid>
      </section>

      {formError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
      ) : null}

      <section className="space-y-3">
        <h3 className={PLANNER_SECTION_TITLE}>Quantity</h3>
        <FieldGrid>
          <Input
            label="Quantity"
            type="number"
            min={0}
            step="any"
            value={task.lineItem.quantity.quantity ?? 0}
            onChange={(event) =>
              patchQuantity({ quantity: parseEstimateFormNumber(event.target.value) })
            }
            fullWidth
          />
          <ConstructionUnitCombobox
            label="Unit"
            value={draft.unit}
            onChange={(unit) => onChange({ ...draft, unit })}
            fullWidth
          />
          <Input
            label="Waste %"
            type="number"
            min={0}
            max={100}
            step="any"
            value={task.lineItem.quantity.wastePercent ?? 0}
            onChange={(event) =>
              patchQuantity({ wastePercent: parseEstimateFormNumber(event.target.value) })
            }
            fullWidth
          />
        </FieldGrid>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={PLANNER_SECTION_TITLE}>Labor</h3>
          <button
            type="button"
            aria-label="Open labor field definitions"
            className="rounded-full p-1 text-slate-400 transition-colors hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            onClick={() => setLaborHelpOpen(true)}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        <LaborFieldDefinitionsModal
          isOpen={laborHelpOpen}
          onClose={() => setLaborHelpOpen(false)}
        />
        <FieldGrid>
          <div>
            <FieldLabelWithTooltip
              htmlFor="production-rate"
              label="Production rate"
              tooltip={laborTooltip('production_rate')}
            />
            <Input
              id="production-rate"
              type="number"
              min={0}
              step="any"
              value={labor.productionRate ?? 0}
              onChange={(event) =>
                patchLabor({ productionRate: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="production-rate-type"
              label="Production rate type"
              tooltip={laborTooltip('production_rate_type')}
            />
            <Select
              id="production-rate-type"
              value={labor.productionRateType ?? 'units_per_labor_hour'}
              options={PRODUCTION_RATE_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) => patchLabor({ productionRateType: value as ProductionRateType })}
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="crew-size"
              label="Crew size"
              tooltip={laborTooltip('crew_size')}
            />
            <Input
              id="crew-size"
              type="number"
              min={0}
              step="any"
              value={labor.crewSize ?? 0}
              onChange={(event) =>
                patchLabor({ crewSize: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="hours-per-day"
              label="Hours per day"
              tooltip={laborTooltip('hours_per_day')}
            />
            <Input
              id="hours-per-day"
              type="number"
              min={0}
              step="any"
              value={labor.hoursPerDay ?? 8}
              onChange={(event) =>
                patchLabor({ hoursPerDay: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="labor-rate"
              label="Labor rate"
              tooltip={laborTooltip('labor_rate')}
            />
            <Input
              id="labor-rate"
              type="number"
              min={0}
              step="any"
              value={labor.laborRate ?? 0}
              onChange={(event) =>
                patchLabor({ laborRate: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="burden-percent"
              label="Burden %"
              tooltip={laborTooltip('burden_percent')}
            />
            <Input
              id="burden-percent"
              type="number"
              min={0}
              max={100}
              step="any"
              value={labor.burdenPercent ?? 0}
              onChange={(event) =>
                patchLabor({ burdenPercent: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="difficulty-factor"
              label="Difficulty factor"
              tooltip={laborTooltip('difficulty_factor')}
            />
            <Input
              id="difficulty-factor"
              type="number"
              min={0}
              step="any"
              value={labor.difficultyFactor ?? 1}
              onChange={(event) =>
                patchLabor({ difficultyFactor: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
          <div>
            <FieldLabelWithTooltip
              htmlFor="location-factor"
              label="Location factor"
              tooltip={laborTooltip('location_factor')}
            />
            <Input
              id="location-factor"
              type="number"
              min={0}
              step="any"
              value={labor.locationFactor ?? 1}
              onChange={(event) =>
                patchLabor({ locationFactor: parseEstimateFormNumber(event.target.value) })
              }
              fullWidth
            />
          </div>
        </FieldGrid>
      </section>

      <section className="space-y-3">
        <h3 className={PLANNER_SECTION_TITLE}>Direct costs</h3>
        <FieldGrid>
          <Input
            label="Material cost"
            type="number"
            min={0}
            step="any"
            value={task.lineItem.material?.unitCost ?? 0}
            onChange={(event) => patchMaterial(parseEstimateFormNumber(event.target.value))}
            fullWidth
          />
          <Input
            label="Equipment cost"
            type="number"
            min={0}
            step="any"
            value={task.lineItem.equipment?.rate ?? 0}
            onChange={(event) => patchEquipment(parseEstimateFormNumber(event.target.value))}
            fullWidth
          />
          <Input
            label="Subcontractor cost"
            type="number"
            min={0}
            step="any"
            value={task.lineItem.subcontractor?.cost ?? 0}
            onChange={(event) => patchSubcontractor(parseEstimateFormNumber(event.target.value))}
            fullWidth
          />
        </FieldGrid>
      </section>

      <section className="space-y-3">
        <h3 className={PLANNER_SECTION_TITLE}>Schedule flags</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
          <CheckboxField
            label="Include in schedule"
            checked={task.scheduleEnabled}
            onChange={(checked) => patchTask({ scheduleEnabled: checked })}
          />
          <CheckboxField
            label="Weather-sensitive activity"
            checked={task.weatherSensitive}
            onChange={(checked) => patchTask({ weatherSensitive: checked })}
          />
          <CheckboxField
            label="Inspection required"
            checked={task.inspectionRequired}
            onChange={(checked) => patchTask({ inspectionRequired: checked })}
          />
        </div>
      </section>
    </div>
  );
}
