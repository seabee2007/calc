import { useCallback, useMemo, useState } from 'react';
import Button from '../../../../components/ui/Button';
import {
  BORDER_DEFAULT,
  FORM_INPUT_PLANNER,
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

export default function LaborRateLibrarySection({ hideTitle = false }: { hideTitle?: boolean }) {
  const { rates, loading, saving, error, saveRate, disableRate, seedDefaults } = useCompanyLaborRates();
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [adding, setAdding] = useState(false);
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
            <Button variant="primary" onClick={() => void handleSaveAll()} disabled={saving || loading}>
              Save {dirtyRateIds.length} change{dirtyRateIds.length === 1 ? '' : 's'}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setAdding(true)} disabled={saving || loading}>
            Add Role
          </Button>
          <Button variant="secondary" onClick={() => void seedDefaults()} disabled={saving || loading}>
            Reset to Starter Defaults
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-500 dark:text-red-400">{error}</p> : null}
      {saveMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{saveMessage}</p>
      ) : null}
      {loading ? <p className={`text-sm ${TEXT_MUTED}`}>Loading labor rates…</p> : null}

      <div className={`overflow-x-auto rounded-xl border ${BORDER_DEFAULT}`}>
        <table className="min-w-full text-sm">
          <thead
            className={`bg-slate-50 text-left text-xs uppercase tracking-wide dark:bg-slate-800/80 ${TEXT_MUTED}`}
          >
            <tr>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Trade</th>
              <th className="px-3 py-2">Base Rate</th>
              <th className="px-3 py-2">Burden %</th>
              <th className="px-3 py-2">Fully Burdened</th>
              <th className="px-3 py-2">Billing Rate</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className={TEXT_BODY}>
            {rates.map((rate) => {
              const draft = mergedDrafts[rate.id];
              if (!draft) return null;
              const isDirty = !draftMatchesRate(draft, rate);
              const fullyBurdened =
                (Number(draft.hourlyRate) || 0) * (1 + (Number(draft.burdenPercent) || 0) / 100);
              return (
                <tr
                  key={rate.id}
                  className={`border-t border-slate-200 dark:border-slate-700 ${
                    isDirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      className={TABLE_INPUT_CLASS}
                      value={draft.roleName}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, roleName: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={TABLE_INPUT_CLASS}
                      value={draft.tradeCategory}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, tradeCategory: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={TABLE_INPUT_CLASS}
                      value={draft.hourlyRate}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, hourlyRate: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={TABLE_INPUT_CLASS}
                      value={draft.burdenPercent}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, burdenPercent: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${TEXT_FOREGROUND}`}>
                    {formatMoney(fullyBurdened)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={TABLE_INPUT_CLASS}
                      value={draft.billingRate}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [rate.id]: { ...draft, billingRate: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
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
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void handleSaveRow(rate)}
                        disabled={saving || !isDirty}
                      >
                        Save
                      </Button>
                      <Button variant="secondary" onClick={() => void disableRate(rate.id)} disabled={saving}>
                        Disable
                      </Button>
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
                  <input
                    type="number"
                    className={TABLE_INPUT_CLASS}
                    value={newRow.hourlyRate}
                    onChange={(event) => setNewRow((row) => ({ ...row, hourlyRate: event.target.value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className={TABLE_INPUT_CLASS}
                    value={newRow.burdenPercent}
                    onChange={(event) => setNewRow((row) => ({ ...row, burdenPercent: event.target.value }))}
                  />
                </td>
                <td className={`px-3 py-2 ${TEXT_MUTED}`}>—</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className={TABLE_INPUT_CLASS}
                    value={newRow.billingRate}
                    onChange={(event) => setNewRow((row) => ({ ...row, billingRate: event.target.value }))}
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
