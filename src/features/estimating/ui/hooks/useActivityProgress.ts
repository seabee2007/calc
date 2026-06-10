/**
 * useActivityProgress hook
 *
 * Manages field-control state for a single construction activity:
 *   - Load progress updates
 *   - Load/create baseline
 *   - Submit daily update
 *   - Compute rollup and forecast
 */
import { useCallback, useEffect, useState } from 'react';
import {
  logDailyProgress,
  removeProgressUpdate,
  getActivityProgressRollup,
  getActivityProgressUpdates,
  getActivityBaseline,
  approveActivityBaseline,
} from '../../services/progressUpdateService';
import type {
  ActivityProgressUpdate,
  ActivityProgressRollup,
  ActivityBaseline,
  CreateProgressUpdateInput,
} from '../../domain/activityProgressTypes';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';

interface UseActivityProgressState {
  updates: ActivityProgressUpdate[];
  rollup: ActivityProgressRollup | null;
  baseline: ActivityBaseline | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

interface UseActivityProgressReturn extends UseActivityProgressState {
  reload: () => Promise<void>;
  submitUpdate: (input: CreateProgressUpdateInput) => Promise<boolean>;
  deleteUpdate: (updateId: string) => Promise<boolean>;
  createBaseline: (reason?: string, baselinedBy?: string) => Promise<boolean>;
}

/**
 * currentProjectDay: day-offset from project start. Pass 0 if not known.
 * originalFinishDay: planned finish day from CPM. Pass activity's effectiveDurationDays if CPM not run.
 */
export function useActivityProgress(
  activity: ProjectConstructionActivity | null | undefined,
  currentProjectDay = 0,
): UseActivityProgressReturn {
  const [state, setState] = useState<UseActivityProgressState>({
    updates: [],
    rollup: null,
    baseline: null,
    loading: false,
    saving: false,
    error: null,
  });

  const activityId = activity?.id;
  const originalQuantity = activity?.calculatedManHours ?? 0;
  const originalDurationDays = activity?.effectiveDurationDays ?? activity?.calculatedDurationDays ?? 1;
  const originalFinishDay = originalDurationDays;

  const load = useCallback(async () => {
    if (!activityId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    const [updatesResult, rollupResult, baselineResult] = await Promise.all([
      getActivityProgressUpdates(activityId),
      getActivityProgressRollup(
        activityId,
        originalQuantity,
        originalDurationDays,
        originalFinishDay,
        currentProjectDay,
      ),
      getActivityBaseline(activityId),
    ]);

    setState((s) => ({
      ...s,
      loading: false,
      updates: updatesResult.data ?? [],
      rollup: rollupResult.data ?? null,
      baseline: baselineResult.data ?? null,
      error: updatesResult.error ?? rollupResult.error ?? baselineResult.error ?? null,
    }));
  }, [activityId, originalQuantity, originalDurationDays, originalFinishDay, currentProjectDay]);

  useEffect(() => {
    load();
  }, [load]);

  const submitUpdate = useCallback(
    async (input: CreateProgressUpdateInput): Promise<boolean> => {
      setState((s) => ({ ...s, saving: true, error: null }));
      const result = await logDailyProgress(input);
      if (result.error) {
        setState((s) => ({ ...s, saving: false, error: result.error }));
        return false;
      }
      await load();
      setState((s) => ({ ...s, saving: false }));
      return true;
    },
    [load],
  );

  const deleteUpdate = useCallback(
    async (updateId: string): Promise<boolean> => {
      setState((s) => ({ ...s, saving: true, error: null }));
      const result = await removeProgressUpdate(updateId);
      if (result.error) {
        setState((s) => ({ ...s, saving: false, error: result.error }));
        return false;
      }
      await load();
      setState((s) => ({ ...s, saving: false }));
      return true;
    },
    [load],
  );

  const createBaseline = useCallback(
    async (reason?: string, baselinedBy?: string): Promise<boolean> => {
      if (!activity) return false;
      setState((s) => ({ ...s, saving: true, error: null }));

      const result = await approveActivityBaseline({
        projectActivityId: activity.id,
        projectId: activity.projectId,
        baselinedAt: new Date().toISOString(),
        baselinedBy: baselinedBy ?? null,
        baselineReason: reason ?? null,
        baselineDurationDays: activity.effectiveDurationDays ?? activity.calculatedDurationDays ?? 1,
        baselineCrewSize: activity.crewSize ?? 1,
        baselineManHours: activity.calculatedManHours ?? 0,
        baselineManDays: activity.calculatedManDays ?? 0,
        baselineQuantity: originalQuantity,
        baselineUnit: 'MH',
        baselineEarlyStartDay: null,
        baselineEarlyFinishDay: null,
      });

      if (result.error) {
        setState((s) => ({ ...s, saving: false, error: result.error }));
        return false;
      }
      await load();
      setState((s) => ({ ...s, saving: false }));
      return true;
    },
    [activity, originalQuantity, load],
  );

  return {
    ...state,
    reload: load,
    submitUpdate,
    deleteUpdate,
    createBaseline,
  };
}
