import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoCollapseHeader } from '../ui/hooks/useAutoCollapseHeader';
import {
  readEstimateWorkspaceHeaderPinned,
  writeEstimateWorkspaceHeaderPinned,
  ESTIMATE_WORKSPACE_HEADER_PINNED_KEY,
} from '../ui/estimateWorkspaceHeaderCollapseStorage';

describe('useAutoCollapseHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses after the delay when idle', () => {
    const { result } = renderHook(() =>
      useAutoCollapseHeader({ collapseDelayMs: 3000, disabled: false, overlayOpen: false }),
    );

    act(() => {
      result.current.handlePointerLeave();
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.isCollapsed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isCollapsed).toBe(true);
  });

  it('does not collapse while disabled', () => {
    const { result } = renderHook(() =>
      useAutoCollapseHeader({ collapseDelayMs: 1000, disabled: true, overlayOpen: false }),
    );

    act(() => {
      result.current.handlePointerLeave();
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCollapsed).toBe(false);
  });

  it('expands immediately on pointer enter', () => {
    const { result } = renderHook(() =>
      useAutoCollapseHeader({ collapseDelayMs: 1000, disabled: false, overlayOpen: false }),
    );

    act(() => {
      result.current.handlePointerLeave();
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.isCollapsed).toBe(true);

    act(() => {
      result.current.handlePointerEnter();
    });
    expect(result.current.isCollapsed).toBe(false);
  });
});

describe('estimateWorkspaceHeaderCollapseStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(ESTIMATE_WORKSPACE_HEADER_PINNED_KEY);
  });

  it('persists pin preference', () => {
    expect(readEstimateWorkspaceHeaderPinned()).toBe(false);
    writeEstimateWorkspaceHeaderPinned(true);
    expect(readEstimateWorkspaceHeaderPinned()).toBe(true);
    expect(localStorage.getItem(ESTIMATE_WORKSPACE_HEADER_PINNED_KEY)).toBe('true');
  });
});
