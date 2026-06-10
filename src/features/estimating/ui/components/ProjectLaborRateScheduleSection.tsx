import { useMemo, useState } from 'react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { ProjectLaborRate, ProjectLaborRateInput } from '../../domain/laborRateTypes';
import { useProjectLaborRates } from '../hooks/useProjectLaborRates';
import LaborRateRecalculationModal from './LaborRateRecalculationModal';

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface DraftRow {
  hourlyRate: string;
  burdenPercent: string;
  billingRate: string;
  isDefault: boolean;
}

export default function ProjectLaborRateScheduleSection({ projectId, canEdit }: Props) {
  const {
    projectRates,
    companyRates,
    loading,
    saving,
    error,
    initializeFromCompany,
    saveProjectRate,
    resetToCompany,
  } = useProjectLaborRates(projectId);

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [recalcState, setRecalcState] = useState<{
    rate: ProjectLaborRate;
    previousHourlyRate: number;
    previousBurdenPercent: number;
  } | null>(null);

  const companyByRole = useMemo(
    () => new Map(companyRates.map((rate) => [rate.roleKey, rate])),
    [companyRates],
  );

  const getDraft = (rate: ProjectLaborRate): DraftRow =>
    drafts[rate.id] ?? {
      hourlyRate: String(rate.hourlyRate),
      burdenPercent: String(rate.burdenPercent),
      billingRate: String(rate.billingRate),
      isDefault: rate.isDefault,
    };

  const handleSave = async (rate: ProjectLaborRate) => {
    const draft = getDraft(rate);
    const nextHourly = Number(draft.hourlyRate) || 0;
    const nextBurden = Number(draft.burdenPercent) || 0;
    const pricingChanged =
      nextHourly !== rate.hourlyRate || nextBurden !== rate.burdenPercent;

    const input: ProjectLaborRateInput = {
      id: rate.id,
      projectId,
      companyLaborRateId: rate.companyLaborRateId,
      roleKey: rate.roleKey,
      roleName: rate.roleName,
      tradeCategory: rate.tradeCategory,
      hourlyRate: nextHourly,
      burdenPercent: nextBurden,
      billingRate: Number(draft.billingRate) || 0,
      isDefault: draft.isDefault,
      isActive: true,
      isOverride:
        pricingChanged ||
        (companyByRole.get(rate.roleKey)?.hourlyRate ?? 0) !== nextHourly ||
        (companyByRole.get(rate.roleKey)?.burdenPercent ?? 0) !== nextBurden,
    };

    const saved = await saveProjectRate(input);
    setDrafts((current) => {
      const copy = { ...current };
      delete copy[rate.id];
      return copy;
    });

    if (saved && pricingChanged) {
      setRecalcState({
        rate: saved,
        previousHourlyRate: rate.hourlyRate,
        previousBurdenPercent: rate.burdenPercent,
      });
    }
  };

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Project Labor Rate Schedule
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Override company defaults for this project. Line items snapshot rates at save time.
          </p>
        </div>
        {canEdit && projectRates.length === 0 ? (
          <Button
            variant="secondary"
            onClick={() => void initializeFromCompany()}
            disabled={saving || loading || companyRates.length === 0}
          >
            Initialize from company defaults
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading project labor rates…</p> : null}

      {projectRates.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2">Base Rate</th>
                <th className="px-3 py-2">Burden %</th>
                <th className="px-3 py-2">Fully Burdened</th>
                <th className="px-3 py-2">Status</th>
                {canEdit ? <th className="px-3 py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {projectRates.map((rate) => {
                const draft = getDraft(rate);
                const fullyBurdened =
                  (Number(draft.hourlyRate) || 0) * (1 + (Number(draft.burdenPercent) || 0) / 100);
                const companyRate = companyByRole.get(rate.roleKey);
                const isOverride =
                  rate.isOverride ||
                  (companyRate &&
                    (companyRate.hourlyRate !== rate.hourlyRate ||
                      companyRate.burdenPercent !== rate.burdenPercent));
                return (
                  <tr key={rate.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">{rate.roleName}</td>
                    <td className="px-3 py-2">{rate.tradeCategory}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={draft.hourlyRate}
                          disabled={!canEdit || saving}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [rate.id]: { ...draft, hourlyRate: event.target.value },
                            }))
                          }
                          fullWidth
                        />
                      ) : (
                        formatMoney(rate.hourlyRate)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={draft.burdenPercent}
                          disabled={!canEdit || saving}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [rate.id]: { ...draft, burdenPercent: event.target.value },
                            }))
                          }
                          fullWidth
                        />
                      ) : (
                        `${rate.burdenPercent}%`
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(fullyBurdened)}</td>
                    <td className="px-3 py-2">
                      {isOverride ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Override
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Company default</span>
                      )}
                    </td>
                    {canEdit ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => void handleSave(rate)}
                            disabled={saving}
                          >
                            Save
                          </Button>
                          {companyRate ? (
                            <Button
                              variant="secondary"
                              onClick={() => void resetToCompany(rate)}
                              disabled={saving}
                            >
                              Reset
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {recalcState ? (
        <LaborRateRecalculationModal
          projectId={projectId}
          rate={recalcState.rate}
          previousHourlyRate={recalcState.previousHourlyRate}
          previousBurdenPercent={recalcState.previousBurdenPercent}
          onClose={() => setRecalcState(null)}
        />
      ) : null}
    </section>
  );
}
