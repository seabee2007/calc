/**
 * Hook for managing material and equipment resources on a construction activity.
 * Provides loading state, inline error, and CRUD operations.
 * Does not crash ConstructionActivityCard on failure — errors surface inline.
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  ActivityMaterialResource,
  ActivityEquipmentResource,
} from '../../domain/constructionActivityTypes';
import {
  getActivityResources,
  addMaterialResource,
  addEquipmentResource,
  updateMaterialResource,
  updateEquipmentResource,
  deleteMaterialResource,
  deleteEquipmentResource,
  type AddResourceInput,
  type UpdateResourceInput,
} from '../../application/activityResourceService';

interface UseActivityResourcesState {
  materials: ActivityMaterialResource[];
  equipment: ActivityEquipmentResource[];
  loading: boolean;
  error: string | null;
}

export interface UseActivityResourcesReturn extends UseActivityResourcesState {
  reload: () => Promise<void>;
  addMaterial: (input: AddResourceInput) => Promise<{ error: string | null }>;
  updateMaterial: (
    id: string,
    updates: UpdateResourceInput,
    existing: ActivityMaterialResource,
  ) => Promise<{ error: string | null }>;
  removeMaterial: (id: string) => Promise<{ error: string | null }>;
  addEquipment: (input: AddResourceInput) => Promise<{ error: string | null }>;
  updateEquipment: (
    id: string,
    updates: UpdateResourceInput,
    existing: ActivityEquipmentResource,
  ) => Promise<{ error: string | null }>;
  removeEquipment: (id: string) => Promise<{ error: string | null }>;
  totalMaterialCost: number;
  totalEquipmentCost: number;
}

export function useActivityResources(activityId: string): UseActivityResourcesReturn {
  const [state, setState] = useState<UseActivityResourcesState>({
    materials: [],
    equipment: [],
    loading: false,
    error: null,
  });

  const reload = useCallback(async () => {
    if (!activityId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await getActivityResources(activityId);
      setState({
        materials: result.materials,
        equipment: result.equipment,
        loading: false,
        error: result.error,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load resources',
      }));
    }
  }, [activityId]);

  useEffect(() => {
    if (activityId) void reload();
  }, [activityId, reload]);

  const addMaterial = useCallback(
    async (input: AddResourceInput) => {
      const { error } = await addMaterialResource(input);
      if (!error) await reload();
      return { error };
    },
    [reload],
  );

  const updateMaterial = useCallback(
    async (id: string, updates: UpdateResourceInput, existing: ActivityMaterialResource) => {
      const { error } = await updateMaterialResource(id, activityId, updates, existing);
      if (!error) await reload();
      return { error };
    },
    [activityId, reload],
  );

  const removeMaterial = useCallback(
    async (id: string) => {
      const { error } = await deleteMaterialResource(id, activityId);
      if (!error) await reload();
      return { error };
    },
    [activityId, reload],
  );

  const addEquipment = useCallback(
    async (input: AddResourceInput) => {
      const { error } = await addEquipmentResource(input);
      if (!error) await reload();
      return { error };
    },
    [reload],
  );

  const updateEquipment = useCallback(
    async (id: string, updates: UpdateResourceInput, existing: ActivityEquipmentResource) => {
      const { error } = await updateEquipmentResource(id, activityId, updates, existing);
      if (!error) await reload();
      return { error };
    },
    [activityId, reload],
  );

  const removeEquipment = useCallback(
    async (id: string) => {
      const { error } = await deleteEquipmentResource(id, activityId);
      if (!error) await reload();
      return { error };
    },
    [activityId, reload],
  );

  const totalMaterialCost = state.materials.reduce((s, r) => s + r.totalCost, 0);
  const totalEquipmentCost = state.equipment.reduce((s, r) => s + r.totalCost, 0);

  return {
    ...state,
    reload,
    addMaterial,
    updateMaterial,
    removeMaterial,
    addEquipment,
    updateEquipment,
    removeEquipment,
    totalMaterialCost,
    totalEquipmentCost,
  };
}
