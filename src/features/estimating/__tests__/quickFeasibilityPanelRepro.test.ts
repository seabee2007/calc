import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import EstimateQuickFeasibilityPanel from '../ui/components/EstimateQuickFeasibilityPanel';

describe('EstimateQuickFeasibilityPanel render safety', () => {
  it('renders without throwing on default blank inputs', () => {
    expect(() => renderToString(createElement(EstimateQuickFeasibilityPanel))).not.toThrow();
  });

  it('renders preview hint markup for incomplete inputs', () => {
    const html = renderToString(createElement(EstimateQuickFeasibilityPanel));
    expect(html).toContain('Quick Feasibility');
    expect(html).toContain('Enter building area and select a location');
  });
});
