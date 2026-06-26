import { describe, expect, it, vi } from 'vitest';
import {
  getEmployeeFieldContext,
  mapEmployeeFieldContextRpc,
  roleLabelForFieldPortal,
} from '../../services/employeeFieldContextService';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('../../services/notificationPreferenceService', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/userPreferencesService', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({
    units: 'imperial',
    measurementSystem: 'imperial',
    currency: 'USD',
  }),
}));

import { supabase } from '../../lib/supabase';

describe('employeeFieldContextService', () => {
  it('maps RPC payload into typed context', () => {
    const mapped = mapEmployeeFieldContextRpc({
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
      membership: {
        role: 'employee',
        status: 'active',
      },
      assignments: {
        projectCount: 2,
        taskCount: 5,
        projectNames: ['Site A', 'Site B'],
      },
    });

    expect(mapped.company.companyName).toBe('Arden Builders');
    expect(mapped.assignments.projectCount).toBe(2);
    expect(mapped.assignments.projectNames).toEqual(['Site A', 'Site B']);
    expect(mapped.profile.jobTitle).toBe('Foreman');
  });

  it('calls get_employee_field_context RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        profile: {
          id: 'emp-1',
          role: 'employee',
          employerId: 'owner-1',
          displayName: null,
          firstName: null,
          lastName: null,
          phone: null,
          jobTitle: null,
          onboardingCompletedAt: null,
        },
        company: {
          companyName: 'Co',
          address: '',
          phone: '',
          email: '',
          logoUrl: null,
        },
        employerContact: null,
        membership: { role: 'employee', status: 'active' },
        assignments: { projectCount: 0, taskCount: 0, projectNames: [] },
      },
      error: null,
    });

    const result = await getEmployeeFieldContext();
    expect(supabase.rpc).toHaveBeenCalledWith('get_employee_field_context');
    expect(result?.company.companyName).toBe('Co');
  });

  it('labels field portal roles', () => {
    expect(roleLabelForFieldPortal('foreman')).toBe('Foreman');
    expect(roleLabelForFieldPortal('project_manager')).toBe('Project Manager');
  });
});
