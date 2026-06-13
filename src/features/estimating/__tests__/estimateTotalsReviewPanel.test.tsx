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
    expect(
      screen.getByText(/Estimate pricing, markup, contingency, tax, and final sell price/),
    ).toBeInTheDocument();
    expect(screen.getByText('Indirect cost %')).toBeInTheDocument();
    expect(screen.getByText('Overhead %')).toBeInTheDocument();
    expect(screen.getByText('Profit %')).toBeInTheDocument();
    expect(screen.getByText('Contingency %')).toBeInTheDocument();
    expect(screen.getByText('Tax %')).toBeInTheDocument();
    expect(screen.getByText('Apply overhead to')).toBeInTheDocument();
    expect(screen.getByText('Apply profit to')).toBeInTheDocument();
    expect(screen.getByText('Tax applies to')).toBeInTheDocument();
  });

  it('still calculates construction activity labor totals', () => {
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

  it('shows labor planning metrics from schedule rollup', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="detailed"
        constructionActivities={[
          makeActivity({ calculatedManHours: 85.3, totalLaborCost: 4330.97 }),
        ]}
        settingsState={buildSettingsState()}
        scheduleActivities={[
          {
            activityCode: '03-01-01',
            activityDescription: 'Place Slab',
            divisionCode: '03',
            divisionName: 'Concrete',
            durationDays: 2,
            laborHours: 28.4,
            manDays: 3.55,
            crewDays: 0.8875,
            crewSize: 4,
            totalCost: 4330.97,
            relationshipType: 'FS',
            lagDays: 0,
          },
          {
            activityCode: '03-01-02',
            activityDescription: 'Wall',
            divisionCode: '03',
            divisionName: 'Concrete',
            durationDays: 1,
            laborHours: 28.4,
            manDays: 3.55,
            crewDays: 0.8875,
            crewSize: 3,
            totalCost: 0,
            relationshipType: 'FS',
            lagDays: 0,
          },
          {
            activityCode: '03-01-03',
            activityDescription: 'Finish',
            divisionCode: '03',
            divisionName: 'Concrete',
            durationDays: 1,
            laborHours: 28.5,
            manDays: 3.5625,
            crewDays: 0.890625,
            crewSize: 2,
            totalCost: 0,
            relationshipType: 'FS',
            lagDays: 0,
          },
        ]}
        projectDurationDays={4}
      />,
    );

    expect(screen.getByText('85.3 hr')).toBeInTheDocument();
    expect(screen.getByText('10.7 MD')).toBeInTheDocument();
    expect(screen.getByText('Scheduled crew-days')).toBeInTheDocument();
    expect(screen.getByText('13.0 CD')).toBeInTheDocument();
    expect(screen.getByText('4d')).toBeInTheDocument();
    expect(screen.getByText('Project duration')).toBeInTheDocument();
    expect(screen.getByText(/Labor crew-days convert labor effort/i)).toBeInTheDocument();
  });

  it('includes project material and equipment resources in cost breakdown', () => {
    render(
      <EstimateTotalsReviewPanel
        version={null}
        estimateType="detailed"
        constructionActivities={[makeActivity({ totalLaborCost: 1000 })]}
        projectMaterialResources={[
          {
            id: 'mat-1',
            activityId: 'act-1',
            projectId: 'project-1',
            name: 'Drywall',
            quantity: 2,
            unit: 'SF',
            unitCost: 100,
            totalCost: 200,
            sourceProvider: 'manual',
          },
        ]}
        projectEquipmentResources={[
          {
            id: 'equip-1',
            activityId: 'act-1',
            projectId: 'project-1',
            name: 'Lift',
            quantity: 1,
            unit: 'day',
            unitCost: 300,
            totalCost: 300,
            sourceProvider: 'manual',
          },
        ]}
        settingsState={buildSettingsState()}
      />,
    );

    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getAllByText('$1,500.00').length).toBeGreaterThan(0);
  });
});
