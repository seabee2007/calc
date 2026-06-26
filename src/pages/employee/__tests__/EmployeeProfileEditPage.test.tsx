import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeProfileEditPage from '../EmployeeProfileEditPage';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
const refreshFieldContext = vi.fn().mockResolvedValue(undefined);
const updateProfile = vi.fn().mockResolvedValue({});
const updateNotificationPreferences = vi.fn().mockResolvedValue({});
const ensureNotificationPreferences = vi.fn().mockResolvedValue({});
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'emp-1', email: 'pat@example.com' },
    profile: {
      id: 'emp-1',
      role: 'employee',
      displayName: 'Pat Lee',
      firstName: 'Pat',
      lastName: 'Lee',
      phone: '555-0100',
      jobTitle: 'Foreman',
    },
    profileLoading: false,
    refreshProfile,
  }),
}));

vi.mock('../../../hooks/useEmployeeFieldContext', () => ({
  useEmployeeFieldContext: () => ({
    refresh: refreshFieldContext,
  }),
}));

vi.mock('../../../services/profileService', () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

vi.mock('../../../services/notificationPreferenceService', () => ({
  ensureNotificationPreferences: vi.fn().mockResolvedValue({
    projectRemindersEnabled: true,
    emailUpdatesEnabled: true,
    inAppNotificationsEnabled: true,
  }),
  updateNotificationPreferences: (...args: unknown[]) => updateNotificationPreferences(...args),
}));

vi.mock('../../../components/employee/EmployeePageTitleContext', () => ({
  useEmployeePageTitle: vi.fn(),
}));

describe('EmployeeProfileEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates phone and job title without company fields', async () => {
    render(
      <MemoryRouter>
        <EmployeeProfileEditPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/company/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '(555) 555-0199' } });
    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Lead Foreman' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith('emp-1', {
        firstName: 'Pat',
        lastName: 'Lee',
        displayName: 'Pat Lee',
        phone: '(555) 555-0199',
        jobTitle: 'Lead Foreman',
      });
    });

    expect(navigate).toHaveBeenCalledWith('/employee/profile', { replace: true });
  });
});
