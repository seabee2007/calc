import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, MoreHorizontal, Plus, RotateCcw, Save, XCircle } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  BORDER_DEFAULT,
  FORM_INPUT_PLANNER,
  FOCUS_RING,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../../theme/appTheme';
import type { CompanyLaborRate, CompanyLaborRateInput } from '../../domain/laborRateTypes';
import { useCompanyLaborRates } from '../hooks/useCompanyLaborRates';

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function slugifyRoleKey(roleName: string): string {
  return roleName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface DraftRow {
  roleKey: string;
  roleName: string;
  tradeCategory: string;
  hourlyRate: string;
  burdenPercent: string;
  billingRate: string;
  isDefault: boolean;
}

function toDraft(rate: CompanyLaborRate): DraftRow {
  return {
    roleKey: rate.roleKey,
    roleName: rate.roleName,
    tradeCategory: rate.tradeCategory,
    hourlyRate: String(rate.hourlyRate),
    burdenPercent: String(rate.burdenPercent),
    billingRate: String(rate.billingRate),
    isDefault: rate.isDefault,
  };
}

function draftMatchesRate(draft: DraftRow, rate: CompanyLaborRate): boolean {
  const baseline = toDraft(rate);
  return (
    draft.roleKey === baseline.roleKey &&
    draft.roleName === baseline.roleName &&
    draft.tradeCategory === baseline.tradeCategory &&
    draft.hourlyRate === baseline.hourlyRate &&
    draft.burdenPercent === baseline.burdenPercent &&
    draft.billingRate === baseline.billingRate &&
    draft.isDefault === baseline.isDefault
  );
}

function buildSaveInput(rate: CompanyLaborRate, draft: DraftRow): CompanyLaborRateInput {
  return {
    id: rate.id,
    userId: rate.userId,
    roleKey: draft.roleKey.trim() || rate.roleKey,
    roleName: draft.roleName.trim(),
    tradeCategory: draft.tradeCategory.trim() || 'General',
    hourlyRate: Number(draft.hourlyRate) || 0,
    burdenPercent: Number(draft.burdenPercent) || 0,
    billingRate: Number(draft.billingRate) || 0,
    isDefault: draft.isDefault,
    isActive: true,
  };
}

const TABLE_INPUT_CLASS = `${FORM_INPUT_PLANNER} py-1.5`;
const TABLE_TEXT_INPUT_CLASS =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-900 outline-none transition-colors hover:border-slate-200 hover:bg-white focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500/50 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus:border-cyan-500 dark:focus:bg-slate-900';
const TABLE_NUMBER_INPUT_CLASS =
  'no-number-spinner w-20 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums text-slate-900 outline-none transition-colors hover:border-slate-200 hover:bg-white focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500/50 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus:border-cyan-500 dark:focus:bg-slate-900';
const TABLE_HEADER_NUMERIC_CLASS = 'px-3 py-2 text-right';
const TABLE_CELL_NUMERIC_CLASS = 'px-3 py-2 text-right tabular-nums';
const MENU_WIDTH_PX = 160;

type EditableTextField = 'roleName' | 'tradeCategory';
type EditingCell = { rateId: string; field: EditableTextField } | null;

interface ExternalStepperNumberInputProps {
  value: string;
  min?: number;
  step?: number | 'any';
  onChange: (value: string) => void;
}

function formatSteppedValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function ExternalStepperNumberInput({ value, min = 0, step = 'any', onChange }: ExternalStepperNumberInputProps) {
  const resolvedStep = step === 'any' ? 1 : step;
  const bumpValue = (direction: 1 | -1) => {
    const current = Number(value);
    const baseline = Number.isFinite(current) ? current : min;
    const next = Math.max(min, baseline + resolvedStep * direction);
    onChange(formatSteppedValue(next));
  };

  return (
    <div className="group inline-flex items-center justify-end gap-1">
      <input
        type="number"
        min={min}
        step={step}
        className={TABLE_NUMBER_INPUT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex h-8 flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          aria-label="Increase value"
          className="flex h-4 w-5 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={() => bumpValue(1)}
        >
          <ChevronUp className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Decrease value"
          className="flex h-4 w-5 items-center justify-center border-t border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={() => bumpValue(-1)}
        >
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface RowActionsMenuProps {
  disabled?: boolean;
  onDisable: () => void;
}

function RowActionsMenu({ disabled = false, onDisable }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const updateMenuPosition = useCallback(() => {
    const anchor = wrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(rect.right - MENU_WIDTH_PX, window.innerWidth - MENU_WIDTH_PX - margin));
    let top = rect.bottom + margin;
    const menuHeight = menuRef.current?.offsetHeight ?? 44;
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - margin);
    }
    setMenuPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
        onClick={() => {
          if (disabled) return;
          setOpen(false);
          onDisable();
        }}
      >
        <XCircle className="h-4 w-4" aria-hidden />
        Disable
      </button>
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className={`${FOCUS_RING} inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100`}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}

export default function LaborRateLibrarySection({ hideTitle = false }: { hideTitle?: boolean }) {
  const { rates, loading, saving, error, saveRate, disableRate, seedDefaults } = useCompanyLaborRates();
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [adding, setAdding] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<DraftRow>({
    roleKey: '',
    roleName: '',
    tradeCategory: 'General',
    hourlyRate: '0',
    burdenPercent: '0',
    billingRate: '0',
    isDefault: false,
  });

  const mergedDrafts = useMemo(() => {
    const next: Record<string, DraftRow> = {};
    for (const rate of rates) {
      next[rate.id] = drafts[rate.id] ?? toDraft(rate);
    }
    return next;
  }, [drafts, rates]);

  const dirtyRateIds = useMemo(
    () =>
      rates
        .filter((rate) => {
          const draft = mergedDrafts[rate.id];
          return draft ? !draftMatchesRate(draft, rate) : false;
        })
        .map((rate) => rate.id),
    [mergedDrafts, rates],
  );

  const handleSaveRow = useCallback(
    async (rate: CompanyLaborRate): Promise<boolean> => {
      const draft = mergedDrafts[rate.id];
      if (!draft) return false;

      const saved = await saveRate(buildSaveInput(rate, draft));
      if (saved) {
        setDrafts((current) => {
          const copy = { ...current };
          delete copy[rate.id];
          return copy;
        });
        setSaveMessage('Labor rates saved.');
        window.setTimeout(() => setSaveMessage(null), 2500);
      }
      return saved;
    },
    [mergedDrafts, saveRate],
  );

  const handleSaveAll = useCallback(async () => {
    for (const rate of rates) {
      if (!dirtyRateIds.includes(rate.id)) continue;
      const saved = await handleSaveRow(rate);
      if (!saved) break;
    }
  }, [dirtyRateIds, handleSaveRow, rates]);

  const handleAddRow = async () => {
    const roleName = newRow.roleName.trim();
    if (!roleName) return;

    const roleKey = slugifyRoleKey(roleName);
    if (!roleKey) return;

    const saved = await saveRate({
      userId: '',
      roleKey,
      roleName,
      tradeCategory: newRow.tradeCategory.trim() || 'General',
      hourlyRate: Number(newRow.hourlyRate) || 0,
      burdenPercent: Number(newRow.burdenPercent) || 0,
      billingRate: Number(newRow.billingRate) || 0,
      isDefault: newRow.isDefault,
      isActive: true,
    });

    if (!saved) return;

    setAdding(false);
    setNewRow({
      roleKey: '',
      roleName: '',
      tradeCategory: 'General',
      hourlyRate: '0',
      burdenPercent: '0',
      billingRate: '0',
      isDefault: false,
    });
    setSaveMessage('Labor role added.');
    window.setTimeout(() => setSaveMessage(null), 2500);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!hideTitle ? (
          <div>
            <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>Labor Rate Library</h2>
            <p className={`mt-1 text-sm ${TEXT_MUTED}`}>
              Company default labor roles and fully burdened rates copied into new projects.
            </p>
          </div>
        ) : null}
        <div className={`flex flex-wrap gap-2 ${hideTitle ? 'w-full justify-end' : ''}`}>
          {dirtyRateIds.length > 0 ? (
            <Button
              variant="primary"
              icon={<Save className="h-4 w-4" aria-hidden />}
              onClick={() => void handleSaveAll()}
              disabled={saving || loading}
            >
              Save {dirtyRateIds.length} change{dirtyRateIds.length === 1 ? '' : 's'}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => setAdding(true)}
            disabled={saving || loading}
          >
            Add Role
          </Button>
          <Button
            variant="secondary"
            icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            onClick={() => void seedDefaults()}
            disabled={saving || loading}
          >
            Reset to Starter Defaults
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-500 dark:text-red-400">{error}</p> : null}
      {saveMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{saveMessage}</p>
      ) : null}
      {loading ? <p className={`text-sm ${TEXT_MUTED}`}>Loading labor rates…</p> : null}

      <div className={`overflow-x-auto rounded-xl border bg-white dark:bg-slate-900 ${BORDER_DEFAULT}`}>
        <table className="min-w-full text-sm">
          <thead
            className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide dark:border-slate-700 dark:bg-slate-800/95 ${TEXT_MUTED}`}
          >
            <tr>
              <th className="min-w-[150px] px-3 py-2">Role</th>
              <th className="min-w-[140px] px-3 py-2">Trade</th>
              <th className={TABLE_HEADER_NUMERIC_CLASS}>Base Rate</th>
              <th className={TABLE_HEADER_NUMERIC_CLASS}>Burden %</th>
              <th className={TABLE_HEADER_NUMERIC_CLASS}>Fully Burdened</th>
              <th className={TABLE_HEADER_NUMERIC_CLASS}>Billing Rate</th>
              <th className="px-3 py-2 text-center">Default</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${TEXT_BODY}`}>
            {rates.map((rate) => {
              const draft = mergedDrafts[rate.id];
              if (!draft) return null;
              const isDirty = !draftMatchesRate(draft, rate);
              const fullyBurdened =
                (Number(draft.hourlyRate) || 0) * (1 + (Number(draft.burdenPercent) || 0) / 100);
              const isEditingRole = editingCell?.rateId === rate.id && editingCell.field === 'roleName';
              const isEditingTrade = editingCell?.rateId === rate.id && editingCell.field === 'tradeCategory';
              return (
                <tr
                  key={rate.id}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/45 ${
                    isDirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <td className={`px-3 py-2 ${TEXT_FOREGROUND}`}>
                    {isEditingRole ? (
                      <input
                        autoFocus
                        className={TABLE_TEXT_INPUT_CLASS}
                        value={draft.roleName}
                        onBlur={() => setEditingCell(null)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [rate.id]: { ...draft, roleName: event.target.value },
                          }))
                        }
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${FOCUS_RING} -ml-2 w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-white hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white`}
                        onClick={() => setEditingCell({ rateId: rate.id, field: 'roleName' })}
                      >
                        {draft.roleName}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditingTrade ? (
                      <input
                        autoFocus
                        className={TABLE_TEXT_INPUT_CLASS}
                        value={draft.tradeCategory}
                        onBlur={() => setEditingCell(null)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [rate.id]: { ...draft, tradeCategory: event.target.value },
                          }))
                        }
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${FOCUS_RING} -ml-2 w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-white hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white`}
                        onClick={() => setEditingCell({ rateId: rate.id, field: 'tradeCategory' })}
                      >
                        {draft.tradeCategory}
                      </button>
                    )}
                  </td>
                  <td className={TABLE_CELL_NUMERIC_CLASS}>
                    <ExternalStepperNumberInput
                      min={0}
                      step="any"
                      value={draft.hourlyRate}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, hourlyRate: value },
                        }))
                      }
                    />
                  </td>
                  <td className={TABLE_CELL_NUMERIC_CLASS}>
                    <ExternalStepperNumberInput
                      min={0}
                      step="any"
                      value={draft.burdenPercent}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, burdenPercent: value },
                        }))
                      }
                    />
                  </td>
                  <td className={`${TABLE_CELL_NUMERIC_CLASS} font-medium ${TEXT_MUTED}`}>
                    {formatMoney(fullyBurdened)}
                  </td>
                  <td className={TABLE_CELL_NUMERIC_CLASS}>
                    <ExternalStepperNumberInput
                      min={0}
                      step="any"
                      value={draft.billingRate}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, billingRate: value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      checked={draft.isDefault}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, isDefault: event.target.checked },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {isDirty ? (
                        <button
                          type="button"
                          aria-label={`Save ${draft.roleName}`}
                          title="Save"
                          className={`${FOCUS_RING} inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700`}
                          disabled={saving}
                          onClick={() => void handleSaveRow(rate)}
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                      ) : (
                        <span className="h-8 w-8" aria-hidden />
                      )}
                      <RowActionsMenu
                        disabled={saving}
                        onDisable={() => void disableRate(rate.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {adding ? (
              <tr className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
                <td className="px-3 py-2">
                  <input
                    className={TABLE_INPUT_CLASS}
                    placeholder="Role name"
                    value={newRow.roleName}
                    onChange={(event) => setNewRow((row) => ({ ...row, roleName: event.target.value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={TABLE_INPUT_CLASS}
                    value={newRow.tradeCategory}
                    onChange={(event) => setNewRow((row) => ({ ...row, tradeCategory: event.target.value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <ExternalStepperNumberInput
                    value={newRow.hourlyRate}
                    onChange={(value) => setNewRow((row) => ({ ...row, hourlyRate: value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <ExternalStepperNumberInput
                    value={newRow.burdenPercent}
                    onChange={(value) => setNewRow((row) => ({ ...row, burdenPercent: value }))}
                  />
                </td>
                <td className={`px-3 py-2 ${TEXT_MUTED}`}>—</td>
                <td className="px-3 py-2">
                  <ExternalStepperNumberInput
                    value={newRow.billingRate}
                    onChange={(value) => setNewRow((row) => ({ ...row, billingRate: value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                    checked={newRow.isDefault}
                    onChange={(event) => setNewRow((row) => ({ ...row, isDefault: event.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => void handleAddRow()} disabled={saving}>
                      Add
                    </Button>
                    <Button variant="secondary" onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
