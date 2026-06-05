import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import {
  cloneDraftLine,
  createEmptyDraftLine,
  draftLinesFromVersion,
  reindexDraftLines,
  sortDraftLinesByPosition,
  syncDraftLineDescription,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';

export interface UseEstimateLineItemDraftResult {
  draftLines: EstimateDraftLine[];
  dirty: boolean;
  drawerOpen: boolean;
  editingClientId: string | null;
  formDraft: EstimateDraftLine | null;
  openAddDrawer: () => void;
  openEditDrawer: (clientId: string) => void;
  closeDrawer: () => void;
  updateFormDraft: (draft: EstimateDraftLine) => void;
  commitFormDraft: () => void;
  removeDraftLine: (clientId: string) => void;
}

export function useEstimateLineItemDraft(
  version: EstimateDomainVersion | null,
): UseEstimateLineItemDraftResult {
  const [draftLines, setDraftLines] = useState<EstimateDraftLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formDraft, setFormDraft] = useState<EstimateDraftLine | null>(null);
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
    setFormDraft(createEmptyDraftLine(nextPosition));
    setDrawerOpen(true);
  }, [draftLines.length]);

  const openEditDrawer = useCallback(
    (clientId: string) => {
      const existing = draftLines.find((line) => line.clientId === clientId);
      if (!existing) return;
      setEditingClientId(clientId);
      setFormDraft(cloneDraftLine(existing));
      setDrawerOpen(true);
    },
    [draftLines],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingClientId(null);
    setFormDraft(null);
  }, []);

  const updateFormDraft = useCallback((draft: EstimateDraftLine) => {
    setFormDraft(draft);
  }, []);

  const commitFormDraft = useCallback(() => {
    if (!formDraft) return;

    const normalized = syncDraftLineDescription(formDraft);

    setDraftLines((prev) => {
      if (editingClientId) {
        const next = prev.map((line) =>
          line.clientId === editingClientId ? normalized : line,
        );
        return reindexDraftLines(next);
      }
      return reindexDraftLines([...prev, normalized]);
    });

    setDirty(true);
    closeDrawer();
  }, [closeDrawer, editingClientId, formDraft]);

  const removeDraftLine = useCallback((clientId: string) => {
    setDraftLines((prev) => reindexDraftLines(prev.filter((line) => line.clientId !== clientId)));
    setDirty(true);
  }, []);

  const sortedDraftLines = useMemo(
    () => sortDraftLinesByPosition(draftLines),
    [draftLines],
  );

  return {
    draftLines: sortedDraftLines,
    dirty,
    drawerOpen,
    editingClientId,
    formDraft,
    openAddDrawer,
    openEditDrawer,
    closeDrawer,
    updateFormDraft,
    commitFormDraft,
    removeDraftLine,
  };
}
