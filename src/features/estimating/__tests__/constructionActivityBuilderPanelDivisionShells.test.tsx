import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConstructionActivityBuilderPanel, {
  buildDivisionActivityGroups,
} from '../ui/components/ConstructionActivityBuilderPanel';
import { buildSelectedDivisionsFromCodes } from '../application/estimateWorkBreakdown';

vi.mock('../ui/hooks/useConstructionActivities', () => ({
  useConstructionActivities: () => ({
    activities: [],
    lineItemsMap: new Map(),
    loading: false,
    saving: false,
    error: null,
    reload: vi.fn(),
    projectRates: [],
    addFromProductionRateAssembly: vi.fn(),
    addManualActivity: vi.fn(),
    updateActivity: vi.fn(),
    remove: vi.fn(),
  }),
}));

const SELECTED_DIVISIONS = buildSelectedDivisionsFromCodes(
  ['01', '03', '06', '07', '08', '09', '22', '23', '26', '31'],
  { source: 'ai' },
);

describe('buildDivisionActivityGroups', () => {
  it('includes selected divisions with zero activities', () => {
    const groups = buildDivisionActivityGroups(SELECTED_DIVISIONS, []);
    expect(groups.map((group) => group.divisionCode)).toEqual([
      '01',
      '03',
      '06',
      '07',
      '08',
      '09',
      '22',
      '23',
      '26',
      '31',
    ]);
    expect(groups.every((group) => group.items.length === 0)).toBe(true);
  });

  it('merges activity-backed divisions with selected division shells', () => {
    const groups = buildDivisionActivityGroups(SELECTED_DIVISIONS, [
      {
        id: 'act-1',
        projectId: 'proj-1',
        divisionCode: '03',
        divisionName: 'Concrete',
        title: 'Place slab',
        name: 'Place slab',
        calculatedManHours: 12,
      } as never,
    ]);

    const concrete = groups.find((group) => group.divisionCode === '03');
    expect(concrete?.items).toHaveLength(1);
    expect(groups).toHaveLength(10);
  });
});

describe('ConstructionActivityBuilderPanel division shells', () => {
  it('renders imported division headers when selectedDivisions exist and activities are empty', () => {
    render(
      <ConstructionActivityBuilderPanel
        projectId="project-1"
        estimateId="estimate-1"
        hasEstimateTypeSelected
        selectedDivisions={SELECTED_DIVISIONS}
      />,
    );

    expect(screen.getByText('Construction Activities')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Divisions imported from scope\. Add production-rate-backed activities from the library/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Concrete')).toBeInTheDocument();
    expect(screen.getByText('Earthwork')).toBeInTheDocument();
    expect(screen.getAllByText('0 activities').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.0 MH').length).toBeGreaterThan(0);
    expect(screen.queryByText('No Construction Activities Yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Divisions Imported from Scope')).not.toBeInTheDocument();
  });

  it('shows empty division inner state with add activity button when expanded', async () => {
    const user = userEvent.setup();

    render(
      <ConstructionActivityBuilderPanel
        projectId="project-1"
        estimateId="estimate-1"
        hasEstimateTypeSelected
        selectedDivisions={[
          {
            code: '03',
            name: 'Concrete',
            source: 'ai',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /03.*Concrete/i }));

    expect(screen.getByText('No activities added yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Activity from Production Rate Library' }),
    ).toBeInTheDocument();
  });
});
