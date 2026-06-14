import { useEffect } from 'react';
import { useEstimateWorkspaceHeaderCollapse } from '../EstimateWorkspaceHeaderCollapseContext';

/** Registers modal/dropdown open state so the auto-collapse header stays expanded. */
export function useEstimateWorkspaceHeaderOverlay(key: string, open: boolean): void {
  const collapse = useEstimateWorkspaceHeaderCollapse();

  useEffect(() => {
    if (!collapse?.enabled) return;
    collapse.registerOverlay(key, open);
    return () => {
      collapse.registerOverlay(key, false);
    };
  }, [collapse, key, open]);
}
