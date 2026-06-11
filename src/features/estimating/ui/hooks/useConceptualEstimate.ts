import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyLineItemAmount,
  buildConceptualEstimateRollup,
  createConceptualEntityId,
  createConceptualLineItem,
  duplicateScenarioFromBudget,
  recalculateScenarioTotals,
} from '../../application/conceptualEstimateCalculations';
import { conceptualEstimateFromAssumptions } from '../../application/conceptualEstimatePersistence';
import type { CurrentEstimate } from '../../application/currentEstimateService';
import type { EstimateSettings } from '../../application/estimateSettings';
import {
  createEmptyConceptualEstimatePayload,
  type ConceptualAllowanceNote,
  type ConceptualAssumption,
  type ConceptualEstimateLineItem,
  type ConceptualEstimatePayload,
  type ConceptualEstimateRevision,
  type ConceptualEstimateScenario,
  type ConceptualExclusion,
  type ConceptualLineItemType,
  type ConceptualRisk,
} from '../../domain/conceptualEstimateTypes';

function clonePayload(payload: ConceptualEstimatePayload): ConceptualEstimatePayload {
  return structuredClone(payload);
}

export interface UseConceptualEstimateOptions {
  estimate: CurrentEstimate | null;
  estimateSettings?: Partial<EstimateSettings> | null;
}

