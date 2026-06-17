import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WeatherForecastWidget from './WeatherForecastWidget';
import type { DashboardCardContext } from '../layout/dashboardData';
import { US_COUNTRY_LABEL } from '../../../types/address';
import type { Project } from '../../../types';

const mockNavigate = vi.fn();
const getForecastByQuery = vi.fn();
const mockPlan = vi.hoisted(() => ({ current: 'starter' as 'free' | 'starter' | 'professional' | 'business' }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../services/weatherService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/weatherService')>(
    '../../../services/weatherService',
  );
  return {
    ...actual,
    getForecastByQuery: (...args: unknown[]) => getForecastByQuery(...args),
  };
});

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ plan: mockPlan.current }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: null }),
}));

vi.mock('../../../store', () => ({
  useSettingsStore: (selector: (state: { companySettings: { address: string } }) => unknown) =>
    selector({ companySettings: { address: '' } }),
}));

function projectWithSite(id: string, name: string): Project {
  return {
    id,
    name,
    description: '',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    calculations: [],
    jobsiteAddress: {
      street: '100 Main St',
      street2: '',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      country: US_COUNTRY_LABEL,
    },
  };
}

function minimalCtx(projects: Project[] = [projectWithSite('p1', 'Alpha')]): DashboardCardContext {
  return {
    isOwner: true,
    projects,
    proposals: [],
    snapshot: { activeProjectCount: projects.length, projects: [] } as DashboardCardContext['snapshot'],
    qcStats: {} as DashboardCardContext['qcStats'],
    scheduleSnapshot: null,
    projectRiskReview: {} as DashboardCardContext['projectRiskReview'],
    crmRevenueMetrics: {} as DashboardCardContext['crmRevenueMetrics'],
    prePlacement: { checks: {}, attention: [] },
    financial: {} as DashboardCardContext['financial'],
    pipeline: {} as DashboardCardContext['pipeline'],
    proposalWeightedForecast: 0,
    totalQcRecords: 0,
    hasAnyConcreteWork: false,
    allProjectsClosedOut: false,
    nextUpcomingPlacement: null,
    fieldNotesProject: null,
    dashboardExtraActions: [],
    onStartProject: vi.fn(),
    onQuickQuote: vi.fn(),
  };
}

const sampleForecast = {
  location: { city: 'Portland', country: 'United States' },
  forecast: [
    {
      date: '2026-06-17',
      maxTemp: 72,
      minTemp: 55,
      avgTemp: 64,
      maxWindSpeed: 12,
      chanceOfRain: 20,
      totalPrecipitation: 0,
      conditions: 'Partly cloudy',
      avgHumidity: 55,
      hourly: [
        { hour: 8, temp: 60, windSpeed: 8, humidity: 50, chanceOfRain: 10, conditions: 'Clear' },
        { hour: 12, temp: 70, windSpeed: 10, humidity: 45, chanceOfRain: 15, conditions: 'Cloudy' },
      ],
    },
    {
      date: '2026-06-18',
      maxTemp: 68,
      minTemp: 52,
      avgTemp: 60,
      maxWindSpeed: 14,
      chanceOfRain: 40,
      totalPrecipitation: 0.1,
      conditions: 'Light rain',
    },
  ],
};

