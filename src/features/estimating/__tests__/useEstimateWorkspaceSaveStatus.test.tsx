import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEstimateWorkspaceSaveStatus } from '../ui/hooks/useEstimateWorkspaceSaveStatus';

describe('useEstimateWorkspaceSaveStatus', () => {
  it('tracks saving and saved transitions for autosave operations', () => {
    const { result } = renderHook(() =>
      useEstimateWorkspaceSaveStatus({ hasPendingEstimateChanges: false }),
    );

    act(() => {
      result.current.markSaving();
    });
    expect(result.current.status).toBe('saving');

    act(() => {
      result.current.markSaved();
    });
    expect(result.current.status).toBe('saved');
  });

  it('derives dirty status from pending estimate changes', () => {
    const { result, rerender } = renderHook(
      (pending: boolean) => useEstimateWorkspaceSaveStatus({ hasPendingEstimateChanges: pending }),
      { initialProps: false },
    );

    expect(result.current.status).toBe('saved');
    rerender(true);
    expect(result.current.status).toBe('dirty');
  });

  it('stores friendly error messages for retry', () => {
    const { result } = renderHook(() =>
      useEstimateWorkspaceSaveStatus({ hasPendingEstimateChanges: false }),
    );

    act(() => {
      result.current.markSaving();
      result.current.markError(
        'duplicate key value violates unique constraint "idx_project_construction_activities_code_unique"',
      );
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toContain('activity code is already in use');
    expect(result.current.errorMessage).not.toContain('idx_project_construction_activities_code_unique');
  });

  it('clears error state before retry', () => {
    const { result } = renderHook(() =>
      useEstimateWorkspaceSaveStatus({ hasPendingEstimateChanges: false }),
    );

    act(() => {
      result.current.markError('Save failed');
    });
    expect(result.current.status).toBe('error');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.status).toBe('saved');
    expect(result.current.errorMessage).toBeUndefined();
  });
});
