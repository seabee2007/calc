/**
 * Hook: manages the lifecycle of project construction activities for a
 * given project + estimate.
 *
 * Provides load, save (instantiate + persist), and delete operations,
 * exposing simple state: activities[], lineItemsMap, loading, error.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityAssemblySpec, AssemblyUserInputs } from '../../domain/activityAssemblyTypes';
import type { ActivityLineItemTemplate, EstimateDivision, ProductionRate, ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import {
  instantiateAndSaveActivity,
  loadProjectActivitiesWithLineItems,
  removeProjectActivity,
  type LoadedProjectActivity,
} from '../../application/constructionActivityService';

export interface ConstructionActivityState {
  activities: ProjectConstructionActivity[];
  lineItemsMap: Map<string, ProjectActivityLineItem[]>;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export interface UseConstructionActivitiesReturn extends ConstructionActivityState {
  reload: () => void;
  addFromAssembly: (params: AddFromAssemblyParams) => Promise<void>;
  remove: (activityId: string) => Promise<void>;
}

export interface AddFromAssemblyParams {
  assembly: ActivityAssemblySpec;
  userInputs: AssemblyUserInputs;
  division: EstimateDivision;
  lineItemTemplates: readonly ActivityLineItemTemplate[];
  productionRates: readonly ProductionRate[] | Map<string, ProductionRate>;
  crewSize?: number;
  hoursPerDay?: number;
  productionFactor?: number;
  durationDaysOverride?: number | null;
  activityTitleOverride?: string;
  existingActivityId?: string;
}

export function useConstructionActivities(
  projectId: string | null | undefined,
  estimateId: string | null | undefined,
): UseConstructionActivitiesReturn {
  const [state, setState] = useState<ConstructionActivityState>({
    activities: [],
    lineItemsMap: new Map(),
    loading: false,
    saving: false,
    error: null,
  });

  const reloadRef = useRef(0);

  const setLoaded = useCallback((loaded: LoadedProjectActivity[]) => {
    const map = new Map<string, ProjectActivityLineItem[]>(
      loaded.map((l) => [l.activity.id, l.lineItems]),
    );
    setState((s) => ({
      ...s,
      activities: loaded.map((l) => l.activity),
      lineItemsMap: map,
      loading: false,
      error: null,
    }));
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const result = await loadProjectActivitiesWithLineItems(projectId, estimateId ?? undefined);
    if (result.error || !result.data) {
      setState((s) => ({
        ...s,
        loading: false,
        error: result.error ?? 'Failed to load activities',
      }));
    } else {
      setLoaded(result.data);
    }
  }, [projectId, estimateId, setLoaded]);

  const reload = useCallback(() => {
    reloadRef.current += 1;
    void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFromAssembly = useCallback(
    async (params: AddFromAssemblyParams) => {
      if (!projectId) return;
      setState((s) => ({ ...s, saving: true, error: null }));
      const result = await instantiateAndSaveActivity({
        ...params,
        projectId,
        estimateId: estimateId ?? undefined,
      });
      if (result.error || !result.data) {
        setState((s) => ({
          ...s,
          saving: false,
          error: result.error ?? 'Save failed',
        }));
      } else {
        // Optimistically update state then reload for consistency
        setState((s) => ({ ...s, saving: false }));
        void load();
      }
    },
    [projectId, estimateId, load],
  );

  const remove = useCallback(
    async (activityId: string) => {
      setState((s) => ({ ...s, saving: true }));
      const result = await removeProjectActivity(activityId);
      if (result.error) {
        setState((s) => ({
          ...s,
          saving: false,
          error: result.error,
        }));
      } else {
        setState((s) => {
          const map = new Map(s.lineItemsMap);
          map.delete(activityId);
          return {
            ...s,
            saving: false,
            activities: s.activities.filter((a) => a.id !== activityId),
            lineItemsMap: map,
          };
        });
      }
    },
    [],
  );

  return { ...state, reload, addFromAssembly, remove };
}
