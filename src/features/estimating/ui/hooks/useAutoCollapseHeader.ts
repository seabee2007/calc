import { useCallback, useEffect, useRef, useState } from 'react';

export const ESTIMATE_WORKSPACE_HEADER_COLLAPSE_DELAY_MS = 3000;
export const ESTIMATE_WORKSPACE_HEADER_TRANSITION_MS = 500;

export interface UseAutoCollapseHeaderOptions {
  collapseDelayMs?: number;
  disabled?: boolean;
  overlayOpen?: boolean;
}

export interface UseAutoCollapseHeaderResult {
  isCollapsed: boolean;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
  isFocusedWithin: boolean;
  setIsFocusedWithin: (focused: boolean) => void;
  expand: () => void;
  handlePointerEnter: () => void;
  handlePointerLeave: () => void;
}

export function useAutoCollapseHeader({
  collapseDelayMs = ESTIMATE_WORKSPACE_HEADER_COLLAPSE_DELAY_MS,
  disabled = false,
  overlayOpen = false,
}: UseAutoCollapseHeaderOptions): UseAutoCollapseHeaderResult {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusedWithin, setIsFocusedWithin] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const expand = useCallback(() => {
    clearCollapseTimer();
    setIsCollapsed(false);
  }, [clearCollapseTimer]);

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer();
    if (disabled || overlayOpen || isHovered || isFocusedWithin) return;
    collapseTimerRef.current = setTimeout(() => {
      setIsCollapsed(true);
    }, collapseDelayMs);
  }, [
    clearCollapseTimer,
    collapseDelayMs,
    disabled,
    overlayOpen,
    isHovered,
    isFocusedWithin,
  ]);

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    expand();
  }, [expand]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    scheduleCollapse();
  }, [scheduleCollapse]);

  useEffect(() => {
    if (disabled || overlayOpen || isHovered || isFocusedWithin) {
      expand();
      return;
    }
    scheduleCollapse();
    return clearCollapseTimer;
  }, [
    disabled,
    overlayOpen,
    isHovered,
    isFocusedWithin,
    expand,
    scheduleCollapse,
    clearCollapseTimer,
  ]);

  useEffect(() => () => clearCollapseTimer(), [clearCollapseTimer]);

  return {
    isCollapsed,
    isHovered,
    setIsHovered,
    isFocusedWithin,
    setIsFocusedWithin,
    expand,
    handlePointerEnter,
    handlePointerLeave,
  };
}
