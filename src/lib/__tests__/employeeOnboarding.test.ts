import { describe, expect, it } from 'vitest';
import { employeeNeedsOnboarding, resolveEmployeePortalState } from '../employeeOnboarding';

describe('employee onboarding', () => {
  it('requires onboarding for linked employees without completion timestamp', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'employee',
        employerId: 'owner-1',
        onboardingCompletedAt: null,
      }),
    ).toBe(true);
  });

  it('does not require onboarding after completion', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'employee',
        employerId: 'owner-1',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('never treats owners as needing employee onboarding', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'owner',
        employerId: null,
        onboardingCompletedAt: null,
      }),
    ).toBe(false);
  });

  it('resolves portal state to needs_employee_onboarding when allowed but profile incomplete', () => {
    expect(
      resolveEmployeePortalState({
        authLoading: false,
        profileLoading: false,
        accessLoading: false,
        portalAllowed: true,
        profile: {
          id: 'employee-1',
          role: 'employee',
          employerId: 'owner-1',
          displayName: null,
          firstName: null,
          lastName: null,
          phone: null,
          businessAddressStreet: null,
          businessAddressStreet2: null,
          businessAddressCity: null,
          businessAddressState: null,
          businessAddressPostalCode: null,
          agreementAcceptedAt: null,
          agreementVersion: null,
          onboardingCompletedAt: null,
          onboardingVersion: null,
          createdAt: '',
          updatedAt: '',
        },
      }),
    ).toBe('needs_employee_onboarding');
  });
});
