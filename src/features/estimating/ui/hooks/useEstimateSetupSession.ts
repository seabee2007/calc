import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendEstimateSetupDivisionCodes,
  buildEstimateSetupVersionKey,
  createEstimateSetupResetState,
  createEstimateSetupStartState,
  createInitialEstimateSetupSession,
  shouldReinitializeSetupSessionFromVersion,
  type EstimateSetupSessionState,
} from '../../application/estimateStartFlow';
import { normalizeSelectedDivisionCodes } from '../../application/estimateWorkBreakdown';
import { DEFAULT_ESTIMATE_METHOD, normalizeEstimateMethod } from '../../domain/estimateMethods';
import type { EstimateType } from '../../domain/estimateTypes';

export interface UseEstimateSetupSessionResult {
  session: EstimateSetupSessionState;
  quickPanelResetKey: number;
  setSelectedEstimateType: (type: EstimateType) => void;
  startSetup: (type: EstimateType) => void;
  resetSetup: (savedEstimateType: EstimateType) => void;
  setSelectedDivisionCodes: (codes: string[]) => void;
  mergeDivisionCodes: (codes: readonly string[]) => void;
}

export function useEstimateSetupSession(
  projectId: string,
  versionId: string | null | undefined,
  savedEstimateType: EstimateType | null | undefined,
): UseEstimateSetupSessionResult {
  const normalizedSavedType = normalizeEstimateMethod(savedEstimateType ?? DEFAULT_ESTIMATE_METHOD);
  const hydratedVersionKeyRef = useRef<string | null>(null);
  const hydratedProjectIdRef = useRef<string | null>(null);
  const hasUserStartedSetupRef = useRef(false);
  const hasUserResetSetupRef = useRef(false);
  const [session, setSession] = useState<EstimateSetupSessionState>(() =>
    createInitialEstimateSetupSession(normalizedSavedType),
  );
  const [quickPanelResetKey, setQuickPanelResetKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;

    const projectChanged = hydratedProjectIdRef.current !== projectId;
    if (projectChanged) {
      hydratedProjectIdRef.current = projectId;
      hydratedVersionKeyRef.current = null;
      hasUserStartedSetupRef.current = false;
      hasUserResetSetupRef.current = false;
      setSession(createInitialEstimateSetupSession(normalizedSavedType));
      setQuickPanelResetKey(0);
    }

    if (!versionId) return;

    const versionKey = buildEstimateSetupVersionKey(projectId, versionId);
    if (
      !shouldReinitializeSetupSessionFromVersion(hydratedVersionKeyRef.current, versionKey)
    ) {
      return;
    }

    hydratedVersionKeyRef.current = versionKey;
    if (!hasUserStartedSetupRef.current && !hasUserResetSetupRef.current) {
      setSession(createInitialEstimateSetupSession(normalizedSavedType));
      setQuickPanelResetKey(0);
    }
  }, [projectId, versionId, normalizedSavedType]);

  const setSelectedEstimateType = useCallback((type: EstimateType) => {
    setSession((prev) => ({ ...prev, selectedEstimateType: type }));
  }, []);

  const startSetup = useCallback((type: EstimateType) => {
    hasUserStartedSetupRef.current = true;
    setSession(createEstimateSetupStartState(type));
  }, []);

  const resetSetup = useCallback((savedType: EstimateType) => {
    hasUserResetSetupRef.current = true;
    hasUserStartedSetupRef.current = false;
    setSession(createEstimateSetupResetState(savedType));
    setQuickPanelResetKey((key) => key + 1);
  }, []);

  const setSelectedDivisionCodes = useCallback((codes: string[]) => {
    setSession((prev) => ({
      ...prev,
      selectedDivisionCodes: normalizeSelectedDivisionCodes(codes),
    }));
  }, []);

  const mergeDivisionCodes = useCallback((codes: readonly string[]) => {
    setSession((prev) => appendEstimateSetupDivisionCodes(prev, codes));
  }, []);

  return {
    session,
    quickPanelResetKey,
    setSelectedEstimateType,
    startSetup,
    resetSetup,
    setSelectedDivisionCodes,
    mergeDivisionCodes,
  };
}
