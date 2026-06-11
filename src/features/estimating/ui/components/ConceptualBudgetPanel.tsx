import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Modal from '../../../../components/ui/Modal';
import type { ConceptualEstimateController } from '../hooks/useConceptualEstimate';
import type { ConceptualLineItemType } from '../../domain/conceptualEstimateTypes';
import { getCsiDivisionByCode } from '../../domain/csiDivisions';
import ConceptualLineItemFormModal, {
  formValuesToLineItemPatch,
  LINE_ITEM_TYPE_LABELS,
  type ConceptualLineItemFormValues,
} from './ConceptualLineItemFormModal';
import EstimateSummaryCard from './EstimateSummaryCard';
import {
  formatEstimateCurrency,
} from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';
import { DESIGN_STAGES } from '../../domain/conceptualEstimateTypes';

export const CONCEPTUAL_BUDGET_EMPTY_TITLE = 'Build a conceptual budget';
export const CONCEPTUAL_BUDGET_EMPTY_BODY =
  'Start with square-foot pricing, division budgets, allowances, unit-cost items, or lump-sum scope.';
export const CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL = 'Add Square-Foot Model';
export const CONCEPTUAL_BUDGET_ADD_TOOLBAR_MARKER = 'conceptual-budget-add-toolbar';

interface Props {
  controller: ConceptualEstimateController;
  disabled?: boolean;
  lastUpdated?: string | null;
}

function formatConfidenceLabel(level: string): string {
  if (level === 'high') return 'High';
  if (level === 'medium') return 'Medium';
  return 'Low';
}

interface AddToolbarProps {
  disabled: boolean;
  onAdd: (type: ConceptualLineItemType) => void;
}

export function ConceptualBudgetAddToolbar({ disabled, onAdd }: AddToolbarProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid={CONCEPTUAL_BUDGET_ADD_TOOLBAR_MARKER}
    >
      <Button disabled={disabled} onClick={() => onAdd('square_foot')}>
        {CONCEPTUAL_BUDGET_ADD_SQUARE_FOOT_LABEL}
      </Button>
      <Button disabled={disabled} variant="secondary" onClick={() => onAdd('division_budget')}>
        Add Division Budget
      </Button>
      <Button disabled={disabled} variant="secondary" onClick={() => onAdd('allowance')}>
        Add Allowance
      </Button>
      <Button disabled={disabled} variant="secondary" onClick={() => onAdd('unit_cost')}>
        Add Unit Cost Item
      </Button>
      <Button disabled={disabled} variant="secondary" onClick={() => onAdd('lump_sum')}>
        Add Lump Sum Item
      </Button>
    </div>
  );
}

