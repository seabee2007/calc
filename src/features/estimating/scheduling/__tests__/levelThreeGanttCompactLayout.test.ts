import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../ui/components/scheduling',
);

const workspaceSource = readFileSync(resolve(uiRoot, 'LevelThreeGanttWorkspace.tsx'), 'utf8');
const histogramSource = readFileSync(resolve(uiRoot, 'ResourceHistogram.tsx'), 'utf8');
const ganttSource = readFileSync(resolve(uiRoot, 'LevelThreeGantt.tsx'), 'utf8');
const pageSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

describe('Level III Gantt compact layout', () => {
  it('uses a compact workspace header with summary and export dropdown', () => {
    expect(workspaceSource).toContain('LevelThreeGanttExportMenu');
    expect(workspaceSource).toContain('LevelThreeGanttLegend');
    expect(workspaceSource).toContain('data-testid="level-three-gantt-summary"');
    expect(workspaceSource).not.toContain('Export PDF');
    expect(workspaceSource).not.toContain('Export Excel');
    expect(workspaceSource).toContain('Sorted by early start');
  });

  it('moves gantt legend out of chromeless chart', () => {
    expect(ganttSource).toContain('!chromeless ?');
    expect(ganttSource).toContain('Critical path');
    expect(workspaceSource).toContain('LevelThreeGanttLegend');
  });

  it('uses compact crew demand header with metric chips and leveling actions', () => {
    expect(histogramSource).toContain('data-testid="resource-histogram-metrics"');
    expect(histogramSource).toContain('data-testid="resource-histogram-level-button"');
    expect(histogramSource).toContain('data-testid="resource-histogram-clear-leveling-button"');
    expect(histogramSource).not.toContain('grid-cols-4');
    expect(histogramSource).toContain('data-testid="resource-histogram-legend"');
  });

  it('wires resource leveling through the workspace instead of a separate page row', () => {
    expect(pageSource).toContain('onResourceLevel={');
    expect(pageSource).toContain('onClearLeveling={');
    expect(pageSource).not.toMatch(
      />\s*Resource level schedule\s*<\//,
    );
  });
});
