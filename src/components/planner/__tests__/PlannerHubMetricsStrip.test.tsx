import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlannerHubMetricsStrip from '../PlannerHubMetricsStrip';

describe('PlannerHubMetricsStrip', () => {
  it('renders compact metric chips without helper text', () => {
    render(
      <PlannerHubMetricsStrip
        metrics={[{ id: 'active-plans', label: 'Active Plans', value: 2 }]}
      />,
    );

    expect(screen.getByTestId('planner-hub-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('planner-hub-metric-active-plans')).toHaveTextContent('Active Plans');
    expect(screen.getByTestId('planner-hub-metric-active-plans')).toHaveTextContent('2');
    expect(screen.queryByText(/Open a board to manage field tasks/i)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no metrics', () => {
    const { container } = render(<PlannerHubMetricsStrip metrics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