export default function ConceptualBudgetPanel({
  controller,
  disabled = false,
  lastUpdated = null,
}: Props) {
  const { payload, rollup, addLineItem, updateLineItem, deleteLineItem, updateRevision } =
    controller;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ConceptualLineItemType>('lump_sum');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  const editingItem = editingId
    ? payload.lineItems.find((item) => item.id === editingId) ?? null
    : null;
  const isEmpty = payload.lineItems.length === 0;

  const openAddModal = (type: ConceptualLineItemType) => {
    setEditingId(null);
    setModalType(type);
    setModalOpen(true);
  };

  const handleSaveLineItem = (
    type: ConceptualLineItemType,
    values: ConceptualLineItemFormValues,
    editingItemId?: string,
  ) => {
    const division = values.divisionCode
      ? getCsiDivisionByCode(values.divisionCode)
      : null;
    const patch = formValuesToLineItemPatch(values, division?.name ?? null);
    if (editingItemId) {
      updateLineItem(editingItemId, patch);
      return;
    }
    addLineItem(type, { ...patch, title: patch.title ?? values.title });
  };

  const overheadProfit = rollup.overhead + rollup.profit;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border border-slate-200 p-4 dark:border-slate-700 ${PLANNER_FORM_PANEL}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
              Revision
            </p>
            <p className={`mt-1 text-sm font-medium ${TEXT_FOREGROUND}`}>{payload.revision.name}</p>
            <p className={`mt-1 text-sm ${TEXT_BODY}`}>
              {payload.revision.date} · {payload.revision.designStage.replace(/_/g, ' ')}
            </p>
            {payload.revision.basisOfEstimate ? (
              <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>{payload.revision.basisOfEstimate}</p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => setRevisionModalOpen(true)}
          >
            Edit revision
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <EstimateSummaryCard
          label="Conceptual total"
          value={formatEstimateCurrency(rollup.finalSellPrice)}
          emphasis
        />
        <EstimateSummaryCard label="Subtotal" value={formatEstimateCurrency(rollup.subtotal)} />
        <EstimateSummaryCard
          label="Contingency"
          value={formatEstimateCurrency(rollup.contingencyAmount)}
        />
        <EstimateSummaryCard
          label="Overhead / profit"
          value={formatEstimateCurrency(overheadProfit)}
        />
        <EstimateSummaryCard
          label="Confidence"
          value={formatConfidenceLabel(rollup.aggregateConfidence)}
        />
        <EstimateSummaryCard
          label="Last updated"
          value={lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not saved yet'}
        />
      </div>

      {isEmpty ? (
        <div
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 dark:border-slate-600 dark:bg-slate-800/40 sm:px-6"
          data-testid="conceptual-budget-empty-state"
        >
          <p className={`text-base font-semibold ${TEXT_FOREGROUND}`}>{CONCEPTUAL_BUDGET_EMPTY_TITLE}</p>
          <p className={`mt-2 text-sm ${TEXT_BODY}`}>{CONCEPTUAL_BUDGET_EMPTY_BODY}</p>
          <div className="mt-4">
            <ConceptualBudgetAddToolbar disabled={disabled} onAdd={openAddModal} />
          </div>
        </div>
      ) : (
        <>
          <ConceptualBudgetAddToolbar disabled={disabled} onAdd={openAddModal} />
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Title</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Confidence</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payload.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 capitalize">{LINE_ITEM_TYPE_LABELS[item.type]}</td>
                    <td className="px-3 py-2">{item.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEstimateCurrency(item.amount)}
                    </td>
                    <td className="px-3 py-2 capitalize">{item.confidenceLevel}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={disabled}
                          onClick={() => {
                            setEditingId(item.id);
                            setModalType(item.type);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={disabled}
                          onClick={() => deleteLineItem(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConceptualLineItemFormModal
        open={modalOpen}
        initialType={modalType}
        editingItem={editingItem}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        onSave={handleSaveLineItem}
      />

      <Modal
        isOpen={revisionModalOpen}
        onClose={() => setRevisionModalOpen(false)}
        title="Revision metadata"
        size="md"
      >
        <div className="space-y-3">
          <Input
            label="Revision name"
            value={payload.revision.name}
            onChange={(event) => updateRevision({ name: event.target.value })}
          />
          <Input
            label="Date"
            type="date"
            value={payload.revision.date}
            onChange={(event) => updateRevision({ date: event.target.value })}
          />
          <Select
            label="Design stage"
            value={payload.revision.designStage}
            onChange={(designStage) =>
              updateRevision({
                designStage: designStage as (typeof DESIGN_STAGES)[number],
              })
            }
            options={DESIGN_STAGES.map((stage) => ({
              value: stage,
              label: stage.replace(/_/g, ' '),
            }))}
          />
          <Input
            label="Basis of estimate"
            value={payload.revision.basisOfEstimate ?? ''}
            onChange={(event) => updateRevision({ basisOfEstimate: event.target.value })}
          />
          <Input
            label="Notes"
            value={payload.revision.notes ?? ''}
            onChange={(event) => updateRevision({ notes: event.target.value })}
          />
          <div className="flex justify-end">
            <Button onClick={() => setRevisionModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
