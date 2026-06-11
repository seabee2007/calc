import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  friendlyEstimateWorkspaceSaveError,
  type EstimateWorkspaceSaveStatusValue,
} from '../estimateWorkspaceSaveStatus';

export interface EstimateWorkspaceSaveStatusReporter {
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markError: (error?: string | null) => void;
  clearError: () => void;
}

export interface UseEstimateWorkspaceSaveStatusResult extends EstimateWorkspaceSaveStatusReporter {
  status: EstimateWorkspaceSaveStatusValue;
  lastSavedAt?: string;
  errorMessage?: string;
  activeOperations: number;
  hasPendingEstimateChanges: boolean;
}

interface UseEstimateWorkspaceSaveStatusOptions {
  hasPendingEstimateChanges: boolean;
}

const EstimateWorkspaceSaveStatusContext =
  createContext<EstimateWorkspaceSaveStatusReporter | null>(null);

export function EstimateWorkspaceSaveStatusProvider({
  value,
  children,
}: {
  value: EstimateWorkspaceSaveStatusReporter;
  children: ReactNode;
}) {
  return (
    <EstimateWorkspaceSaveStatusContext.Provider value={value}>
      {children}
    </EstimateWorkspaceSaveStatusContext.Provider>
  );
}

export function useEstimateWorkspaceSaveStatusReporter(): EstimateWorkspaceSaveStatusReporter | null {
  return useContext(EstimateWorkspaceSaveStatusContext);
}

export function useEstimateWorkspaceSaveStatus(
  options: UseEstimateWorkspaceSaveStatusOptions,
): UseEstimateWorkspaceSaveStatusResult {
  const pendingRef = useRef(options.hasPendingEstimateChanges);
  pendingRef.current = options.hasPendingEstimateChanges;

  const [state, setState] = useState<{
    status: EstimateWorkspaceSaveStatusValue;
    lastSavedAt?: string;
    errorMessage?: string;
    activeOperations: number;
  }>({
    status: 'saved',
    activeOperations: 0,
  });

  const recomputeIdleStatus = useCallback((): EstimateWorkspaceSaveStatusValue => {
    return pendingRef.current ? 'dirty' : 'saved';
  }, []);

  const markSaving = useCallback(() => {
    setState((current) => ({
      ...current,
      status: 'saving',
      activeOperations: current.activeOperations + 1,
      errorMessage: undefined,
    }));
  }, []);

  const markSaved = useCallback(() => {
    setState((current) => {
      const activeOperations = Math.max(0, current.activeOperations - 1);
      const status = activeOperations > 0 ? 'saving' : recomputeIdleStatus();
      return {
        ...current,
        activeOperations,
        status,
        lastSavedAt: activeOperations === 0 ? new Date().toISOString() : current.lastSavedAt,
        errorMessage: undefined,
      };
    });
  }, [recomputeIdleStatus]);

  const markError = useCallback((error?: string | null) => {
    setState((current) => ({
      ...current,
      status: 'error',
      activeOperations: Math.max(0, current.activeOperations - 1),
      errorMessage: friendlyEstimateWorkspaceSaveError(error),
    }));
  }, []);

  const markDirty = useCallback(() => {
    setState((current) => {
      if (current.activeOperations > 0 || current.status === 'error') return current;
      return { ...current, status: 'dirty' };
    });
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      status: recomputeIdleStatus(),
      errorMessage: undefined,
    }));
  }, [recomputeIdleStatus]);

  useEffect(() => {
    setState((current) => {
      if (current.activeOperations > 0 || current.status === 'error') return current;
      const nextStatus = recomputeIdleStatus();
      if (current.status === nextStatus) return current;
      return { ...current, status: nextStatus };
    });
  }, [options.hasPendingEstimateChanges, recomputeIdleStatus]);

  return useMemo(
    () => ({
      ...state,
      hasPendingEstimateChanges: options.hasPendingEstimateChanges,
      markDirty,
      markSaving,
      markSaved,
      markError,
      clearError,
    }),
    [
      clearError,
      markDirty,
      markError,
      markSaved,
      markSaving,
      options.hasPendingEstimateChanges,
      state,
    ],
  );
}
