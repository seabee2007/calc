import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS,
  LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS,
  LOGIC_NETWORK_FULLSCREEN_TIP_DISMISSED_KEY,
  isLogicNetworkFullscreenTipDismissed,
  setLogicNetworkFullscreenTipDismissed,
} from '../logicNetworkFullscreen';

const logicNetworkWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);

const logicNetworkModalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspaceOnboardingModal.tsx',
  ),
  'utf8',
);

const logicNetworkCanvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);

describe('logicNetworkFullscreen helpers', () => {
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
    expect(isLogicNetworkFullscreenTipDismissed()).toBe(false);
    setLogicNetworkFullscreenTipDismissed();
    expect(storage.get(LOGIC_NETWORK_FULLSCREEN_TIP_DISMISSED_KEY)).toBe('true');
    expect(isLogicNetworkFullscreenTipDismissed()).toBe(true);
  });

  it('isTypingTarget checks input, textarea, select, and contenteditable', () => {
    const fullscreenSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../logicNetworkFullscreen.ts'),
      'utf8',
    );
    expect(fullscreenSource).toContain('HTMLInputElement');
    expect(fullscreenSource).toContain('HTMLTextAreaElement');
    expect(fullscreenSource).toContain('HTMLSelectElement');
    expect(fullscreenSource).toContain('isContentEditable');
  });
});

describe('Logic Network workspace fullscreen UI', () => {
  it('shows onboarding modal on first open with dismissal storage', () => {
    expect(logicNetworkWorkspaceSource).toContain('LogicNetworkWorkspaceOnboardingModal');
    expect(logicNetworkWorkspaceSource).toContain('isLogicNetworkFullscreenTipDismissed');
    expect(logicNetworkWorkspaceSource).toContain('setLogicNetworkFullscreenTipDismissed');
    expect(logicNetworkModalSource).toContain('Logic Network Workspace');
  });

  it('uses app-level fixed overlay covering the viewport', () => {
    expect(LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS).toContain('fixed inset-0');
    expect(LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS).toContain('z-[9999]');
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS');
    expect(logicNetworkWorkspaceSource).toContain('createPortal');
  });

  it('exposes full screen button and keyboard shortcuts', () => {
    expect(logicNetworkWorkspaceSource).toContain('Full screen');
    expect(logicNetworkWorkspaceSource).toContain("event.key === 'f' || event.key === 'F'");
    expect(logicNetworkWorkspaceSource).toContain("event.key === 'Escape'");
    expect(logicNetworkWorkspaceSource).toContain('isTypingTarget');
  });

  it('does not render a standalone help button in the toolbar', () => {
    expect(logicNetworkWorkspaceSource).not.toContain('Show Logic Network workspace tips');
    expect(logicNetworkWorkspaceSource).not.toMatch(/>\s*\?\s*<\/button>/);
    expect(logicNetworkWorkspaceSource).toContain('Check logic');
    expect(logicNetworkWorkspaceSource).toContain('Auto layout');
    expect(logicNetworkWorkspaceSource).toContain('Fit view');
    expect(logicNetworkWorkspaceSource).toContain('Save layout');
  });

  it('optionally syncs browser fullscreen API', () => {
    expect(logicNetworkWorkspaceSource).toContain('requestBrowserFullscreen');
    expect(logicNetworkWorkspaceSource).toContain('exitBrowserFullscreen');
    expect(logicNetworkWorkspaceSource).toContain('fullscreenchange');
  });

  it('does not call fitView when toggling full screen', () => {
    expect(logicNetworkWorkspaceSource).not.toMatch(/enterFullscreen[\s\S]{0,300}fitView/);
    expect(logicNetworkWorkspaceSource).not.toMatch(/exitFullscreen[\s\S]{0,300}fitView/);
    expect(logicNetworkWorkspaceSource).not.toMatch(/setIsFullscreen\([\s\S]{0,120}fitView/);
    expect(logicNetworkWorkspaceSource).not.toMatch(/fullscreenchange[\s\S]{0,200}fitView/);
    expect(logicNetworkCanvasSource).not.toMatch(/setIsFullscreen|enterFullscreen|exitFullscreen/);
  });

  it('sizes React Flow explicitly in normal and full-screen modes', () => {
    expect(logicNetworkCanvasSource).toContain('LOGIC_NETWORK_CANVAS_HEIGHT_CLASS');
    expect(logicNetworkCanvasSource).toContain('LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS');
    expect(logicNetworkCanvasSource).toContain('className="h-full w-full"');
    expect(LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS).toContain('min-h-0 flex-1');
    expect(LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS).toContain('w-full');
  });

  it('lifts viewport state so toggling full screen does not reset pan/zoom', () => {
    expect(logicNetworkWorkspaceSource).toContain('viewport={viewport}');
    expect(logicNetworkWorkspaceSource).toContain('onViewportChange={setViewport}');
    expect(logicNetworkWorkspaceSource).toContain('hasFitInitialViewRef={hasFitInitialViewRef}');
  });
});
