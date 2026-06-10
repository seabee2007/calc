/**
 * Slim hook: loads ProjectConstructionActivity[] for a project/estimate at
 * the workspace level so the schedule pipeline can use construction activities
 * as the source of truth when they exist.
 *
 * Only schedule-eligible activities are relevant to this hook's consumers —
 * but we fetch all and let the adapter filter, so the "Activities" tab and
 * schedule pipeline share a consistent view.
 *
 * Line items are NOT loaded here — they are only needed by the builder panel.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { fetchProjectActivities } from '../../infrastructure/activityRepository';

export interface UseProjectConstructionActivitiesForScheduleReturn {
  constructionActivities: ProjectConstructionActivity[];
  constructionActivitiesLoading: boolean;
  constructionActivitiesError: string | null;
  reloadConstructionActivities: () => void;
}

export function useProjectConstructionActivitiesForSchedule(
  projectId: string | null | undefined,
  estimateId: string | null | undefined,
): UseProjectConstructionActivitiesForScheduleReturn {
  const [activities, setActivities] = useState<ProjectConstructionActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setActivities([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchProjectActivities(projectId, estimateId ?? undefined);
    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to load construction activities');
      setActivities([]);
    } else {
      setActivities(result.data);
    }
    setLoading(false);
  }, [projectId, estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    constructionActivities: activities,
    constructionActivitiesLoading: loading,
    constructionActivitiesError: error,
    reloadConstructionActivities: load,
  };
}
