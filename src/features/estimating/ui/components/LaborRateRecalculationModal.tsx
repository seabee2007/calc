import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import type { ProjectLaborRate } from '../../domain/laborRateTypes';
import {
  findAffectedActivitiesForRole,
  loadLineItemsForRecalculation,
  recalculateAndSaveActivityLaborCosts,
} from '../../application/laborRateService';
import { fetchProjectActivities } from '../../infrastructure/activityRepository';

interface Props {
  projectId: string;
  rate: ProjectLaborRate;
  previousHourlyRate: number;
  previousBurdenPercent: number;
  onClose: () => void;
}

interface AffectedActivity {
  activityId: string;
  activityTitle: string;
  lineItemIds: string[];
}

export default function LaborRateRecalculationModal({
  projectId,
  rate,
  previousHourlyRate,
  previousBurdenPercent,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affected, setAffected] = useState<AffectedActivity[]>([]);
  const [mode, setMode] = useState<'future_only' | 'selected' | 'all'>('future_only');
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const result = await findAffectedActivitiesForRole(projectId, rate.roleKey);
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not load affected activities');
        setAffected([]);
      } else {
        const grouped = new Map<string, AffectedActivity>();
        for (const row of result.data) {
          const existing = grouped.get(row.activityId);
          if (existing) {
            existing.lineItemIds.push(row.lineItemId);
          } else {
            grouped.set(row.activityId, {
              activityId: row.activityId,
              activityTitle: row.activityTitle,
              lineItemIds: [row.lineItemId],
            });
          }
        }
        setAffected(Array.from(grouped.values()));
        setSelectedActivityIds(new Set(Array.from(grouped.keys())));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, rate.roleKey]);

  const previewCount = useMemo(() => {
    if (mode === 'future_only') return 0;
    if (mode === 'all') return affected.length;
    return selectedActivityIds.size;
  }, [affected.length, mode, selectedActivityIds.size]);

  const handleConfirm = useCallback(async () => {
    if (mode === 'future_only') {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    const activityIds =
      mode === 'all' ? affected.map((entry) => entry.activityId) : Array.from(selectedActivityIds);

    for (const activityId of activityIds) {
      const activityResult = await fetchProjectActivities(projectId);
      const activity = activityResult.data?.find((entry) => entry.id === activityId);
      if (!activity) continue;

      const lineItemsResult = await loadLineItemsForRecalculation(activityId);
      if (lineItemsResult.error || !lineItemsResult.data) {
        setError(lineItemsResult.error ?? 'Failed to load line items');
        setSaving(false);
        return;
      }

      const affectedEntry = affected.find((entry) => entry.activityId === activityId);
      const lineItemIds = affectedEntry ? new Set(affectedEntry.lineItemIds) : undefined;

      const saveResult = await recalculateAndSaveActivityLaborCosts({
        activity,
        lineItems: lineItemsResult.data,
        rate,
        lineItemIds,
      });

      if (saveResult.error) {
        setError(saveResult.error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onClose();
  }, [affected, mode, onClose, projectId, rate, selectedActivityIds]);

  return (
    <Modal isOpen onClose={onClose} title="Recalculate Labor Costs?" size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <p className="font-medium text-slate-800 dark:text-slate-100">{rate.roleName}</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Base rate {previousHourlyRate.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}{' '}
            → {rate.hourlyRate.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            Burden {previousBurdenPercent}% → {rate.burdenPercent}%
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Fully burdened{' '}
            {rate.fullyBurdenedRate.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/hr
          </p>
        </div>

        {loading ? <p className="text-sm text-slate-500">Checking affected activities…</p> : null}
        {!loading && affected.length === 0 ? (
          <p className="text-sm text-slate-500">No existing line items use this labor role.</p>
        ) : null}

        {!loading && affected.length > 0 ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {affected.length} activit{affected.length === 1 ? 'y' : 'ies'} currently snapshot this role.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'future_only'}
                  onChange={() => setMode('future_only')}
                />
                Update future activities only (default)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'selected'}
                  onChange={() => setMode('selected')}
                />
                Recalculate selected activities
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
                Recalculate all activities
              </label>
            </div>

            {mode === 'selected' ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {affected.map((entry) => (
                  <label
                    key={entry.activityId}
                    className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 dark:border-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedActivityIds.has(entry.activityId)}
                      onChange={(event) => {
                        setSelectedActivityIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(entry.activityId);
                          else next.delete(entry.activityId);
                          return next;
                        });
                      }}
                    />
                    <span>{entry.activityTitle}</span>
                    <span className="text-xs text-slate-400">
                      {entry.lineItemIds.length} line item(s)
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleConfirm()} disabled={saving || loading}>
            {saving
              ? 'Recalculating…'
              : mode === 'future_only'
                ? 'Keep Existing Snapshots'
                : `Recalculate ${previewCount} Activit${previewCount === 1 ? 'y' : 'ies'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
