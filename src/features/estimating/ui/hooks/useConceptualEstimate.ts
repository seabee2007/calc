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
  type AssumptionImpact,
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

function isNewerEstimateVersion(
  incoming: CurrentEstimate,
  hydrated: { id: string; updatedAt: string } | null,
): boolean {
  if (!hydrated || hydrated.id !== incoming.id) return true;
  if (incoming.updatedAt === hydrated.updatedAt) return false;
  return incoming.updatedAt > hydrated.updatedAt;
}

interface ConceptualEstimateSessionState {
  payload: ConceptualEstimatePayload;
  draftItems: ConceptualEstimateDraftItems;
  dirty: boolean;
  hydratedEstimate: { id: string; updatedAt: string } | null;
}

const conceptualEstimateSessionCache = new Map<string, ConceptualEstimateSessionState>();

function getConceptualEstimateSessionState(
  estimateId: string | null | undefined,
): ConceptualEstimateSessionState | null {
  return estimateId ? conceptualEstimateSessionCache.get(estimateId) ?? null : null;
}

function cacheConceptualEstimateSessionState(
  estimateId: string | null | undefined,
  state: ConceptualEstimateSessionState,
): void {
  if (!estimateId) return;
  conceptualEstimateSessionCache.set(estimateId, {
    payload: clonePayload(state.payload),
    draftItems: structuredClone(state.draftItems),
    dirty: state.dirty,
    hydratedEstimate: state.hydratedEstimate ? { ...state.hydratedEstimate } : null,
  });
}

export function resetConceptualEstimateSessionCacheForTests(): void {
  conceptualEstimateSessionCache.clear();
}

export interface ConceptualAssumptionDraft {
  title: string;
  description: string;
  impact: AssumptionImpact;
}

export interface ConceptualExclusionDraft {
  title: string;
  reason: string;
  description: string;
}

export interface ConceptualAllowanceNoteDraft {
  title: string;
  includedAmount: string;
  description: string;
}

export interface ConceptualEstimateDraftItems {
  assumption: ConceptualAssumptionDraft;
  exclusion: ConceptualExclusionDraft;
  allowanceNote: ConceptualAllowanceNoteDraft;
}

const EMPTY_CONCEPTUAL_DRAFT_ITEMS: ConceptualEstimateDraftItems = {
  assumption: {
    title: '',
    description: '',
    impact: 'cost',
  },
  exclusion: {
    title: '',
    reason: '',
    description: '',
  },
  allowanceNote: {
    title: '',
    includedAmount: '',
    description: '',
  },
};

function trimText(value: string): string {
  return value.trim();
}

function fallbackTitle(value: string, fallback: string): string {
  const trimmed = trimText(value);
  return trimmed || fallback;
}

export function hasMeaningfulConceptualDraftItems(drafts: ConceptualEstimateDraftItems): boolean {
  return (
    Boolean(trimText(drafts.assumption.title)) ||
    Boolean(trimText(drafts.assumption.description)) ||
    drafts.assumption.impact !== EMPTY_CONCEPTUAL_DRAFT_ITEMS.assumption.impact ||
    Boolean(trimText(drafts.exclusion.title)) ||
    Boolean(trimText(drafts.exclusion.reason)) ||
    Boolean(trimText(drafts.exclusion.description)) ||
    Boolean(trimText(drafts.allowanceNote.title)) ||
    Boolean(trimText(drafts.allowanceNote.includedAmount)) ||
    Boolean(trimText(drafts.allowanceNote.description))
  );
}

export function hasMeaningfulAssumptionDraft(draft: ConceptualAssumptionDraft): boolean {
  return (
    Boolean(trimText(draft.title)) ||
    Boolean(trimText(draft.description)) ||
    draft.impact !== EMPTY_CONCEPTUAL_DRAFT_ITEMS.assumption.impact
  );
}

export function hasMeaningfulExclusionDraft(draft: ConceptualExclusionDraft): boolean {
  return Boolean(trimText(draft.title)) || Boolean(trimText(draft.reason)) || Boolean(trimText(draft.description));
}

export function hasMeaningfulAllowanceNoteDraft(draft: ConceptualAllowanceNoteDraft): boolean {
  return (
    Boolean(trimText(draft.title)) ||
    Boolean(trimText(draft.includedAmount)) ||
    Boolean(trimText(draft.description))
  );
}

