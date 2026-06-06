import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOGIC_NETWORK_CANVAS_HEIGHT_CLASS } from '../logicNetworkLayout';
import { LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS } from '../logicNetworkFullscreen';

const logicNetworkCanvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);

const logicNetworkControlsCss = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/logicNetworkControls.css',
  ),
  'utf8',
);

const logicNetworkWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);

const logicNetworkSaveLayoutSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);

describe('Logic Network React Flow controls visibility', () => {
  it('renders Controls in both normal and chromeless full-screen canvas modes', () => {
    expect(logicNetworkCanvasSource).toContain(
      '<Controls className="logic-network-controls" position="bottom-left" />',
    );
    expect(logicNetworkCanvasSource).not.toMatch(/fullscreen\s*&&\s*<Controls/);
    expect(logicNetworkCanvasSource).not.toMatch(/chromeless\s*&&\s*<Controls/);
    expect(logicNetworkCanvasSource).toContain('if (chromeless)');
    expect(logicNetworkCanvasSource).toContain('return canvasBody');
  });

  it('styles controls with visible button background and icon color', () => {
    expect(logicNetworkCanvasSource).toContain("import './logicNetworkControls.css'");
    expect(logicNetworkControlsCss).toContain('.logic-network-controls');
    expect(logicNetworkControlsCss).toContain('z-index: 20');
    expect(logicNetworkControlsCss).toContain('background: #f8fafc');
    expect(logicNetworkControlsCss).toContain('color: #0f172a');
    expect(logicNetworkControlsCss).toContain('border-bottom: 1px solid #cbd5e1');
    expect(logicNetworkControlsCss).toContain('background: #e2e8f0');
    expect(logicNetworkControlsCss).toContain('box-shadow');
  });

  it('keeps React Flow inside sized wrappers without hiding controls behind fullscreen-only logic', () => {
    expect(LOGIC_NETWORK_CANVAS_HEIGHT_CLASS).toContain('h-[calc(100vh-300px)]');
    expect(logicNetworkCanvasSource).toContain('LOGIC_NETWORK_CANVAS_HEIGHT_CLASS');
    expect(logicNetworkCanvasSource).toContain('LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS');
    expect(logicNetworkCanvasSource).toContain('className="h-full w-full"');
    expect(logicNetworkCanvasSource).toContain('data-logic-network-canvas-wrapper');
  });

  it('preserves full-screen overlay, save layout toast, and viewport behavior', () => {
    expect(logicNetworkWorkspaceSource).toContain('LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS');
    expect(logicNetworkWorkspaceSource).toContain('createPortal');
    expect(logicNetworkSaveLayoutSource).toContain('layoutSaveToastPortal');
    expect(logicNetworkSaveLayoutSource).toContain('LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE');
    expect(logicNetworkCanvasSource).toContain('viewport={viewport}');
    expect(logicNetworkCanvasSource).toContain('onViewportChange={setViewport}');
    expect(logicNetworkCanvasSource).not.toMatch(/<Controls[\s\S]{0,120}fitView/);
  });
});