describe('WeatherForecastWidget', () => {
  beforeEach(() => {
    mockPlan.current = 'starter';
    mockNavigate.mockReset();
    getForecastByQuery.mockReset();
    getForecastByQuery.mockResolvedValue(sampleForecast);
  });

  it('shows setup state when no location sources are available', () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx([])} cardWidth={6} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('weather-location-selector')).toBeInTheDocument();
    expect(screen.getByTestId('weather-forecast-setup')).toBeInTheDocument();
    expect(screen.getByText(/Set your location to see My Weather/i)).toBeInTheDocument();
    expect(screen.getByTestId('weather-forecast-setup-settings')).toBeInTheDocument();
    expect(getForecastByQuery).not.toHaveBeenCalled();
  });

  it('loads and renders half-width single-day forecast', async () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={6} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-single-day')).toBeInTheDocument();
    });
    expect(getForecastByQuery).toHaveBeenCalledWith(
      expect.stringContaining('Portland'),
      1,
      expect.objectContaining({ forceRefresh: false }),
    );
    expect(screen.getByText(/WEATHER RISK: GOOD/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View details/i })).not.toBeInTheDocument();
  });

  it('renders compact view for third-width cards', async () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={4} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-compact')).toBeInTheDocument();
    });
  });

  it('renders wide side-by-side layout for full-width cards', async () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={12} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-wide')).toBeInTheDocument();
    });
    expect(screen.getByTestId('weather-forecast-today-summary')).toBeInTheDocument();
    expect(screen.getByTestId('weather-forecast-strip')).toBeInTheDocument();
    expect(screen.getAllByTestId('weather-forecast-day-tile-wide').length).toBeGreaterThan(0);
    expect(getForecastByQuery).toHaveBeenCalledWith(
      expect.stringContaining('Portland'),
      7,
      expect.objectContaining({ forceRefresh: false }),
    );
    expect(screen.queryByRole('button', { name: /View details/i })).not.toBeInTheDocument();
  });

  it('renders compact two-thirds operations layout for 8-column cards', async () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={8} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-two-thirds')).toBeInTheDocument();
    });
    expect(screen.getByTestId('weather-forecast-two-thirds-summary')).toBeInTheDocument();
    expect(screen.getByTestId('weather-forecast-two-thirds-strip')).toBeInTheDocument();
    expect(screen.getByText(/WEATHER RISK: GOOD/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View details/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('weather-forecast-today-summary')).not.toBeInTheDocument();
    expect(getForecastByQuery).toHaveBeenCalledWith(
      expect.stringContaining('Portland'),
      5,
      expect.objectContaining({ forceRefresh: false }),
    );
  });

  it('shows error state and retries', async () => {
    getForecastByQuery.mockResolvedValueOnce(null);
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={6} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-error')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Could not load forecast for this project jobsite./i),
    ).toBeInTheDocument();

    getForecastByQuery.mockResolvedValueOnce(sampleForecast);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByTestId('weather-forecast-single-day')).toBeInTheDocument();
    });
    expect(getForecastByQuery).toHaveBeenLastCalledWith(
      expect.any(String),
      1,
      expect.objectContaining({ forceRefresh: true }),
    );
  });

  it('shows sign-in message when weather request is unauthorized', async () => {
    const { WeatherServiceError } = await import('../../../services/weatherService');
    getForecastByQuery.mockRejectedValueOnce(
      new WeatherServiceError('User must be authenticated to load weather forecast.', 'unauthorized', 401),
    );

    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={6} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign in again to load the jobsite forecast/i)).toBeInTheDocument();
    });
  });
  it('shows location selector with project options', async () => {
    render(
      <MemoryRouter>
        <WeatherForecastWidget
          ctx={minimalCtx([
            projectWithSite('p1', 'Alpha'),
            projectWithSite('p2', 'Beta'),
          ])}
          cardWidth={6}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('weather-location-selector')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('weather-location-selector-trigger'));
    expect(screen.getByTestId('weather-location-option-my')).toBeInTheDocument();
    expect(screen.getByTestId('weather-location-option-p1')).toBeInTheDocument();
    expect(screen.getByTestId('weather-location-option-p2')).toBeInTheDocument();
  });

  it('refetches when a different project is selected', async () => {
    const projects = [
      projectWithSite('p1', 'Alpha'),
      {
        ...projectWithSite('p2', 'Beta'),
        updatedAt: '2026-06-20T00:00:00Z',
        jobsiteAddress: {
          street: '200 Ocean Dr',
          street2: '',
          city: 'Tamuning',
          state: 'GU',
          zip: '96913',
          country: US_COUNTRY_LABEL,
        },
      },
    ];

    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx(projects)} cardWidth={6} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getForecastByQuery).toHaveBeenCalledWith(
        expect.stringContaining('Tamuning'),
        1,
        expect.objectContaining({ forceRefresh: false }),
      );
    });

    getForecastByQuery.mockClear();
    fireEvent.click(screen.getByTestId('weather-location-selector-trigger'));
    fireEvent.click(screen.getByTestId('weather-location-option-p1'));

    await waitFor(() => {
      expect(getForecastByQuery).toHaveBeenCalledWith(
        expect.stringContaining('Portland'),
        1,
        expect.objectContaining({ forceRefresh: false }),
      );
    });
  });

  it('shows upgrade required on free plan', () => {
    mockPlan.current = 'free';
    render(
      <MemoryRouter>
        <WeatherForecastWidget ctx={minimalCtx()} cardWidth={6} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('weather-forecast-upgrade')).toBeInTheDocument();
    expect(getForecastByQuery).not.toHaveBeenCalled();
  });
});
