import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS,
  LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS,
  LEVEL_THREE_GANTT_FULLSCREEN_TIP_DISMISSED_KEY,
  isLevelThreeGanttFullscreenTipDismissed,
  setLevelThreeGanttFullscreenTipDismissed,
} from '../levelThreeGanttFullscreen';

const workspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGanttWorkspace.tsx',
  ),
  'utf8',
);

const toolbarSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGanttFullscreenToolbar.tsx',
  ),
  'utf8',
);

const modalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGanttWorkspaceOnboardingModal.tsx',
  ),
  'utf8',
);

const ganttSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LevelThreeGantt.tsx',
  ),
  'utf8',
);

const workspacePageSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/EstimateWorkspacePage.tsx',
  ),
  'utf8',
);

describe('levelThreeGanttFullscreen helpers', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tracks onboarding dismissal in localStorage', () => {
    expect(isLevelThreeGanttFullscreenTipDismissed()).toBe(false);
    setLevelThreeGanttFullscreenTipDismissed();
    expect(storage.get(LEVEL_THREE_GANTT_FULLSCREEN_TIP_DISMISSED_KEY)).toBe('true');
    expect(isLevelThreeGanttFullscreenTipDismissed()).toBe(true);
  });

  it('reuses shared typing and browser fullscreen helpers', () => {
    const fullscreenSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../levelThreeGanttFullscreen.ts'),
      'utf8',
    );
    expect(fullscreenSource).toContain("from './logicNetworkFullscreen'");
    expect(workspaceSource).toContain('isTypingTarget');
    expect(workspaceSource).toContain('requestBrowserFullscreen');
    expect(workspaceSource).toContain('exitBrowserFullscreen');
  });
});

describe('Level III Gantt workspace fullscreen UI', () => {
  it('shows Full screen button in normal toolbar', () => {
    expect(workspaceSource).toContain('Full screen');
    expect(workspaceSource).toContain('LevelThreeGanttExportMenu');
    expect(workspacePageSource).toContain('LevelThreeGanttWorkspace');
  });

  it('uses app-level fixed overlay covering the viewport', () => {
    expect(LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS).toContain('fixed inset-0');
    expect(LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS).toContain('z-[9999]');
    expect(workspaceSource).toContain('LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS');
    expect(workspaceSource).toContain('createPortal');
  });

  it('fullscreen toolbar shows title and export actions', () => {
    expect(toolbarSource).toContain('Level III Gantt');
    expect(toolbarSource).toContain('LevelThreeGanttExportMenu');
    expect(toolbarSource).toContain('Fit width');
    expect(toolbarSource).toContain('Exit full screen');
  });

  it('exposes keyboard shortcuts', () => {
    expect(workspaceSource).toContain("event.key === 'f' || event.key === 'F'");
    expect(workspaceSource).toContain("event.key === 'Escape'");
    expect(workspaceSource).toContain('isTypingTarget');
  });

  it('shows onboarding modal on first open with dismissal storage', () => {
    expect(workspaceSource).toContain('LevelThreeGanttWorkspaceOnboardingModal');
    expect(workspaceSource).toContain('isLevelThreeGanttFullscreenTipDismissed');
    expect(workspaceSource).toContain('setLevelThreeGanttFullscreenTipDismissed');
    expect(modalSource).toContain('Level III Gantt Workspace');
  });

  it('does not recalculate CPM or change bar layout when toggling full screen', () => {
    expect(workspaceSource).not.toMatch(/enterFullscreen[\s\S]{0,300}runCpm/);
    expect(workspaceSource).not.toMatch(/setIsFullscreen[\s\S]{0,200}runCpm/);
    expect(workspaceSource).not.toMatch(/enterFullscreen[\s\S]{0,300}computeActivityBarLayout/);
    expect(ganttSource).not.toMatch(/setIsFullscreen|enterFullscreen|exitFullscreen/);
    expect(ganttSource).toContain('isDisplayCritical');
    expect(ganttSource).toContain('bg-red-500');
  });

  it('sizes chart container for full height scroll in full-screen mode', () => {
    expect(LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS).toContain('min-h-0 flex-1');
    expect(workspaceSource).toContain('LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS');
    expect(workspaceSource).toContain('overflow-auto');
    expect(ganttSource).toContain('fullscreen ?');
    expect(ganttSource).toContain('h-full min-h-0 w-full');
    expect(ganttSource).toContain('min-h-0 flex-1 overflow-auto');
  });

  it('only resets scroll when user clicks Fit width', () => {
    const enterFullscreenBody =
      workspaceSource.match(/const enterFullscreen = useCallback\(async \(\) => \{[\s\S]*?\}, \[\]\)/)?.[0] ??
      '';
    const exitFullscreenBody =
      workspaceSource.match(/const exitFullscreen = useCallback\(async \(\) => \{[\s\S]*?\}, \[\]\)/)?.[0] ??
      '';

    expect(workspaceSource).toContain('fitChartWidth');
    expect(workspaceSource).toContain('scrollLeft = 0');
    expect(enterFullscreenBody).not.toContain('scrollLeft');
    expect(exitFullscreenBody).not.toContain('scrollLeft');
    expect(toolbarSource).toContain('onFitWidth');
  });

  it('locks body overflow while full-screen is active', () => {
    expect(workspaceSource).toContain("document.body.style.overflow = 'hidden'");
  });

  it('returns to normal page when exiting full-screen', () => {
    expect(workspaceSource).toContain('setIsFullscreen(false)');
    expect(workspaceSource).toContain('if (isFullscreen && typeof document !==');
    expect(workspaceSource).toContain('return shell');
  });
});
