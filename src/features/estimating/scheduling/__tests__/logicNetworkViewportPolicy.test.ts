import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_LOGIC_NETWORK_VIEWPORT,
  LOGIC_NETWORK_FIT_VIEW_TRIGGERS,
  shouldAutoFitOnInitialLoad,
  shouldResetLogicNetworkSession,
} from '../logicNetworkViewportPolicy';

const logicNetworkCanvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);

describe('logicNetworkViewportPolicy', () => {
  it('only auto-fits once on first load when nodes exist', () => {
    expect(shouldAutoFitOnInitialLoad(false, 3)).toBe(true);
    expect(shouldAutoFitOnInitialLoad(true, 3)).toBe(false);
    expect(shouldAutoFitOnInitialLoad(false, 0)).toBe(false);
  });

  it('resets session when canvas key changes', () => {
    expect(shouldResetLogicNetworkSession('project-a', null)).toBe(true);
    expect(shouldResetLogicNetworkSession('project-a', 'project-a')).toBe(false);
    expect(shouldResetLogicNetworkSession('project-b', 'project-a')).toBe(true);
  });

  it('limits fitView triggers to initial load and explicit toolbar actions', () => {
    expect(LOGIC_NETWORK_FIT_VIEW_TRIGGERS).toEqual([
      'initial-load',
      'fit-view-button',
      'auto-layout-button',
    ]);
  });

  it('Logic Network does not call fitView after node drag or link save effects', () => {
    expect(logicNetworkCanvasSource).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]*?fitView\([\s\S]*?\}, \[activities, cpmResult, layout/,
    );
    expect(logicNetworkCanvasSource).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]*?fitView\([\s\S]*?\}, \[logicLinks/,
    );
    expect(logicNetworkCanvasSource).toContain('handleLinkSave');
    expect(logicNetworkCanvasSource).not.toMatch(
      /handleLinkSave[\s\S]{0,200}fitView/,
    );
    expect(logicNetworkCanvasSource).toContain('handleNodesChange');
    expect(logicNetworkCanvasSource).not.toMatch(
      /handleNodesChange[\s\S]{0,400}fitView/,
    );
  });

  it('Logic Network only auto-fits once on first load', () => {
    expect(logicNetworkCanvasSource).toContain('hasFitInitialViewRef');
    expect(logicNetworkCanvasSource).toContain('shouldAutoFitOnInitialLoad');
    expect(logicNetworkCanvasSource).toContain('hasFitInitialViewRef.current = true');
  });

  it('preserves user viewport across re-renders', () => {
    expect(logicNetworkCanvasSource).toContain('viewport={viewport}');
    expect(logicNetworkCanvasSource).toContain('onViewportChange={setViewport}');
    expect(INITIAL_LOGIC_NETWORK_VIEWPORT).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('ReactFlow key changes only with canvasKey', () => {
    expect(logicNetworkCanvasSource).toContain('<ReactFlowProvider key={props.canvasKey}>');
    expect(logicNetworkCanvasSource).not.toMatch(/<ReactFlow\s[^>]*\bkey=/);
    expect(logicNetworkCanvasSource).not.toMatch(/key=\{nodes\.length\}/);
  });
});
