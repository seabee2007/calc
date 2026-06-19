import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface PlannerWorkspaceFocusContextValue {
  workspaceFocusMode: boolean;
  setWorkspaceFocusMode: (enabled: boolean) => void;
}

const PlannerWorkspaceFocusContext = createContext<PlannerWorkspaceFocusContextValue | null>(null);

export function PlannerWorkspaceFocusProvider({ children }: { children: ReactNode }) {
  const [workspaceFocusMode, setWorkspaceFocusModeState] = useState(false);

  const setWorkspaceFocusMode = useCallback((enabled: boolean) => {
    setWorkspaceFocusModeState(enabled);
  }, []);

  const value = useMemo<PlannerWorkspaceFocusContextValue>(
    () => ({
      workspaceFocusMode,
      setWorkspaceFocusMode,
    }),
    [workspaceFocusMode, setWorkspaceFocusMode],
  );

  return (
    <PlannerWorkspaceFocusContext.Provider value={value}>
      {children}
    </PlannerWorkspaceFocusContext.Provider>
  );
}

export function usePlannerWorkspaceFocus(): PlannerWorkspaceFocusContextValue | null {
  return useContext(PlannerWorkspaceFocusContext);
}
