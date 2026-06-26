import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeProfilePage from '../EmployeeProfilePage';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'pat@example.com' },
    profile: {
      id: 'emp-1',
      role: 'employee',
      employerId: 'owner-1',
      displayName: 'Pat Lee',
      firstName: 'Pat',
      lastName: 'Lee',
      phone: '555-0100',
      jobTitle: 'Foreman',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useEmployeeFieldContext', () => ({
  useEmployeeFieldContext: () => ({
    context: {
      profile: {
        id: 'emp-1',
        role: 'employee',
        employerId: 'owner-1',
        displayName: 'Pat Lee',
        firstName: 'Pat',
        lastName: 'Lee',
        phone: '555-0100',
        jobTitle: 'Foreman',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      },
      company: {
        companyName: 'Arden Builders',
        address: '123 Main St',
        phone: '555-1000',
        email: 'office@arden.test',
        logoUrl: null,
      },
      employerContact: {
        displayName: 'Owner Name',
        phone: '555-2000',
        email: 'owner@arden.test',
      },
      membership: { role: 'foreman', status: 'active' as const },
      assignments: {
        projectCount: 2,
        taskCount: 4,
        projectNames: ['Site A'],
      },
      preferences: {
        notificationPreferences: {
          projectRemindersEnabled: true,
          emailUpdatesEnabled: true,
          inAppNotificationsEnabled: false,
        },
        userPreferences: {
          measurementSystem: 'imperial',
          currency: 'USD',
        },
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../services/appLogout', () => ({
  logoutAndRedirect: vi.fn(),
}));

vi.mock('../../../components/employee/EmployeePageTitleContext', () => ({
  useEmployeePageTitle: vi.fn(),
}));

describe('EmployeeProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows company context, role badge, and edit link', () => {
    render(
      <MemoryRouter>
        <EmployeeProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('employee-profile-header')).toHaveTextContent('Pat Lee');
    expect(screen.getByTestId('employee-profile-header')).toHaveTextContent('Arden Builders');
    expect(screen.getByTestId('employee-profile-header')).toHaveTextContent('Foreman');
    expect(screen.getByTestId('employee-profile-company')).toHaveTextContent('Arden Builders');
    expect(screen.getByTestId('employee-profile-project-count')).toHaveTextContent('2');
    expect(screen.getByTestId('employee-profile-edit-link')).toHaveAttribute(
      'href',
      '/employee/profile/edit',
    );
  });
});
