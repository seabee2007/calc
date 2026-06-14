import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { EstimateWorkspaceSaveStatusValue } from '../estimateWorkspaceSaveStatus';
import {
  readEstimateWorkspaceFocusMode,
  writeEstimateWorkspaceFocusMode,
} from './estimateWorkspaceHeaderCollapseStorage';
import { usePrefersTouchLayout } from './hooks/usePrefersTouchLayout';

function miniStatusEqual(
  a: EstimateWorkspaceHeaderMiniStatus | null,
  b: EstimateWorkspaceHeaderMiniStatus | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.estimateTypeLabel === b.estimateTypeLabel &&
    a.activeTabLabel === b.activeTabLabel &&
    a.saveStatus === b.saveStatus &&
    a.saveStatusLabel === b.saveStatusLabel &&
    a.hasPendingEstimateChanges === b.hasPendingEstimateChanges
  );
}

export const ESTIMATE_WORKSPACE_HEADER_PORTAL_ID = 'estimate-workspace-header-portal';
export const ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER = 'estimate-workspace-collapsible-header';

export interface EstimateWorkspaceHeaderMiniStatus {
  estimateTypeLabel: string;
  activeTabLabel: string;
  saveStatus: EstimateWorkspaceSaveStatusValue;
  saveStatusLabel: string;
  hasPendingEstimateChanges: boolean;
}

export interface EstimateWorkspaceHeaderCollapseContextValue {
  enabled: boolean;
  focusMode: boolean;
  isMobile: boolean;
  portalReady: boolean;
  portalTargetRef: RefObject<HTMLDivElement | null>;
  miniStatus: EstimateWorkspaceHeaderMiniStatus | null;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setMiniStatus: (status: EstimateWorkspaceHeaderMiniStatus | null) => void;
  attachPortalTarget: (node: HTMLDivElement | null) => void;
}

const EstimateWorkspaceHeaderCollapseContext =
  createContext<EstimateWorkspaceHeaderCollapseContextValue | null>(null);

export function useEstimateWorkspaceHeaderCollapse(): EstimateWorkspaceHeaderCollapseContextValue | null {
  return useContext(EstimateWorkspaceHeaderCollapseContext);
}

interface ProviderProps {
  enabled: boolean;
  children: ReactNode;
}

export function EstimateWorkspaceHeaderCollapseProvider({
  enabled,
  children,
}: ProviderProps) {
  const prefersTouchLayout = usePrefersTouchLayout();
  const [focusMode, setFocusModeState] = useState(() => readEstimateWorkspaceFocusMode());
  const [miniStatus, setMiniStatusState] = useState<EstimateWorkspaceHeaderMiniStatus | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const portalTargetRef = useRef<HTMLDivElement | null>(null);

  const setMiniStatus = useCallback((status: EstimateWorkspaceHeaderMiniStatus | null) => {
    setMiniStatusState((prev) => (miniStatusEqual(prev, status) ? prev : status));
  }, []);

  const setFocusMode = useCallback(
    (next: boolean) => {
      if (prefersTouchLayout) return;
      setFocusModeState(next);
      writeEstimateWorkspaceFocusMode(next);
    },
    [prefersTouchLayout],
  );

  const toggleFocusMode = useCallback(() => {
    setFocusMode(!focusMode);
  }, [focusMode, setFocusMode]);

  const attachPortalTarget = useCallback((node: HTMLDivElement | null) => {
    portalTargetRef.current = node;
    const nextReady = Boolean(node);
    setPortalReady((prev) => (prev === nextReady ? prev : nextReady));
  }, []);

  const value = useMemo<EstimateWorkspaceHeaderCollapseContextValue>(
    () => ({
      enabled,
      focusMode: enabled && !prefersTouchLayout && focusMode,
      isMobile: prefersTouchLayout,
      portalReady,
      portalTargetRef,
      miniStatus,
      setFocusMode,
      toggleFocusMode,
      setMiniStatus,
      attachPortalTarget,
    }),
    [
      enabled,
      prefersTouchLayout,
      focusMode,
      portalReady,
      miniStatus,
      setFocusMode,
      toggleFocusMode,
      attachPortalTarget,
    ],
  );

  return (
    <EstimateWorkspaceHeaderCollapseContext.Provider value={value}>
      {children}
    </EstimateWorkspaceHeaderCollapseContext.Provider>
  );
}
