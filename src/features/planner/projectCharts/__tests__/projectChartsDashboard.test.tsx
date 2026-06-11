import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProjectChartsDashboard from '../ProjectChartsDashboard';
import type { ProjectChartsSnapshot } from '../projectChartsTypes';
import { EMPTY_PROJECT_CHARTS_SNAPSHOT } from '../useProjectChartsData';

const snapshotWithActivities: ProjectChartsSnapshot = {
  ...EMPTY_PROJECT_CHARTS_SNAPSHOT,
  costHealth: {
    laborCost: 4330.97,
    materialCost: 0,
    equipmentCost: 0,
    subcontractorCost: 0,
    directCostSubtotal: 4330.97,
    finalSellPrice: 4330.97,
    hasActivities: true,
  },
  scopeByDivision: {
    totalActivities: 2,
    divisions: [
      {
        divisionCode: '03',
        divisionName: 'Concrete',
        activityCount: 2,
        totalManHours: 80,
        laborCost: 4330.97,
      },
    ],
  },
};

function renderDashboard(snapshot: ProjectChartsSnapshot = EMPTY_PROJECT_CHARTS_SNAPSHOT) {
  return render(
    <MemoryRouter>
      <ProjectChartsDashboard projectId="project-1" snapshot={snapshot} />
    </MemoryRouter>,
  );
}

describe('ProjectChartsDashboard', () => {
  it('renders without activities', () => {
    renderDashboard();
    expect(screen.getByTestId('project-charts-dashboard')).toBeInTheDocument();
    expect(screen.getAllByTestId('project-chart-empty-state').length).toBeGreaterThan(0);
  });

  it('shows cost health labor total when activities exist', () => {
    renderDashboard(snapshotWithActivities);
    expect(screen.getByTestId('project-chart-cost-health')).toBeInTheDocument();
    expect(screen.getAllByText('$4,330.97').length).toBeGreaterThan(0);
  });

  it('shows labor demand empty state when no CPM exists', () => {
    renderDashboard(snapshotWithActivities);
    expect(screen.getByTestId('project-chart-labor-demand')).toHaveTextContent(
      'Run CPM to generate labor demand charts.',
    );
  });

  it('does not show planned-vs-actual progress copy', () => {
    renderDashboard(snapshotWithActivities);
    expect(screen.queryByText(/planned-vs-actual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/progress by division/i)).not.toBeInTheDocument();
    expect(screen.getByText('Scope by Division')).toBeInTheDocument();
    expect(screen.getByText('Schedule Readiness')).toBeInTheDocument();
  });

  it('links cost health to Costs & Markup', () => {
    renderDashboard(snapshotWithActivities);
    const link = screen.getByTestId('project-chart-cost-health').querySelector('a');
    expect(link?.getAttribute('href')).toContain('/planner/estimate/overview');
  });
});

describe('PlannerChartsPage route safety', () => {
  it('renders dashboard with empty snapshot without crashing', () => {
    renderDashboard(EMPTY_PROJECT_CHARTS_SNAPSHOT);
    expect(screen.getByText('Cost Health')).toBeInTheDocument();
    expect(screen.getByText('Change Order Impact')).toBeInTheDocument();
  });
});
