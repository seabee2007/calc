import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../../../components/ui/ModalShell';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Button from '../../../../components/ui/Button';
import {
  CONFIDENCE_LEVELS,
  DESIGN_STAGES,
  SOURCE_BASIS_VALUES,
  SYSTEM_CATEGORIES,
  type ConceptualEstimateLineItem,
  type ConceptualLineItemType,
  type ConfidenceLevel,
  type SourceBasis,
  type SystemCategory,
} from '../../domain/conceptualEstimateTypes';
import { calculateConceptualLineItemAmount } from '../../application/conceptualEstimateCalculations';
import { getCsiDivisionOptions } from '../../domain/csiDivisions';
import { formatEstimateCurrency } from '../estimateFormatters';
import { PLANNER_FORM_LABEL, PLANNER_INPUT } from '../../../../components/planner/plannerTheme';

export interface ConceptualLineItemFormValues {
  type: ConceptualLineItemType;
  title: string;
  description: string;
  divisionCode: string;
  systemCategory: SystemCategory;
  quantity: string;
  unit: string;
  unitCost: string;
  amount: string;
  confidenceLevel: ConfidenceLevel;
  sourceBasis: SourceBasis;
  escalationPercent: string;
  notes: string;
}

const LINE_ITEM_TYPE_LABELS: Record<ConceptualLineItemType, string> = {
  square_foot: 'Square-Foot Model',
  division_budget: 'Division Budget',
  system_budget: 'System Budget',
  unit_cost: 'Unit Cost Item',
  lump_sum: 'Lump Sum',
  allowance: 'Allowance',
};

function defaultValuesForType(type: ConceptualLineItemType): ConceptualLineItemFormValues {
  return {
    type,
    title: '',
    description: '',
    divisionCode: '',
    systemCategory: 'other',
    quantity: '',
    unit: type === 'square_foot' ? 'SF' : '',
    unitCost: '',
    amount: '',
    confidenceLevel: 'medium',
    sourceBasis: 'estimator_judgment',
    escalationPercent: '',
    notes: '',
  };
}

