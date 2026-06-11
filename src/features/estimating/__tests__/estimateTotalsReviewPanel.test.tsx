import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';
import EstimateTotalsReviewPanel, {
  EMPTY_CONSTRUCTION_ACTIVITY_COSTS_MESSAGE,
  ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER,
  LEGACY_EMPTY_TOTALS_MESSAGE,
} from '../ui/components/EstimateTotalsReviewPanel';

function makeActivity(overrides: Partial<ProjectConstructionActivity> = {}): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Place Slab',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 40,
    totalLaborCost: 4330.97,
    ...overrides,
  };
}

function buildSettingsState(overrides: Partial<typeof DEFAULT_ESTIMATE_SETTINGS> = {}) {
  const settings = { ...DEFAULT_ESTIMATE_SETTINGS, ...overrides };
  return {
    settings,
    savedSettings: settings,
    dirty: false,
    importing: false,
    importError: null,
    updateSettings: () => {},
    replaceSettings: () => {},
    resetSettings: () => {},
    importFromUserSettings: async () => {},
    rehydrateFromEstimate: () => {},
  };
}

describe('EstimateTotalsReviewPanel', () => {
  it('shows construction activity totals for detailed estimates without a saved version', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="detailed"
        constructionActivities={[
          makeActivity(),
          makeActivity({ id: 'act-2', activityCode: '03-01-02', totalLaborCost: 0, calculatedManHours: 0 }),
          makeActivity({ id: 'act-3', activityCode: '03-01-03', totalLaborCost: 0, calculatedManHours: 0 }),
          makeActivity({ id: 'act-4', activityCode: '03-01-04', totalLaborCost: 0, calculatedManHours: 0 }),
        ]}
        settingsState={buildSettingsState()}
        canEdit
      />,
    );

    expect(screen.getByTestId(ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER)).toBeInTheDocument();
    expect(screen.queryByText(LEGACY_EMPTY_TOTALS_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getAllByText('$4,330.97').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Final sell price').length).toBeGreaterThan(0);
  });

  it('shows construction activity empty state without mentioning save a version', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="bid"
        constructionActivities={[]}
      />,
    );

    expect(screen.getByText(EMPTY_CONSTRUCTION_ACTIVITY_COSTS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/save a version/i)).not.toBeInTheDocument();
  });

  it('shows labor cost matching activity rollups on Costs & Markup', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="detailed"
        constructionActivities={[makeActivity({ totalLaborCost: 4330.97 })]}
        settingsState={buildSettingsState()}
      />,
    );

    expect(screen.getAllByText('$4,330.97').length).toBeGreaterThan(0);
  });

  it('uses construction activities totals for bid estimates', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="bid"
        constructionActivities={[makeActivity({ totalLaborCost: 1200 })]}
        settingsState={buildSettingsState()}
      />,
    );

    expect(screen.getAllByText('$1,200.00').length).toBeGreaterThan(0);
  });

  it('does not use legacy line-item totals when construction activities exist', () => {
    render(
      <EstimateTotalsReviewPanel
        version={{
          id: 'ver-1',
          estimateId: 'est-1',
          projectId: 'proj-1',
          versionNumber: 1,
          versionName: 'Legacy',
          estimateType: 'detailed',
          status: 'draft',
          snapshot: {},
          totals: {
            directCost: 99999,
            indirectCost: 0,
            overhead: 0,
            profit: 0,
            contingency: 0,
            tax: 0,
            finalSellPrice: 99999,
          },
          notes: null,
          createdBy: null,
          createdAt: '2026-06-11T00:00:00.000Z',
          lineItems: [],
          warnings: [],
        }}
        estimateType="detailed"
        constructionActivities={[makeActivity({ totalLaborCost: 2500 })]}
        settingsState={buildSettingsState()}
      />,
    );

    expect(screen.getAllByText('$2,500.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$99,999.00')).not.toBeInTheDocument();
  });

  it('shows markup settings for construction activity estimates', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="detailed"
        constructionActivities={[makeActivity()]}
        settingsState={buildSettingsState()}
        canEdit
      />,
    );

    expect(screen.getByText('Markup settings')).toBeInTheDocument();
    expect(screen.getByText('Overhead %')).toBeInTheDocument();
    expect(screen.getByText('Profit %')).toBeInTheDocument();
    expect(screen.getByText('Contingency %')).toBeInTheDocument();
    expect(screen.getByText('Tax %')).toBeInTheDocument();
  });
});
