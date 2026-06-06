import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import {
  assignActivityCodeToDraftLine,
  sortDraftLinesByActivityCode,
  syncActivityCodeFromParsedManualCode,
  validateActivityCodeUnique,
} from '../../application/estimateActivityCoding';
import { getCsiDivisionByCode, normalizeCsiDivisionCode } from '../../domain/csiDivisions';
import {
  applyDraftLaborDefaults,
  applyDivisionScopeDefaults,
  cloneDraftLine,
  createEmptyDraftLine,
  draftLinesFromVersion,
  duplicateDraftLine,
  moveDraftLineDown,
  moveDraftLineUp,
  reindexDraftLines,
  syncDraftLineDescription,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';

export interface UseEstimateLineItemDraftResult {
  draftLines: EstimateDraftLine[];
  dirty: boolean;
  drawerOpen: boolean;
  editingClientId: string | null;
  formDraft: EstimateDraftLine | null;
  formError: string | null;
  openAddDrawer: () => void;
  openAddDrawerForDivision: (divisionCode: string) => void;
  openEditDrawer: (clientId: string) => void;
  closeDrawer: () => void;
  updateFormDraft: (draft: EstimateDraftLine) => void;
  commitFormDraft: () => void;
  removeDraftLine: (clientId: string) => void;
  duplicateDraftLine: (clientId: string) => void;
  moveDraftLineUp: (clientId: string) => void;
  moveDraftLineDown: (clientId: string) => void;
  /** Rehydrate draft from a saved version and clear dirty state. */
  rehydrateFromVersion: (nextVersion: EstimateDomainVersion) => void;
  /** Discard unsaved draft edits and restore the saved version baseline locally. */
  resetDraftSetup: () => void;
}

export function useEstimateLineItemDraft(
  version: EstimateDomainVersion | null,
): UseEstimateLineItemDraftResult {
  const [draftLines, setDraftLines] = useState<EstimateDraftLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formDraft, setFormDraft] = useState<EstimateDraftLine | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const hydratedVersionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!version) {
      setDraftLines([]);
      setDirty(false);
      hydratedVersionIdRef.current = null;
      return;
    }

    if (hydratedVersionIdRef.current === version.id) return;

    setDraftLines(draftLinesFromVersion(version.lineItems));
    setDirty(false);
    hydratedVersionIdRef.current = version.id;
  }, [version]);

  const openAddDrawer = useCallback(() => {
    const nextPosition = draftLines.length;
    setEditingClientId(null);
    setFormError(null);
    setFormDraft(applyDraftLaborDefaults(createEmptyDraftLine(nextPosition)));
    setDrawerOpen(true);
  }, [draftLines.length]);

  const openAddDrawerForDivision = useCallback(
    (divisionCode: string) => {
      const nextPosition = draftLines.length;
      const line = applyDraftLaborDefaults(createEmptyDraftLine(nextPosition));
      const normalizedDivision = normalizeCsiDivisionCode(divisionCode);
      line.task.lineItem.csiDivision = normalizedDivision;
      line.task.divisionCode = normalizedDivision;
      line.task.divisionName = getCsiDivisionByCode(normalizedDivision)?.name ?? normalizedDivision;
      setEditingClientId(null);
      setFormError(null);
      setFormDraft(applyDivisionScopeDefaults(line));
      setDrawerOpen(true);
    },
    [draftLines.length],
  );

  const openEditDrawer = useCallback(
    (clientId: string) => {
      const existing = draftLines.find((line) => line.clientId === clientId);
      if (!existing) return;
      setEditingClientId(clientId);
      setFormError(null);
      setFormDraft(cloneDraftLine(existing));
      setDrawerOpen(true);
    },
    [draftLines],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingClientId(null);
    setFormDraft(null);
    setFormError(null);
  }, []);

  const updateFormDraft = useCallback((draft: EstimateDraftLine) => {
    setFormDraft(draft);
    setFormError(null);
  }, []);

  const commitFormDraft = useCallback(() => {
    if (!formDraft) return;

    let normalized = syncDraftLineDescription(
      applyDivisionScopeDefaults(applyDraftLaborDefaults(formDraft)),
    );

    const divisionCode = normalizeCsiDivisionCode(
      normalized.task.divisionCode ?? normalized.task.lineItem.csiDivision,
    );
    if (divisionCode) {
      normalized = {
        ...normalized,
        task: {
          ...normalized.task,
          divisionCode,
          divisionName:
            normalized.task.divisionName ??
            getCsiDivisionByCode(divisionCode)?.name ??
            divisionCode,
          lineItem: {
            ...normalized.task.lineItem,
            csiDivision: divisionCode,
          },
        },
      };
    }

    const workingLines = editingClientId
      ? draftLines.map((line) => (line.clientId === editingClientId ? normalized : line))
      : [...draftLines, normalized];

    if (normalized.task.activityCode?.trim()) {
      normalized = syncActivityCodeFromParsedManualCode(normalized, workingLines);
      const uniquenessError = validateActivityCodeUnique(
        normalized.task.activityCode,
        workingLines,
        editingClientId ?? normalized.clientId,
      );
      if (uniquenessError) {
        setFormError(uniquenessError);
        return;
      }
    } else {
      normalized = assignActivityCodeToDraftLine(normalized, draftLines, {
        preserveManualCode: false,
      });
    }

    setDraftLines(() => {
      const next = editingClientId
        ? draftLines.map((line) => (line.clientId === editingClientId ? normalized : line))
        : [...draftLines, normalized];
      return reindexDraftLines(sortDraftLinesByActivityCode(next));
    });

    setDirty(true);
    closeDrawer();
  }, [closeDrawer, draftLines, editingClientId, formDraft]);

  const removeDraftLine = useCallback((clientId: string) => {
    setDraftLines((prev) => reindexDraftLines(prev.filter((line) => line.clientId !== clientId)));
    setDirty(true);
  }, []);

  const duplicateDraftLineById = useCallback((clientId: string) => {
    setDraftLines((prev) => duplicateDraftLine(prev, clientId));
    setDirty(true);
  }, []);

  const moveDraftLineUpById = useCallback((clientId: string) => {
    setDraftLines((prev) => moveDraftLineUp(prev, clientId));
    setDirty(true);
  }, []);

  const moveDraftLineDownById = useCallback((clientId: string) => {
    setDraftLines((prev) => moveDraftLineDown(prev, clientId));
    setDirty(true);
  }, []);

  const rehydrateFromVersion = useCallback((nextVersion: EstimateDomainVersion) => {
    setDraftLines(draftLinesFromVersion(nextVersion.lineItems));
    setDirty(false);
    hydratedVersionIdRef.current = nextVersion.id;
    setDrawerOpen(false);
    setEditingClientId(null);
    setFormDraft(null);
  }, []);

  const resetDraftSetup = useCallback(() => {
    if (version) {
      setDraftLines(draftLinesFromVersion(version.lineItems));
      setDirty(false);
    } else {
      setDraftLines([]);
      setDirty(false);
    }
    setDrawerOpen(false);
    setEditingClientId(null);
    setFormDraft(null);
  }, [version]);

  const sortedDraftLines = useMemo(
    () => sortDraftLinesByActivityCode(draftLines),
    [draftLines],
  );

  return {
    draftLines: sortedDraftLines,
    dirty,
    drawerOpen,
    editingClientId,
    formDraft,
    formError,
    openAddDrawer,
    openAddDrawerForDivision,
    openEditDrawer,
    closeDrawer,
    updateFormDraft,
    commitFormDraft,
    removeDraftLine,
    duplicateDraftLine: duplicateDraftLineById,
    moveDraftLineUp: moveDraftLineUpById,
    moveDraftLineDown: moveDraftLineDownById,
    rehydrateFromVersion,
    resetDraftSetup,
  };
}