function valuesFromItem(item: ConceptualEstimateLineItem): ConceptualLineItemFormValues {
  return {
    type: item.type,
    title: item.title,
    description: item.description ?? '',
    divisionCode: item.divisionCode ?? '',
    systemCategory: item.systemCategory ?? 'other',
    quantity: item.quantity != null ? String(item.quantity) : '',
    unit: item.unit ?? '',
    unitCost: item.unitCost != null ? String(item.unitCost) : '',
    amount: item.amount != null ? String(item.amount) : '',
    confidenceLevel: item.confidenceLevel,
    sourceBasis: item.sourceBasis ?? 'estimator_judgment',
    escalationPercent:
      item.escalationPercent != null ? String(item.escalationPercent) : '',
    notes: item.notes ?? '',
  };
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

interface Props {
  open: boolean;
  initialType?: ConceptualLineItemType;
  editingItem?: ConceptualEstimateLineItem | null;
  onClose: () => void;
  onSave: (
    type: ConceptualLineItemType,
    values: ConceptualLineItemFormValues,
    editingId?: string,
  ) => void;
}

export default function ConceptualLineItemFormModal({
  open,
  initialType = 'lump_sum',
  editingItem = null,
  onClose,
  onSave,
}: Props) {
  const [values, setValues] = useState<ConceptualLineItemFormValues>(() =>
    editingItem ? valuesFromItem(editingItem) : defaultValuesForType(initialType),
  );

  useEffect(() => {
    if (!open) return;
    setValues(
      editingItem ? valuesFromItem(editingItem) : defaultValuesForType(initialType),
    );
  }, [open, editingItem, initialType]);

  const divisionOptions = useMemo(
    () => [{ value: '', label: 'Select division' }, ...getCsiDivisionOptions()],
    [],
  );

  const previewAmount = useMemo(() => {
    return calculateConceptualLineItemAmount(
      values.type,
      parseOptionalNumber(values.quantity),
      parseOptionalNumber(values.unitCost),
      parseOptionalNumber(values.amount),
    );
  }, [values]);

  const showQuantityFields = values.type === 'square_foot' || values.type === 'unit_cost';
  const showDivisionField =
    values.type === 'division_budget' || values.type === 'system_budget';
  const showSystemField = values.type === 'system_budget';
  const showDirectAmount =
    values.type === 'division_budget' ||
    values.type === 'system_budget' ||
    values.type === 'lump_sum' ||
    values.type === 'allowance';

  const handleSubmit = () => {
    if (!values.title.trim()) return;
    onSave(values.type, values, editingItem?.id);
    onClose();
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      title={editingItem ? 'Edit line item' : `Add ${LINE_ITEM_TYPE_LABELS[values.type]}`}
      size="lg"
      stackAboveDrawer
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!values.title.trim()}>
            {editingItem ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!editingItem ? (
          <Select
            label="Item type"
            value={values.type}
            onChange={(nextType) => {
              setValues(defaultValuesForType(nextType as ConceptualLineItemType));
            }}
            options={Object.entries(LINE_ITEM_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        ) : null}

        <Input
          label="Title"
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          className={PLANNER_INPUT}
        />

        <Input
          label="Description"
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          className={PLANNER_INPUT}
        />

        {showDivisionField ? (
          <Select
            label="Division"
            value={values.divisionCode}
            onChange={(divisionCode) => {
              setValues((current) => ({ ...current, divisionCode }));
            }}
            options={divisionOptions}
          />
        ) : null}

        {showSystemField ? (
          <Select
            label="System category"
            value={values.systemCategory}
            onChange={(systemCategory) =>
              setValues((current) => ({
                ...current,
                systemCategory: systemCategory as SystemCategory,
              }))
            }
            options={SYSTEM_CATEGORIES.map((category) => ({
              value: category,
              label: category.replace(/_/g, ' '),
            }))}
          />
        ) : null}

        {showQuantityFields ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={values.type === 'square_foot' ? 'Area (SF)' : 'Quantity'}
              value={values.quantity}
              onChange={(event) =>
                setValues((current) => ({ ...current, quantity: event.target.value }))
              }
              className={PLANNER_INPUT}
            />
            <Input
              label="Unit"
              value={values.unit}
              onChange={(event) =>
                setValues((current) => ({ ...current, unit: event.target.value }))
              }
              className={PLANNER_INPUT}
            />
            <Input
              label={values.type === 'square_foot' ? 'Cost per SF' : 'Unit cost'}
              value={values.unitCost}
              onChange={(event) =>
                setValues((current) => ({ ...current, unitCost: event.target.value }))
              }
              className={PLANNER_INPUT}
            />
          </div>
        ) : null}

        {showDirectAmount ? (
          <Input
            label="Amount"
            value={values.amount}
            onChange={(event) =>
              setValues((current) => ({ ...current, amount: event.target.value }))
            }
            className={PLANNER_INPUT}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Confidence"
            value={values.confidenceLevel}
            onChange={(confidenceLevel) =>
              setValues((current) => ({
                ...current,
                confidenceLevel: confidenceLevel as ConfidenceLevel,
              }))
            }
            options={CONFIDENCE_LEVELS.map((level) => ({ value: level, label: level }))}
          />
          <Select
            label="Source basis"
            value={values.sourceBasis}
            onChange={(sourceBasis) =>
              setValues((current) => ({
                ...current,
                sourceBasis: sourceBasis as SourceBasis,
              }))
            }
            options={SOURCE_BASIS_VALUES.map((basis) => ({
              value: basis,
              label: basis.replace(/_/g, ' '),
            }))}
          />
        </div>

        <Input
          label="Escalation % (optional)"
          value={values.escalationPercent}
          onChange={(event) =>
            setValues((current) => ({ ...current, escalationPercent: event.target.value }))
          }
          className={PLANNER_INPUT}
        />

        <Input
          label="Notes"
          value={values.notes}
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          className={PLANNER_INPUT}
        />

        <p className={`text-sm ${PLANNER_FORM_LABEL}`}>
          Calculated amount: {formatEstimateCurrency(previewAmount)}
        </p>
      </div>
    </ModalShell>
  );
}

export { LINE_ITEM_TYPE_LABELS, defaultValuesForType };

export function formValuesToLineItemPatch(
  values: ConceptualLineItemFormValues,
  divisionName?: string | null,
): Partial<ConceptualEstimateLineItem> {
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim() || null,
    divisionCode: values.divisionCode || null,
    divisionName: divisionName ?? null,
    systemCategory: values.type === 'system_budget' ? values.systemCategory : null,
    quantity: parseOptionalNumber(values.quantity),
    unit: values.unit.trim() || null,
    unitCost: parseOptionalNumber(values.unitCost),
    amount: parseOptionalNumber(values.amount) ?? 0,
    confidenceLevel: values.confidenceLevel,
    sourceBasis: values.sourceBasis,
    escalationPercent: parseOptionalNumber(values.escalationPercent),
    notes: values.notes.trim() || null,
  };
}
