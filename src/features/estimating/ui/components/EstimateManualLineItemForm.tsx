import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import ConstructionUnitCombobox from './ConstructionUnitCombobox';
import MasterActivityCombobox from './MasterActivityCombobox';
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
import type {
  EstimateActivityType,
  EstimateRelationshipType,
} from '../../domain/estimateTypes';
import { applyMasterActivityToDraftLine } from '../../application/estimateActivityCoding';
import type { MasterActivityDefaultField } from '../../application/estimateActivityCoding';
import { getMasterActivityByCode } from '../../data/masterActivityIndex';
import { getProductionRateDefaultsForActivity } from '../../data/productionRates';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';
import { PRODUCTION_RATE_REFERENCE_NOTE } from '../../data/productionRates/mapToLibraryEntry';
import { parseWorkElementFromProductionRateKey } from '../../data/productionRates/productionRateDisplayFormatters';

const ProductionRateLibraryModal = lazy(() => import('./ProductionRateLibraryModal'));
import { getCsiDivisionByCode } from '../../domain/csiDivisions';
import { parseEstimateFormNumber } from '../estimateFormDefaults';
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

const ACTIVITY_TYPE_OPTIONS: Array<{ value: EstimateActivityType; label: string }> = [
  { value: 'work', label: 'Work' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'curing_lag', label: 'Curing lag' },
  { value: 'procurement_lead_time', label: 'Procurement lead time' },
  { value: 'testing', label: 'Testing' },
];

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
  const [productionLibraryOpen, setProductionLibraryOpen] = useState(false);
  const touchedDefaultFieldsRef = useRef<Set<MasterActivityDefaultField>>(new Set());
  const { task } = draft;
  const labor = task.lineItem.labor ?? {};

  useEffect(() => {
    touchedDefaultFieldsRef.current.clear();
  }, [draft.clientId]);

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

  const patchLabor = (
    patch: Partial<NonNullable<EstimateDraftLine['task']['lineItem']['labor']>>,
    touchedField?: MasterActivityDefaultField,
  ) => {
    if (touchedField) {
      touchedDefaultFieldsRef.current.add(touchedField);
    }
    patchLineItem({
      labor: { ...labor, ...patch, productionRateType: 'labor_hours_per_unit' },
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

  const isCustomMode = task.isCustomActivity === true;
  const selectedMaster = getMasterActivityByCode(task.masterActivityCode);
  const masterDisplayCode = task.displayCode ?? task.activityCode ?? '';
  const selectedProductionDefaults = getProductionRateDefaultsForActivity(
    selectedMaster?.activityCode ?? task.masterActivityCode ?? task.displayCode ?? task.activityCode,
  );
  const showProductionDefaultsNote =
    selectedProductionDefaults != null &&
    Math.abs((labor.productionRate ?? 0) - selectedProductionDefaults.productionRate) < 0.000001;

  const applyProductionRateEntry = (entry: ProductionRateLibraryEntry) => {
    patchLabor({
      productionRate: entry.manHoursPerUnit ?? 0,
      ntrpProductionRateId: entry.id,
      productionRateSourceFigure: entry.figure,
      productionRateSourcePage: entry.sourcePage,
      crewSize: entry.crewSize ?? labor.crewSize,
    });
    if (entry.unitOfMeasure) {
      onChange({ ...draft, unit: entry.unitOfMeasure });
    }
  };

  const selectMaster = (activityCode: string) => {
    const master = getMasterActivityByCode(activityCode);
    if (!master) return;
    onChange(
      applyMasterActivityToDraftLine(draft, master, task.activityInstance ?? 1, {
        touchedFields: touchedDefaultFieldsRef.current,
      }),
    );
  };

  const enterCustomMode = () => {
    onChange({
      ...draft,
      task: {
        ...task,
        isCustomActivity: true,
        masterActivityCode: undefined,
        activityInstance: 1,
        displayCode: undefined,
        activityType: task.activityType ?? 'work',
      },
    });
  };

  const enterMasterMode = () => {
    onChange({
      ...draft,
      task: {
        ...task,
        isCustomActivity: false,
      },
    });
  };

  const clearMasterSelection = () => {
    onChange({
      ...draft,
      task: {
        ...task,
        masterActivityCode: undefined,
        activityCode: undefined,
        displayCode: undefined,
        activityInstance: undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={PLANNER_SECTION_TITLE}>Identity</h3>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs dark:border-slate-600">
            <button
              type="button"
              className={`px-3 py-1 ${
                !isCustomMode
                  ? 'bg-cyan-600 text-white'
                  : 'bg-transparent text-slate-600 dark:text-slate-300'
              }`}
              onClick={enterMasterMode}
            >
              From master
            </button>
            <button
              type="button"
              className={`px-3 py-1 ${
                isCustomMode
                  ? 'bg-cyan-600 text-white'
                  : 'bg-transparent text-slate-600 dark:text-slate-300'
              }`}
              onClick={enterCustomMode}
            >
              + Custom activity
            </button>
          </div>
        </div>

        {!isCustomMode ? (
          <div className="space-y-3">
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
            <MasterActivityCombobox
              label="Activity"
              value={selectedMaster ?? null}
              divisionCode={isKnownCsiDivision(selectedDivisionValue) ? normalizedDivision : null}
              onSelect={(activity) => selectMaster(activity.activityCode)}
            />

            {selectedMaster ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {masterDisplayCode}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-cyan-700 hover:underline dark:text-cyan-300"
                    onClick={clearMasterSelection}
                  >
                    Change activity
                  </button>
                </div>
                <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                  {selectedMaster.title}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <dt className="inline font-medium">Work package: </dt>
                    <dd className="inline">{selectedMaster.workPackageName}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Trade: </dt>
                    <dd className="inline">{selectedMaster.primaryTrade}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Type: </dt>
                    <dd className="inline">{selectedMaster.activityType}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Category: </dt>
                    <dd className="inline">{selectedMaster.sequencingCategory}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select a standard activity. Its code, name, work package, and trade are fixed by the
                master and will not change with add order.
              </p>
            )}
          </div>
        ) : (
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
            <Select
              label="Activity type"
              value={task.activityType ?? 'work'}
              options={ACTIVITY_TYPE_OPTIONS}
              onChange={(value) => patchTask({ activityType: value as EstimateActivityType })}
              fullWidth
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
              Custom activities are marked CUSTOM and receive a reserved DD-99-XX code on save.
            </p>
          </FieldGrid>
        )}

        <div>
          <label className={PLANNER_FORM_LABEL}>Custom scope notes</label>
          <textarea
            className={`mt-1 min-h-[72px] w-full ${PLANNER_INPUT}`}
            value={task.description ?? ''}
            onChange={(event) => patchTask({ description: event.target.value })}
            rows={3}
            placeholder="Project-specific details (does not change the official activity name or code)."
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
            onChange={(unit) => {
              touchedDefaultFieldsRef.current.add('unit');
              onChange({ ...draft, unit });
            }}
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
          <div className="sm:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <FieldLabelWithTooltip
                htmlFor="production-rate"
                label="Man-hours per unit"
                tooltip={laborTooltip('production_rate')}
              />
              <button
                type="button"
                onClick={() => setProductionLibraryOpen(true)}
                className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
              >
                Browse production rates
              </button>
            </div>
            <Input
              id="production-rate"
              type="number"
              min={0}
              step="any"
              value={labor.productionRate ?? 0}
              onChange={(event) =>
                patchLabor(
                  { productionRate: parseEstimateFormNumber(event.target.value) },
                  'productionRate',
                )
              }
              fullWidth
            />
            {labor.ntrpProductionRateId ? (
              <p className="mt-1 text-xs text-cyan-300/90">
                {(() => {
                  const parsed = parseWorkElementFromProductionRateKey(labor.ntrpProductionRateId ?? '');
                  if (parsed.workElementNumber) {
                    const parts = [`Work Element ${parsed.workElementNumber}`];
                    if (parsed.workElementLineNumber) {
                      parts.push(`Line ${parsed.workElementLineNumber}`);
                    }
                    return parts.join(' · ');
                  }
                  return labor.ntrpProductionRateId;
                })()}
              </p>
            ) : null}
            {showProductionDefaultsNote && selectedProductionDefaults ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Loaded from {selectedProductionDefaults.sourceCsiCode} —{' '}
                {selectedProductionDefaults.sourceDescription}
              </p>
            ) : null}
            {labor.ntrpProductionRateId ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{PRODUCTION_RATE_REFERENCE_NOTE}</p>
            ) : null}
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
                patchLabor({ crewSize: parseEstimateFormNumber(event.target.value) }, 'crewSize')
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

      {productionLibraryOpen ? (
        <Suspense fallback={null}>
          <ProductionRateLibraryModal
            isOpen
            onClose={() => setProductionLibraryOpen(false)}
            onSelect={applyProductionRateEntry}
            initialDivisionCode={normalizedDivision || undefined}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
