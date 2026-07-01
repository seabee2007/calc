import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import {
  applyMasterActivityToDraftLine,
  assignActivityCodeToDraftLine,
  assignCustomActivityCodeToDraftLine,
  countMasterActivityInstances,
  CUSTOM_ACTIVITY_SEQUENCE,
  parseActivityCode,
  sortDraftLinesByActivityCode,
  syncActivityCodeFromParsedManualCode,
  validateActivityCodeUnique,
} from '../../application/estimateActivityCoding';
import { getMasterActivityByCode } from '../../data/masterActivityIndex';
import { getCsiDivisionByCode, normalizeCsiDivisionCode } from '../../domain/csiDivisions';
import {
  applyDraftLaborDefaults,
  applyDivisionScopeDefaults,
  applyEstimateSettingsToNewDraftLine,
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
import type { EstimateSettings } from '../../domain/estimateTypes';
import { usePreferencesStore } from '../../../../store';
import { getMeasurementSystemFromPreferences } from '../../../../utils/measurementPreferences';
import { preferredConstructionUnitCodes } from '../../../../utils/measurementDisplay';

export interface UseEstimateLineItemDraftResult {
  draftLines: EstimateDraftLine[];
  dirty: boolean;
  drawerOpen: boolean;
  editingClientId: string | null;
  formDraft: EstimateDraftLine | null;
  formError: string | null;
  /** Set when committing a master activity that already exists; awaits user confirmation. */
  duplicatePrompt: { masterActivityCode: string; title: string } | null;
  /** Confirm adding the duplicate master activity as another instance. */
  confirmAddInstance: () => void;
  /** Dismiss the duplicate-instance prompt without adding. */
  cancelDuplicatePrompt: () => void;
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

function applyPreferredUnitDefault(
  draft: EstimateDraftLine,
  measurementSystem: 'imperial' | 'metric',
): EstimateDraftLine {
  if (draft.unit.trim()) return draft;
  const preferredUnit = preferredConstructionUnitCodes(measurementSystem)[0] ?? 'EA';
  return {
    ...draft,
    unit: preferredUnit,
    task: {
      ...draft.task,
      calculatedValues: {
        ...draft.task.calculatedValues,
        unit: preferredUnit,
      },
    },
  };
}

export function useEstimateLineItemDraft(
  version: EstimateDomainVersion | null,
  estimateSettings?: Partial<EstimateSettings> | null,
): UseEstimateLineItemDraftResult {
  const [draftLines, setDraftLines] = useState<EstimateDraftLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formDraft, setFormDraft] = useState<EstimateDraftLine | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<
    { masterActivityCode: string; title: string } | null
  >(null);
  const { preferences } = usePreferencesStore();
  const measurementSystem = getMeasurementSystemFromPreferences(preferences);
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

  const createNewFormDraft = useCallback(
    (position: number) =>
      applyPreferredUnitDefault(
        applyDivisionScopeDefaults(
        applyDraftLaborDefaults(
          applyEstimateSettingsToNewDraftLine(createEmptyDraftLine(position), estimateSettings),
        ),
        ),
        measurementSystem,
      ),
    [estimateSettings, measurementSystem],
  );

  const openAddDrawer = useCallback(() => {
    const nextPosition = draftLines.length;
    setEditingClientId(null);
    setFormError(null);
    setFormDraft(createNewFormDraft(nextPosition));
    setDrawerOpen(true);
  }, [createNewFormDraft, draftLines.length]);

  const openAddDrawerForDivision = useCallback(
    (divisionCode: string) => {
      const nextPosition = draftLines.length;
      const line = createNewFormDraft(nextPosition);
      const normalizedDivision = normalizeCsiDivisionCode(divisionCode);
      line.task.lineItem.csiDivision = normalizedDivision;
      line.task.divisionCode = normalizedDivision;
      line.task.divisionName = getCsiDivisionByCode(normalizedDivision)?.name ?? normalizedDivision;
      setEditingClientId(null);
      setFormError(null);
      setFormDraft(applyDivisionScopeDefaults(line));
      setDrawerOpen(true);
    },
    [createNewFormDraft, draftLines.length],
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
    setDuplicatePrompt(null);
  }, []);

  const updateFormDraft = useCallback((draft: EstimateDraftLine) => {
    setFormDraft(draft);
    setFormError(null);
    setDuplicatePrompt(null);
  }, []);

  const runCommit = useCallback(
    (forceAddInstance: boolean) => {
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

      const masterCode = normalized.task.masterActivityCode?.trim();

      if (masterCode && normalized.task.isCustomActivity !== true) {
        // Master activity: code/title are fixed by the dataset; never auto-incremented.
        const master = getMasterActivityByCode(masterCode);
        if (!master) {
          // Master code no longer recognized; fall back to a custom activity.
          normalized = assignCustomActivityCodeToDraftLine(
            {
              ...normalized,
              task: { ...normalized.task, isCustomActivity: true, masterActivityCode: undefined },
            },
            draftLines,
          );
        } else if (editingClientId) {
          // Editing an existing line keeps its instance number.
          normalized = applyMasterActivityToDraftLine(
            normalized,
            master,
            normalized.task.activityInstance ?? 1,
          );
        } else {
          const existingInstances = countMasterActivityInstances(draftLines, masterCode);
          if (existingInstances > 0 && !forceAddInstance) {
            setDuplicatePrompt({ masterActivityCode: masterCode, title: master.title });
            return;
          }
          normalized = applyMasterActivityToDraftLine(normalized, master, existingInstances + 1);
        }
      } else if (normalized.task.isCustomActivity === true) {
        // Custom activity: reserved DD-99-XX code, preserving an already-assigned custom code.
        const existingCode = normalized.task.activityCode?.trim();
        const parsed = existingCode ? parseActivityCode(existingCode) : null;
        if (editingClientId && parsed && parsed.activitySequence === CUSTOM_ACTIVITY_SEQUENCE) {
          normalized = {
            ...normalized,
            task: {
              ...normalized.task,
              isCustomActivity: true,
              masterActivityCode: undefined,
              displayCode: existingCode,
            },
          };
        } else {
          normalized = assignCustomActivityCodeToDraftLine(normalized, draftLines);
        }
      } else if (normalized.task.activityCode?.trim()) {
        // Legacy/manual code: preserve it rather than regenerate.
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
        normalized = {
          ...normalized,
          task: {
            ...normalized.task,
            displayCode: normalized.task.displayCode ?? normalized.task.activityCode,
          },
        };
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
    },
    [closeDrawer, draftLines, editingClientId, formDraft],
  );

  const commitFormDraft = useCallback(() => runCommit(false), [runCommit]);

  const confirmAddInstance = useCallback(() => {
    setDuplicatePrompt(null);
    runCommit(true);
  }, [runCommit]);

  const cancelDuplicatePrompt = useCallback(() => {
    setDuplicatePrompt(null);
  }, []);

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
    duplicatePrompt,
    confirmAddInstance,
    cancelDuplicatePrompt,
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
