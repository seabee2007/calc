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
  readEstimateWorkspaceHeaderPinned,
  writeEstimateWorkspaceHeaderPinned,
} from './estimateWorkspaceHeaderCollapseStorage';
import { useAutoCollapseHeader } from './hooks/useAutoCollapseHeader';
import { usePrefersTouchLayout } from './hooks/usePrefersTouchLayout';

export const ESTIMATE_WORKSPACE_HEADER_PORTAL_ID = 'estimate-workspace-header-portal';
export const ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER = 'estimate-workspace-collapsible-header';

export interface EstimateWorkspaceHeaderMiniStatus {
  estimateTypeLabel: string;
  saveStatus: EstimateWorkspaceSaveStatusValue;
  saveStatusLabel: string;
  hasPendingEstimateChanges: boolean;
}

export interface EstimateWorkspaceHeaderCollapseContextValue {
  enabled: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  isMobile: boolean;
  portalReady: boolean;
  portalTargetRef: RefObject<HTMLDivElement | null>;
  miniStatus: EstimateWorkspaceHeaderMiniStatus | null;
  setPinned: (pinned: boolean) => void;
  expand: () => void;
  setMiniStatus: (status: EstimateWorkspaceHeaderMiniStatus | null) => void;
  registerOverlay: (key: string, open: boolean) => void;
  handlePointerEnter: () => void;
  handlePointerLeave: () => void;
  setIsFocusedWithin: (focused: boolean) => void;
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
  const [isPinned, setIsPinnedState] = useState(() => readEstimateWorkspaceHeaderPinned());
  const [miniStatus, setMiniStatus] = useState<EstimateWorkspaceHeaderMiniStatus | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [overlayOpenCount, setOverlayOpenCount] = useState(0);
  const portalTargetRef = useRef<HTMLDivElement | null>(null);
  const overlayRegistryRef = useRef(new Map<string, boolean>());

  const setPinned = useCallback((pinned: boolean) => {
    setIsPinnedState(pinned);
    writeEstimateWorkspaceHeaderPinned(pinned);
  }, []);

  const registerOverlay = useCallback((key: string, open: boolean) => {
    overlayRegistryRef.current.set(key, open);
    let count = 0;
    overlayRegistryRef.current.forEach((value) => {
      if (value) count += 1;
    });
    setOverlayOpenCount(count);
  }, []);

  const attachPortalTarget = useCallback((node: HTMLDivElement | null) => {
    portalTargetRef.current = node;
    setPortalReady(Boolean(node));
  }, []);

  const autoCollapseDisabled = !enabled || prefersTouchLayout || isPinned;

  const {
    isCollapsed,
    setIsFocusedWithin,
    expand,
    handlePointerEnter,
    handlePointerLeave,
  } = useAutoCollapseHeader({
    disabled: autoCollapseDisabled,
    overlayOpen: overlayOpenCount > 0,
  });

  const value = useMemo<EstimateWorkspaceHeaderCollapseContextValue>(
    () => ({
      enabled,
      isCollapsed: enabled && !prefersTouchLayout && isCollapsed,
      isPinned,
      isMobile: prefersTouchLayout,
      portalReady,
      portalTargetRef,
      miniStatus,
      setPinned,
      expand,
      setMiniStatus,
      registerOverlay,
      handlePointerEnter,
      handlePointerLeave,
      setIsFocusedWithin,
      attachPortalTarget,
    }),
    [
      enabled,
      prefersTouchLayout,
      isCollapsed,
      isPinned,
      portalReady,
      miniStatus,
      setPinned,
      expand,
      registerOverlay,
      handlePointerEnter,
      handlePointerLeave,
      attachPortalTarget,
    ],
  );

  return (
    <EstimateWorkspaceHeaderCollapseContext.Provider value={value}>
      {children}
    </EstimateWorkspaceHeaderCollapseContext.Provider>
  );
}
