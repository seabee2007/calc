import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EstimateWorkspaceTab } from './components/EstimateWorkspaceTabBar';

interface EstimateWorkspaceSidebarNavContextValue {
  tabs: EstimateWorkspaceTab[];
  setTabs: (tabs: EstimateWorkspaceTab[]) => void;
}

const EstimateWorkspaceSidebarNavContext =
  createContext<EstimateWorkspaceSidebarNavContextValue | null>(null);

export function EstimateWorkspaceSidebarNavProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabsState] = useState<EstimateWorkspaceTab[]>([]);
  const setTabs = useCallback((nextTabs: EstimateWorkspaceTab[]) => {
    setTabsState(nextTabs);
  }, []);

  const value = useMemo(() => ({ tabs, setTabs }), [tabs, setTabs]);

  return (
    <EstimateWorkspaceSidebarNavContext.Provider value={value}>
      {children}
    </EstimateWorkspaceSidebarNavContext.Provider>
  );
}

export function useEstimateWorkspaceSidebarNavTabs(): EstimateWorkspaceTab[] {
  return useContext(EstimateWorkspaceSidebarNavContext)?.tabs ?? [];
}

export function useRegisterEstimateWorkspaceSidebarNav(): (tabs: EstimateWorkspaceTab[]) => void {
  const context = useContext(EstimateWorkspaceSidebarNavContext);
  if (!context) {
    return () => undefined;
  }
  return context.setTabs;
}

/** Publishes entitlement-filtered estimate tabs to the planner sidebar while mounted. */
export function useSyncEstimateWorkspaceSidebarNav(tabs: EstimateWorkspaceTab[]): void {
  const setTabs = useRegisterEstimateWorkspaceSidebarNav();
  useEffect(() => {
    setTabs(tabs);
    return () => setTabs([]);
  }, [setTabs, tabs]);
}
