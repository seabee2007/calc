import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RESOURCE_HISTOGRAM_TITLE,
  RESOURCE_HISTOGRAM_X_AXIS_LABEL,
  RESOURCE_HISTOGRAM_Y_AXIS_LABEL,
} from '../ui/components/scheduling/resourceHistogramUi';

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'components', 'scheduling');

describe('resource histogram display', () => {
  it('renders axis labels, legend, available crew line, and hover tooltip wiring', () => {
    const source = readFileSync(join(uiRoot, 'ResourceHistogram.tsx'), 'utf8');

    expect(RESOURCE_HISTOGRAM_TITLE).toBe('Daily Crew Demand');
    expect(RESOURCE_HISTOGRAM_X_AXIS_LABEL).toBe('Project day');
    expect(RESOURCE_HISTOGRAM_Y_AXIS_LABEL).toBe('Crew required');
    expect(source).toContain('RESOURCE_HISTOGRAM_X_AXIS_LABEL');
    expect(source).toContain('RESOURCE_HISTOGRAM_Y_AXIS_LABEL');
    expect(source).toContain('RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL');
    expect(source).toContain('RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL');
    expect(source).toContain('RESOURCE_HISTOGRAM_LEGEND_CRITICAL');
    expect(source).toContain('RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED');
    expect(source).toContain('data-testid="resource-histogram-tooltip"');
    expect(source).toContain('buildResourceHistogramTooltipContent');
    expect(source).toContain('onMouseEnter');
    expect(source).toContain('onFocus');
    expect(source).toContain('role="tooltip"');
    expect(source).not.toContain('setSaveToastMessage');
  });
});
