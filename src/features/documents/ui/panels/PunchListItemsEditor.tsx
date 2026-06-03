import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Button from '../../../../components/ui/Button';
import {
  APP_SECTION_CARD,
  BORDER_DEFAULT,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../../theme/appTheme';
import type { QuestionnaireMode } from '../../types';
import {
  CATEGORY_OPTIONS,
  ITEM_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../packs/punchList/questions';
import {
  duplicatePunchListItem,
  emptyPunchListItem,
  punchItemHeaderLabel,
  type PunchListItemAnswer,
} from '../../packs/punchList/punchListItemTypes';

interface Props {
  mode: QuestionnaireMode;
  items: PunchListItemAnswer[];
  onChange: (items: PunchListItemAnswer[]) => void;
}

function modeAtLeast(current: QuestionnaireMode, required: QuestionnaireMode): boolean {
  const order: QuestionnaireMode[] = ['quick', 'standard', 'advanced'];
  return order.indexOf(current) >= order.indexOf(required);
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function PunchListItemsEditor({ mode, items, onChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const update = (index: number, patch: Partial<PunchListItemAnswer>) => {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isExpanded = (id: string) => expanded[id] !== false;

  return (
    <div className={APP_SECTION_CARD}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>
            Punch List Items / Discrepancies
          </h2>
          <p className={`mt-1 text-xs ${TEXT_MUTED}`}>
            Add each deficiency or punch item. All items save with the document draft.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => onChange([...items, emptyPunchListItem()])}
        >
          Add Discrepancy
        </Button>
      </div>

      {items.length === 0 ? (
        <p className={`text-sm ${TEXT_MUTED}`}>
          No discrepancies yet. Use Add Discrepancy to record punch items.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item, index) => {
          const open = isExpanded(item.id);
          return (
            <div
              key={item.id}
              className={`rounded-lg border ${BORDER_DEFAULT} bg-white shadow-sm dark:bg-slate-800/40`}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left sm:px-4"
                onClick={() => toggleExpanded(item.id)}
                aria-expanded={open}
              >
                <span className={`text-sm font-medium ${TEXT_FOREGROUND}`}>
                  {punchItemHeaderLabel(item)}
                </span>
                {open ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                )}
              </button>

              {open ? (
                <div className="space-y-3 border-t border-slate-200 px-3 pb-4 pt-3 dark:border-slate-700 sm:px-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Item Number"
                      value={item.itemNumber}
                      onChange={(e) => update(index, { itemNumber: e.target.value })}
                      fullWidth
                    />
                    <Input
                      label="Location / Area"
                      value={item.locationArea}
                      onChange={(e) => update(index, { locationArea: e.target.value })}
                      fullWidth
                    />
                  </div>
                  <Input
                    label="Discrepancy Description"
                    value={item.description}
                    onChange={(e) => update(index, { description: e.target.value })}
                    fullWidth
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Responsible Party"
                      value={item.responsibleParty}
                      onChange={(e) => update(index, { responsibleParty: e.target.value })}
                      fullWidth
                    />
                    <Select
                      label="Priority"
                      options={[{ value: '', label: 'Select…' }, ...PRIORITY_OPTIONS]}
                      value={item.priority}
                      onChange={(v) => update(index, { priority: v })}
                      fullWidth
                    />
                    <Select
                      label="Status"
                      options={[{ value: '', label: 'Select…' }, ...ITEM_STATUS_OPTIONS]}
                      value={item.status}
                      onChange={(v) => update(index, { status: v })}
                      fullWidth
                    />
                    <Input
                      label="Due Date"
                      value={item.dueDate}
                      onChange={(e) => update(index, { dueDate: e.target.value })}
                      fullWidth
                    />
                  </div>

                  {modeAtLeast(mode, 'standard') ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                          label="Category"
                          options={[{ value: '', label: 'Select…' }, ...CATEGORY_OPTIONS]}
                          value={item.category}
                          onChange={(v) => update(index, { category: v })}
                          fullWidth
                        />
                        <Input
                          label="Trade"
                          value={item.trade}
                          onChange={(e) => update(index, { trade: e.target.value })}
                          fullWidth
                        />
                      </div>
                      <Input
                        label="Corrective Action Required"
                        value={item.correctiveAction}
                        onChange={(e) => update(index, { correctiveAction: e.target.value })}
                        fullWidth
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          label="Completion Date"
                          value={item.completionDate}
                          onChange={(e) => update(index, { completionDate: e.target.value })}
                          fullWidth
                        />
                        <Input
                          label="Verified By"
                          value={item.verifiedBy}
                          onChange={(e) => update(index, { verifiedBy: e.target.value })}
                          fullWidth
                        />
                        <Input
                          label="Verification Date"
                          value={item.verificationDate}
                          onChange={(e) => update(index, { verificationDate: e.target.value })}
                          fullWidth
                        />
                      </div>
                    </>
                  ) : null}

                  {modeAtLeast(mode, 'advanced') ? (
                    <>
                      <Input
                        label="Owner Comment"
                        value={item.ownerComment}
                        onChange={(e) => update(index, { ownerComment: e.target.value })}
                        fullWidth
                      />
                      <Input
                        label="Contractor Response"
                        value={item.contractorResponse}
                        onChange={(e) => update(index, { contractorResponse: e.target.value })}
                        fullWidth
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          label="Cost Impact"
                          value={item.costImpact}
                          onChange={(e) => update(index, { costImpact: e.target.value })}
                          fullWidth
                        />
                        <Input
                          label="Schedule Impact"
                          value={item.scheduleImpact}
                          onChange={(e) => update(index, { scheduleImpact: e.target.value })}
                          fullWidth
                        />
                      </div>
                      <Input
                        label="Photo References"
                        value={item.photoReferences}
                        onChange={(e) => update(index, { photoReferences: e.target.value })}
                        fullWidth
                      />
                      <Input
                        label="Attachment Notes"
                        value={item.attachmentNotes}
                        onChange={(e) => update(index, { attachmentNotes: e.target.value })}
                        fullWidth
                      />
                    </>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => {
                        const dup = duplicatePunchListItem(item);
                        const next = [...items];
                        next.splice(index + 1, 0, dup);
                        onChange(next);
                        setExpanded((prev) => ({ ...prev, [dup.id]: true }));
                      }}
                    >
                      Duplicate
                    </Button>
                    {index > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onChange(swap(items, index, index - 1))}
                      >
                        Move up
                      </Button>
                    ) : null}
                    {index < items.length - 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onChange(swap(items, index, index + 1))}
                      >
                        Move down
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => onChange(items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
