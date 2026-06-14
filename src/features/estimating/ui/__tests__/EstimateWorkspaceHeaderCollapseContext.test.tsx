import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  EstimateWorkspaceHeaderCollapseProvider,
  useEstimateWorkspaceHeaderCollapse,
} from '../EstimateWorkspaceHeaderCollapseContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <EstimateWorkspaceHeaderCollapseProvider enabled>
      {children}
    </EstimateWorkspaceHeaderCollapseProvider>
  );
}

describe('EstimateWorkspaceHeaderCollapseProvider', () => {
  it('does not update miniStatus when values are unchanged', () => {
    const { result } = renderHook(() => useEstimateWorkspaceHeaderCollapse(), { wrapper });

    const status = {
      estimateTypeLabel: 'Unit price',
      activeTabLabel: 'Line items',
      saveStatus: 'saved' as const,
      saveStatusLabel: 'Saved',
      hasPendingEstimateChanges: false,
    };

    act(() => {
      result.current?.setMiniStatus(status);
    });
    const firstRef = result.current?.miniStatus;

    act(() => {
      result.current?.setMiniStatus({ ...status });
    });
    const secondRef = result.current?.miniStatus;

    expect(secondRef).toBe(firstRef);
  });
});
