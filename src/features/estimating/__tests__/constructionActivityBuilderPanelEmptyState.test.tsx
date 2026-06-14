import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConstructionActivityBuilderPanel from '../ui/components/ConstructionActivityBuilderPanel';

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

const panelSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/components/ConstructionActivityBuilderPanel.tsx'),
  'utf8',
);

describe('ConstructionActivityBuilderPanel empty state gating', () => {
  it('shows choose estimate type empty state before estimate type is selected', () => {
    render(
      <ConstructionActivityBuilderPanel
        projectId="project-1"
        hasEstimateTypeSelected={false}
        onChooseEstimateType={vi.fn()}
      />,
    );

    expect(screen.getByText('Choose an estimate type')).toBeInTheDocument();
    expect(
      screen.getByText(/Select an estimate type before adding activities or importing scope/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Add First Activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Import from Scope')).not.toBeInTheDocument();
  });

  it('opens estimate type selection when primary button is clicked', async () => {
    const user = userEvent.setup();
    const onChooseEstimateType = vi.fn();

    render(
      <ConstructionActivityBuilderPanel
        projectId="project-1"
        hasEstimateTypeSelected={false}
        onChooseEstimateType={onChooseEstimateType}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Choose Estimate Type' }));
    expect(onChooseEstimateType).toHaveBeenCalledTimes(1);
  });

  it('shows normal activity empty state after estimate type is selected', () => {
    render(
      <ConstructionActivityBuilderPanel projectId="project-1" hasEstimateTypeSelected estimateId="estimate-1" />,
    );

    expect(screen.getByText('No Construction Activities Yet')).toBeInTheDocument();
    expect(screen.getByText('Add First Activity')).toBeInTheDocument();
    expect(screen.getByText('Import from Scope')).toBeInTheDocument();
  });

  it('shows division shells instead of generic empty state when selectedDivisions exist', () => {
    render(
      <ConstructionActivityBuilderPanel
        projectId="project-1"
        hasEstimateTypeSelected
        estimateId="estimate-1"
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

    expect(screen.queryByText('No Construction Activities Yet')).not.toBeInTheDocument();
    expect(screen.getByText('Concrete')).toBeInTheDocument();
    expect(screen.getByText('0 activities')).toBeInTheDocument();
    expect(screen.getByText('0.0 MH')).toBeInTheDocument();
  });

  it('gates activity controls behind hasEstimateTypeSelected in source', () => {
    expect(panelSource).toContain('if (!hasEstimateTypeSelected)');
    expect(panelSource).toContain('ChooseEstimateTypeActivitiesEmptyState');
    expect(panelSource).not.toMatch(/if \(!hasEstimateTypeSelected\)[\s\S]{0,200}Add First Activity/);
  });
});
