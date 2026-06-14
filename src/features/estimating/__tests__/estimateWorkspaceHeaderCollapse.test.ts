import { describe, expect, it, beforeEach } from 'vitest';
import {
  readEstimateWorkspaceFocusMode,
  writeEstimateWorkspaceFocusMode,
  ESTIMATE_WORKSPACE_FOCUS_MODE_KEY,
} from '../ui/estimateWorkspaceHeaderCollapseStorage';

describe('estimateWorkspaceFocusMode storage', () => {
  beforeEach(() => {
    localStorage.removeItem(ESTIMATE_WORKSPACE_FOCUS_MODE_KEY);
  });

  it('defaults focus mode to false', () => {
    expect(readEstimateWorkspaceFocusMode()).toBe(false);
  });

  it('persists focus mode preference', () => {
    writeEstimateWorkspaceFocusMode(true);
    expect(readEstimateWorkspaceFocusMode()).toBe(true);
    expect(localStorage.getItem(ESTIMATE_WORKSPACE_FOCUS_MODE_KEY)).toBe('true');
  });
});
