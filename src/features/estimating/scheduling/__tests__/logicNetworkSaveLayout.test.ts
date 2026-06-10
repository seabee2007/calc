import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE,
  LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE,
  LOGIC_NETWORK_LAYOUT_SAVE_TOAST_Z_INDEX_CLASS,
} from '../logicNetworkSaveLayout';

const logicNetworkWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
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

const estimateWorkspacePageSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/EstimateWorkspacePage.tsx',
  ),
  'utf8',
);

const estimateWorkspaceToastSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/EstimateWorkspaceToast.tsx',
  ),
  'utf8',
);

describe('Logic Network save layout feedback', () => {
  it('defines success and error toast messages', () => {
    expect(LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE).toBe('Logic layout saved');
    expect(LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE).toBe('Could not save logic layout');
  });

  it('Save layout calls explicit persist handler with current node positions', () => {
    expect(logicNetworkWorkspaceSource).toContain('handleSaveLayout');
    expect(logicNetworkWorkspaceSource).toContain('collectCurrentLayout');
    expect(logicNetworkWorkspaceSource).toContain('onSaveLayout(layout)');
    expect(logicNetworkCanvasSource).toContain('collectCurrentLayout');
    expect(logicNetworkCanvasSource).toContain('activityCode: n.data.activity.activityCode');
    expect(logicNetworkCanvasSource).toContain('x: n.position.x');
    expect(logicNetworkCanvasSource).toContain('y: n.position.y');
    expect(estimateWorkspacePageSource).toContain('handleSaveLogicNetworkLayout');
    expect(estimateWorkspacePageSource).toContain('mergeLogicLayoutAssumptionsOnly');
  });

  it('shows success and error toasts with auto-dismiss', () => {
    expect(LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE).toBe('Logic layout saved');
    expect(LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE).toBe('Could not save logic layout');
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE');
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE');
    expect(logicNetworkWorkspaceSource).toContain('EstimateWorkspaceToast');
    expect(logicNetworkWorkspaceSource).toContain('setLayoutSaveToast');
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_LAYOUT_SAVE_TOAST_DURATION_MS');
  });

  it('renders toast above full-screen overlay', () => {
    expect(LOGIC_NETWORK_LAYOUT_SAVE_TOAST_Z_INDEX_CLASS).toBe('z-[10000]');
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_LAYOUT_SAVE_TOAST_Z_INDEX_CLASS');
    expect(logicNetworkWorkspaceSource).toContain('layoutSaveToastPortal');
    expect(estimateWorkspaceToastSource).toContain('zIndexClass');
  });

  it('does not call fitView, reset viewport, or exit full screen when saving', () => {
    const saveHandlerMatch = logicNetworkWorkspaceSource.match(
      /const handleSaveLayout = useCallback\(async \(\) => \{([\s\S]*?)\}, \[isSavingLayout, onSaveLayout\]\);/,
    );
    expect(saveHandlerMatch).not.toBeNull();
    const saveHandlerBody = saveHandlerMatch![1];
    expect(saveHandlerBody).not.toContain('fitView');
    expect(saveHandlerBody).not.toContain('setViewport');
    expect(saveHandlerBody).not.toContain('exitFullscreen');
    expect(saveHandlerBody).not.toContain('setIsFullscreen(false)');
    expect(logicNetworkCanvasSource).not.toMatch(/collectCurrentLayout[\s\S]{0,200}fitView/);
  });

  it('disables Save layout while saving and prevents duplicate clicks', () => {
    expect(logicNetworkWorkspaceSource).toContain('isSavingLayout');
    expect(logicNetworkWorkspaceSource).toContain('if (isSavingLayout) return');
    expect(logicNetworkWorkspaceSource).toContain('disabled={isSavingLayout}');
    expect(logicNetworkWorkspaceSource).toContain('Saving...');
  });
});
