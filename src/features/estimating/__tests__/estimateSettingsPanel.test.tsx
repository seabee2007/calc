import { render, screen } from '@testing-library/react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';
import EstimateSettingsPanel, {
  ESTIMATE_SETTINGS_DESCRIPTION,
} from '../ui/components/EstimateSettingsPanel';
import { useEstimateSettings } from '../ui/hooks/useEstimateSettings';

vi.mock('../ui/components/ProjectLaborRateScheduleSection', () => ({
  default: () => <div data-testid="project-labor-rate-schedule">Project Labor Rate Schedule</div>,
}));

function buildSettingsState(overrides: Partial<typeof DEFAULT_ESTIMATE_SETTINGS> = {}) {
  const settings = { ...DEFAULT_ESTIMATE_SETTINGS, ...overrides };
  return {
    settings,
    savedSettings: settings,
    dirty: false,
    importing: false,
    importError: null,
    updateSettings: vi.fn(),
    replaceSettings: vi.fn(),
    resetSettings: vi.fn(),
    importFromUserSettings: vi.fn(async () => {}),
    rehydrateFromEstimate: vi.fn(),
  };
}

function renderPanel() {
  return render(
    <EstimateSettingsPanel
      settingsState={buildSettingsState()}
      canEdit
      projectId="project-1"
      estimateType="detailed"
      schedulingEnabled
      onEstimateTypeChange={() => {}}
      onSchedulingEnabledChange={() => {}}
      projectCrewSize={8}
      onProjectCrewSizeChange={() => {}}
    />,
  );
}

describe('EstimateSettingsPanel pricing separation', () => {
  it('uses workflow-focused settings description', () => {
    renderPanel();
    expect(screen.getByText(ESTIMATE_SETTINGS_DESCRIPTION)).toBeInTheDocument();
  });

  it('still renders Estimate Workflow', () => {
    renderPanel();
    expect(screen.getByText('Estimate workflow')).toBeInTheDocument();
    expect(screen.getByText('Scheduling enabled')).toBeInTheDocument();
  });

  it('still renders Project Labor Rate Schedule', () => {
    renderPanel();
    expect(screen.getByTestId('project-labor-rate-schedule')).toBeInTheDocument();
  });

  it('does not render generic labor rate input', () => {
    renderPanel();
    expect(screen.queryByLabelText('Labor rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Labor rate')).not.toBeInTheDocument();
  });

  it('does not render generic burden percent input', () => {
    renderPanel();
    expect(screen.queryByText('Burden %')).not.toBeInTheDocument();
  });

  it('does not render material markup percent input', () => {
    renderPanel();
    expect(screen.queryByText('Material markup %')).not.toBeInTheDocument();
  });

  it('does not render equipment markup percent input', () => {
    renderPanel();
    expect(screen.queryByText('Equipment markup %')).not.toBeInTheDocument();
  });

  it('does not render subcontractor markup percent input', () => {
    renderPanel();
    expect(screen.queryByText('Subcontractor markup %')).not.toBeInTheDocument();
  });

  it('does not render overhead percent input', () => {
    renderPanel();
    expect(screen.queryByText('Overhead %')).not.toBeInTheDocument();
  });

  it('does not render profit percent input', () => {
    renderPanel();
    expect(screen.queryByText('Profit %')).not.toBeInTheDocument();
  });

  it('does not render contingency percent input', () => {
    renderPanel();
    expect(screen.queryByText('Contingency %')).not.toBeInTheDocument();
  });

  it('does not render tax percent input', () => {
    renderPanel();
    expect(screen.queryByText('Tax %')).not.toBeInTheDocument();
  });

  it('does not render the removed Pricing section', () => {
    renderPanel();
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
  });

  it('still renders estimate defaults', () => {
    renderPanel();
    expect(screen.getByText('Defaults')).toBeInTheDocument();
    expect(screen.getByText('Hours per day')).toBeInTheDocument();
    expect(screen.getByText('Default activity crew size')).toBeInTheDocument();
  });
});

describe('estimate settings persistence boundaries', () => {
  it('markup updates do not reset labor default fields in estimate settings state', () => {
    const { result } = renderHook(() => useEstimateSettings());

    act(() => {
      result.current.updateSettings({
        defaultLaborRate: 55,
        burdenPercent: 12,
      });
    });
    act(() => {
      result.current.updateSettings({
        overheadPercent: 10,
        profitPercent: 8,
        contingencyPercent: 5,
        taxPercent: 7,
      });
    });

    expect(result.current.settings.defaultLaborRate).toBe(55);
    expect(result.current.settings.burdenPercent).toBe(12);
    expect(result.current.settings.overheadPercent).toBe(10);
    expect(result.current.settings.profitPercent).toBe(8);
    expect(result.current.settings.contingencyPercent).toBe(5);
    expect(result.current.settings.taxPercent).toBe(7);
  });

  it('labor default updates do not reset markup fields in estimate settings state', () => {
    const { result } = renderHook(() => useEstimateSettings());

    act(() => {
      result.current.updateSettings({
        overheadPercent: 10,
        profitPercent: 8,
      });
    });
    act(() => {
      result.current.updateSettings({
        defaultLaborRate: 60,
        burdenPercent: 15,
      });
    });

    expect(result.current.settings.overheadPercent).toBe(10);
    expect(result.current.settings.profitPercent).toBe(8);
    expect(result.current.settings.defaultLaborRate).toBe(60);
    expect(result.current.settings.burdenPercent).toBe(15);
    expect(result.current.settings.contingencyPercent).toBe(
      DEFAULT_ESTIMATE_SETTINGS.contingencyPercent,
    );
  });
});
