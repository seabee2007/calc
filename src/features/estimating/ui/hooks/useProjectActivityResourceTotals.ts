/**
 * Loads all material and equipment resource rows for a project.
 * Used by Costs & Markup to aggregate saved resource costs from the database.
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
} from '../../domain/constructionActivityTypes';
import {
  fetchProjectEquipmentResources,
  fetchProjectMaterialResources,
} from '../../infrastructure/activityRepository';

export interface UseProjectActivityResourceTotalsReturn {
  materials: ActivityMaterialResource[];
  equipment: ActivityEquipmentResource[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useProjectActivityResourceTotals(
  projectId: string | null | undefined,
  enabled: boolean,
): UseProjectActivityResourceTotalsReturn {
  const [materials, setMaterials] = useState<ActivityMaterialResource[]>([]);
  const [equipment, setEquipment] = useState<ActivityEquipmentResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !enabled) {
      setMaterials([]);
      setEquipment([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [matResult, equipResult] = await Promise.all([
      fetchProjectMaterialResources(projectId),
      fetchProjectEquipmentResources(projectId),
    ]);

    const loadError = matResult.error ?? equipResult.error;
    setMaterials(matResult.data ?? []);
    setEquipment(equipResult.data ?? []);
    setError(loadError);
    setLoading(false);
  }, [projectId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    materials,
    equipment,
    loading,
    error,
    reload: load,
  };
}
