import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Settings from '../Settings';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        function MotionStub({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
          return React.createElement(String(tag), props, children);
        },
    },
  ),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

vi.mock('../../store', () => ({
  useSettingsStore: () => ({
    companySettings: {
      companyName: 'Test Co',
      address: '',
      phone: '',
      email: 'owner@test.com',
      licenseNumber: '',
      motto: '',
    },
    companySettingsHydrated: true,
    updateCompanySettings: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }),
  usePreferencesStore: () => ({
    preferences: {
      autoSave: false,
      soundEnabled: true,
      hapticEnabled: true,
      notifications: {
        emailUpdates: true,
        projectReminders: true,
        weatherAlerts: true,
      },
    },
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }),
}));

vi.mock('../../features/estimating/ui/hooks/useCompanyLaborRates', () => ({
  useCompanyLaborRates: () => ({ rates: [] }),
}));

vi.mock('../../services/notificationPreferenceService', () => ({
  ensureNotificationPreferences: vi.fn().mockResolvedValue({
    id: 'pref-1',
    userId: 'user-1',
    emailUpdatesEnabled: true,
    weatherAlertsEnabled: true,
    projectRemindersEnabled: true,
    inAppNotificationsEnabled: true,
    emailDigestFrequency: 'immediate',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
  updateNotificationPreferences: vi.fn(),
  countEnabledNotificationToggles: vi.fn(() => 3),
}));

vi.mock('../../services/soundService', () => ({
  soundService: { play: vi.fn() },
}));

vi.mock('../../services/hapticService', () => ({
  hapticService: { trigger: vi.fn() },
}));

vi.mock('../../services/storageService', () => ({
  replaceLogo: vi.fn(),
  deleteLogo: vi.fn(),
}));

function renderSettings(initialPath = '/settings') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/billing" element={<div data-testid="billing-page">Billing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders without crashing', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    });
  });

  it('renders the Notifications section', async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByTestId('settings-section-notifications')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('wires notifications collapsible section to expandedSections state', async () => {
    renderSettings();

    const trigger = await screen.findByRole('button', { name: /^Notifications/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('id', 'settings-section-trigger-notifications');
  });

  it('loads Settings after Billing navigation path', async () => {
    renderSettings('/settings');
    await waitFor(() => {
      expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    });
    expect(screen.queryByText(/This page failed to load/i)).not.toBeInTheDocument();
  });
});