export function buildPayloadWithConceptualDraftItems(
  payload: ConceptualEstimatePayload,
  drafts: ConceptualEstimateDraftItems,
): ConceptualEstimatePayload {
  if (!hasMeaningfulConceptualDraftItems(drafts)) {
    return payload;
  }

  const now = new Date().toISOString();
  const next = clonePayload(payload);

  if (hasMeaningfulAssumptionDraft(drafts.assumption)) {
    next.assumptions.push({
      id: createConceptualEntityId('asm'),
      title: fallbackTitle(drafts.assumption.title, 'Untitled assumption'),
      description: trimText(drafts.assumption.description),
      impact: drafts.assumption.impact,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (hasMeaningfulExclusionDraft(drafts.exclusion)) {
    next.exclusions.push({
      id: createConceptualEntityId('exc'),
      title: fallbackTitle(
        drafts.exclusion.title || drafts.exclusion.reason || drafts.exclusion.description,
        'Untitled exclusion',
      ),
      description: trimText(drafts.exclusion.description),
      reason: trimText(drafts.exclusion.reason),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (hasMeaningfulAllowanceNoteDraft(drafts.allowanceNote)) {
    next.allowanceNotes.push({
      id: createConceptualEntityId('aln'),
      title: fallbackTitle(
        drafts.allowanceNote.title || drafts.allowanceNote.description,
        'Untitled allowance note',
      ),
      includedAmount: Number(drafts.allowanceNote.includedAmount) || 0,
      description: trimText(drafts.allowanceNote.description),
      createdAt: now,
      updatedAt: now,
    });
  }

  return next;
}

export interface UseConceptualEstimateOptions {
  estimate: CurrentEstimate | null;
  estimateSettings?: Partial<EstimateSettings> | null;
}

export function useConceptualEstimate({
  estimate,
  estimateSettings = null,
}: UseConceptualEstimateOptions) {
  const cachedSession = getConceptualEstimateSessionState(estimate?.id);
  const [payload, setPayload] = useState<ConceptualEstimatePayload>(() =>
    cachedSession ? clonePayload(cachedSession.payload) : createEmptyConceptualEstimatePayload(),
  );
  const [dirty, setDirty] = useState(cachedSession?.dirty ?? false);
  const [draftItems, setDraftItems] = useState<ConceptualEstimateDraftItems>(
    cachedSession ? structuredClone(cachedSession.draftItems) : EMPTY_CONCEPTUAL_DRAFT_ITEMS,
  );
  const hydratedEstimateRef = useRef<{ id: string; updatedAt: string } | null>(
    cachedSession?.hydratedEstimate ?? null,
  );

  const rehydrateFromEstimate = useCallback((nextEstimate: CurrentEstimate | null) => {
    if (!nextEstimate) {
      setPayload(createEmptyConceptualEstimatePayload());
      setDraftItems(EMPTY_CONCEPTUAL_DRAFT_ITEMS);
      setDirty(false);
      hydratedEstimateRef.current = null;
      return;
    }

    const parsed =
      conceptualEstimateFromAssumptions(nextEstimate.assumptions) ??
      createEmptyConceptualEstimatePayload();
    setPayload(parsed);
    setDraftItems(EMPTY_CONCEPTUAL_DRAFT_ITEMS);
    setDirty(false);
    hydratedEstimateRef.current = {
      id: nextEstimate.id,
      updatedAt: nextEstimate.updatedAt,
    };
    cacheConceptualEstimateSessionState(nextEstimate.id, {
      payload: parsed,
      draftItems: EMPTY_CONCEPTUAL_DRAFT_ITEMS,
      dirty: false,
      hydratedEstimate: hydratedEstimateRef.current,
    });
  }, []);

  useEffect(() => {
    if (!estimate?.id) return;
    cacheConceptualEstimateSessionState(estimate.id, {
      payload,
      draftItems,
      dirty,
      hydratedEstimate: hydratedEstimateRef.current,
    });
  }, [draftItems, dirty, estimate?.id, payload]);

  useEffect(() => {
    if (!estimate) {
      rehydrateFromEstimate(null);
      return;
    }
    if (dirty && hydratedEstimateRef.current?.id === estimate.id) {
      return;
    }
    if (isNewerEstimateVersion(estimate, hydratedEstimateRef.current)) {
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

  const updateAssumptionDraft = useCallback((patch: Partial<ConceptualAssumptionDraft>) => {
    setDraftItems((current) => ({
      ...current,
      assumption: { ...current.assumption, ...patch },
    }));
    setDirty(true);
  }, []);

  const updateExclusionDraft = useCallback((patch: Partial<ConceptualExclusionDraft>) => {
    setDraftItems((current) => ({
      ...current,
      exclusion: { ...current.exclusion, ...patch },
    }));
    setDirty(true);
  }, []);

  const updateAllowanceNoteDraft = useCallback((patch: Partial<ConceptualAllowanceNoteDraft>) => {
    setDraftItems((current) => ({
      ...current,
      allowanceNote: { ...current.allowanceNote, ...patch },
    }));
    setDirty(true);
  }, []);

  const clearDraftItems = useCallback(() => {
    setDraftItems(EMPTY_CONCEPTUAL_DRAFT_ITEMS);
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

  const commitAssumptionDraft = useCallback(() => {
    if (!hasMeaningfulAssumptionDraft(draftItems.assumption)) return;
    addAssumption({
      title: fallbackTitle(draftItems.assumption.title, 'Untitled assumption'),
      description: trimText(draftItems.assumption.description),
      impact: draftItems.assumption.impact,
    });
    setDraftItems((current) => ({
      ...current,
      assumption: EMPTY_CONCEPTUAL_DRAFT_ITEMS.assumption,
    }));
  }, [addAssumption, draftItems.assumption]);

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

  const commitExclusionDraft = useCallback(() => {
    if (!hasMeaningfulExclusionDraft(draftItems.exclusion)) return;
    addExclusion({
      title: fallbackTitle(
        draftItems.exclusion.title || draftItems.exclusion.reason || draftItems.exclusion.description,
        'Untitled exclusion',
      ),
      description: trimText(draftItems.exclusion.description),
      reason: trimText(draftItems.exclusion.reason),
    });
    setDraftItems((current) => ({
      ...current,
      exclusion: EMPTY_CONCEPTUAL_DRAFT_ITEMS.exclusion,
    }));
  }, [addExclusion, draftItems.exclusion]);

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

  const commitAllowanceNoteDraft = useCallback(() => {
    if (!hasMeaningfulAllowanceNoteDraft(draftItems.allowanceNote)) return;
    addAllowanceNote({
      title: fallbackTitle(
        draftItems.allowanceNote.title || draftItems.allowanceNote.description,
        'Untitled allowance note',
      ),
      includedAmount: Number(draftItems.allowanceNote.includedAmount) || 0,
      description: trimText(draftItems.allowanceNote.description),
    });
    setDraftItems((current) => ({
      ...current,
      allowanceNote: EMPTY_CONCEPTUAL_DRAFT_ITEMS.allowanceNote,
    }));
  }, [addAllowanceNote, draftItems.allowanceNote]);

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
    setDraftItems(EMPTY_CONCEPTUAL_DRAFT_ITEMS);
    setDirty(false);
    hydratedEstimateRef.current = {
      id: savedEstimate.id,
      updatedAt: savedEstimate.updatedAt,
    };
    cacheConceptualEstimateSessionState(savedEstimate.id, {
      payload: parsed,
      draftItems: EMPTY_CONCEPTUAL_DRAFT_ITEMS,
      dirty: false,
      hydratedEstimate: hydratedEstimateRef.current,
    });
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
    draftItems,
    hasDraftItems: hasMeaningfulConceptualDraftItems(draftItems),
    rollup,
    dirty,
    rehydrateFromEstimate,
    markSaved,
    recalculate,
    buildPayloadWithDraftItems: () => buildPayloadWithConceptualDraftItems(payload, draftItems),
    clearDraftItems,
    updateAssumptionDraft,
    updateExclusionDraft,
    updateAllowanceNoteDraft,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    updateRevision,
    setContingencyPercent,
    addAssumption,
    commitAssumptionDraft,
    updateAssumption,
    deleteAssumption,
    addExclusion,
    commitExclusionDraft,
    updateExclusion,
    deleteExclusion,
    addAllowanceNote,
    commitAllowanceNoteDraft,
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