export function useConceptualEstimate({
  estimate,
  estimateSettings = null,
}: UseConceptualEstimateOptions) {
  const [payload, setPayload] = useState<ConceptualEstimatePayload>(() =>
    createEmptyConceptualEstimatePayload(),
  );
  const [dirty, setDirty] = useState(false);
  const hydratedEstimateIdRef = useRef<string | null>(null);

  const rehydrateFromEstimate = useCallback((nextEstimate: CurrentEstimate | null) => {
    if (!nextEstimate) {
      setPayload(createEmptyConceptualEstimatePayload());
      setDirty(false);
      hydratedEstimateIdRef.current = null;
      return;
    }

    const parsed =
      conceptualEstimateFromAssumptions(nextEstimate.assumptions) ??
      createEmptyConceptualEstimatePayload();
    setPayload(parsed);
    setDirty(false);
    hydratedEstimateIdRef.current = nextEstimate.id;
  }, []);

  useEffect(() => {
    if (!estimate) {
      rehydrateFromEstimate(null);
      return;
    }
    if (hydratedEstimateIdRef.current === estimate.id && !dirty) {
      const parsed = conceptualEstimateFromAssumptions(estimate.assumptions);
      if (parsed) {
        setPayload(parsed);
      }
      return;
    }
    if (hydratedEstimateIdRef.current !== estimate.id) {
      rehydrateFromEstimate(estimate);
    }
  }, [estimate, dirty, rehydrateFromEstimate]);

  const displayPayload = useMemo(
    () => ({
      ...payload,
      scenarios: recalculateScenarioTotals(payload, estimateSettings),
    }),
    [payload, estimateSettings],
  );

  const rollup = useMemo(
    () => buildConceptualEstimateRollup(displayPayload, estimateSettings),
    [displayPayload, estimateSettings],
  );

  const updatePayload = useCallback((updater: (current: ConceptualEstimatePayload) => ConceptualEstimatePayload) => {
    setPayload((current) => updater(clonePayload(current)));
    setDirty(true);
  }, []);

  const addLineItem = useCallback(
    (
      type: ConceptualLineItemType,
      partial: Partial<ConceptualEstimateLineItem> & Pick<ConceptualEstimateLineItem, 'title'>,
    ) => {
      updatePayload((current) => ({
        ...current,
        lineItems: [...current.lineItems, createConceptualLineItem(type, partial)],
      }));
    },
    [updatePayload],
  );

  const updateLineItem = useCallback(
    (id: string, patch: Partial<ConceptualEstimateLineItem>) => {
      updatePayload((current) => ({
        ...current,
        lineItems: current.lineItems.map((item) => {
          if (item.id !== id) return item;
          const next = applyLineItemAmount({
            ...item,
            ...patch,
            updatedAt: new Date().toISOString(),
          });
          return next;
        }),
      }));
    },
    [updatePayload],
  );

  const deleteLineItem = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        lineItems: current.lineItems.filter((item) => item.id !== id),
        scenarios: current.scenarios.map((scenario) => ({
          ...scenario,
          lineItemIds: scenario.lineItemIds.filter((lineItemId) => lineItemId !== id),
        })),
      }));
    },
    [updatePayload],
  );

  const updateRevision = useCallback(
    (patch: Partial<ConceptualEstimateRevision>) => {
      updatePayload((current) => ({
        ...current,
        revision: { ...current.revision, ...patch },
      }));
    },
    [updatePayload],
  );

  const setContingencyPercent = useCallback(
    (contingencyPercent: number) => {
      updatePayload((current) => ({ ...current, contingencyPercent }));
    },
    [updatePayload],
  );

  const addAssumption = useCallback(
    (partial: Omit<ConceptualAssumption, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      updatePayload((current) => ({
        ...current,
        assumptions: [
          ...current.assumptions,
          { ...partial, id: createConceptualEntityId('asm'), createdAt: now, updatedAt: now },
        ],
      }));
    },
    [updatePayload],
  );

  const updateAssumption = useCallback(
    (id: string, patch: Partial<ConceptualAssumption>) => {
      updatePayload((current) => ({
        ...current,
        assumptions: current.assumptions.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [updatePayload],
  );

  const deleteAssumption = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        assumptions: current.assumptions.filter((item) => item.id !== id),
      }));
    },
    [updatePayload],
  );

  const addExclusion = useCallback(
    (partial: Omit<ConceptualExclusion, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      updatePayload((current) => ({
        ...current,
        exclusions: [
          ...current.exclusions,
          { ...partial, id: createConceptualEntityId('exc'), createdAt: now, updatedAt: now },
        ],
      }));
    },
    [updatePayload],
  );

  const updateExclusion = useCallback(
    (id: string, patch: Partial<ConceptualExclusion>) => {
      updatePayload((current) => ({
        ...current,
        exclusions: current.exclusions.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [updatePayload],
  );

  const deleteExclusion = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        exclusions: current.exclusions.filter((item) => item.id !== id),
      }));
    },
    [updatePayload],
  );

  const addAllowanceNote = useCallback(
    (partial: Omit<ConceptualAllowanceNote, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      updatePayload((current) => ({
        ...current,
        allowanceNotes: [
          ...current.allowanceNotes,
          { ...partial, id: createConceptualEntityId('aln'), createdAt: now, updatedAt: now },
        ],
      }));
    },
    [updatePayload],
  );

  const updateAllowanceNote = useCallback(
    (id: string, patch: Partial<ConceptualAllowanceNote>) => {
      updatePayload((current) => ({
        ...current,
        allowanceNotes: current.allowanceNotes.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [updatePayload],
  );

  const deleteAllowanceNote = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        allowanceNotes: current.allowanceNotes.filter((item) => item.id !== id),
      }));
    },
    [updatePayload],
  );

  const addRisk = useCallback(
    (partial: Omit<ConceptualRisk, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      updatePayload((current) => ({
        ...current,
        risks: [
          ...current.risks,
          { ...partial, id: createConceptualEntityId('risk'), createdAt: now, updatedAt: now },
        ],
      }));
    },
    [updatePayload],
  );

  const updateRisk = useCallback(
    (id: string, patch: Partial<ConceptualRisk>) => {
      updatePayload((current) => ({
        ...current,
        risks: current.risks.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [updatePayload],
  );

  const deleteRisk = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        risks: current.risks.filter((item) => item.id !== id),
      }));
    },
    [updatePayload],
  );

  const addScenario = useCallback(
    (partial: Pick<ConceptualEstimateScenario, 'name' | 'description' | 'notes'>) => {
      const now = new Date().toISOString();
      updatePayload((current) => ({
        ...current,
        scenarios: [
          ...current.scenarios,
          {
            id: createConceptualEntityId('scenario'),
            name: partial.name,
            description: partial.description ?? null,
            notes: partial.notes ?? null,
            lineItemIds: [],
            subtotal: 0,
            contingency: 0,
            total: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
    },
    [updatePayload],
  );

  const duplicateBudgetAsScenario = useCallback(
    (name: string, description?: string) => {
      updatePayload((current) => ({
        ...current,
        scenarios: [
          ...current.scenarios,
          duplicateScenarioFromBudget(current, name, description),
        ],
      }));
    },
    [updatePayload],
  );

  const updateScenario = useCallback(
    (id: string, patch: Partial<ConceptualEstimateScenario>) => {
      updatePayload((current) => ({
        ...current,
        scenarios: current.scenarios.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [updatePayload],
  );

  const deleteScenario = useCallback(
    (id: string) => {
      updatePayload((current) => ({
        ...current,
        scenarios: current.scenarios.filter((item) => item.id !== id),
        selectedScenarioId:
          current.selectedScenarioId === id ? null : current.selectedScenarioId,
      }));
    },
    [updatePayload],
  );

  const selectScenario = useCallback(
    (id: string | null) => {
      updatePayload((current) => ({ ...current, selectedScenarioId: id }));
    },
    [updatePayload],
  );

  const markSaved = useCallback((savedEstimate: CurrentEstimate) => {
    const parsed =
      conceptualEstimateFromAssumptions(savedEstimate.assumptions) ??
      createEmptyConceptualEstimatePayload();
    setPayload(parsed);
    setDirty(false);
    hydratedEstimateIdRef.current = savedEstimate.id;
  }, []);

  const recalculate = useCallback(() => {
    setPayload((current) => ({
      ...current,
      scenarios: recalculateScenarioTotals(current, estimateSettings),
    }));
  }, [estimateSettings]);

  return {
    payload: displayPayload,
    rawPayload: payload,
    rollup,
    dirty,
    rehydrateFromEstimate,
    markSaved,
    recalculate,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    updateRevision,
    setContingencyPercent,
    addAssumption,
    updateAssumption,
    deleteAssumption,
    addExclusion,
    updateExclusion,
    deleteExclusion,
    addAllowanceNote,
    updateAllowanceNote,
    deleteAllowanceNote,
    addRisk,
    updateRisk,
    deleteRisk,
    addScenario,
    duplicateBudgetAsScenario,
    updateScenario,
    deleteScenario,
    selectScenario,
  };
}

export type ConceptualEstimateController = ReturnType<typeof useConceptualEstimate>;
