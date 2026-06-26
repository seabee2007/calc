import { describe, expect, it } from 'vitest';
import {
  employeeNeedsOnboarding,
  employeeProfileNamesIncomplete,
  resolveEmployeePortalState,
  shouldAutoCompleteEmployeeOnboarding,
} from '../employeeOnboarding';

describe('employee onboarding', () => {
  it('requires onboarding when first or last name is missing', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'employee',
        employerId: 'owner-1',
        firstName: null,
        lastName: 'Lee',
      }),
    ).toBe(true);
    expect(
      employeeNeedsOnboarding({
        role: 'employee',
        employerId: 'owner-1',
        firstName: 'Pat',
        lastName: '',
      }),
    ).toBe(true);
  });

  it('skips onboarding when both names are present even without completion timestamp', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'employee',
        employerId: 'owner-1',
        firstName: 'Pat',
        lastName: 'Lee',
      }),
    ).toBe(false);
  });

  it('never treats owners as needing employee onboarding', () => {
    expect(
      employeeNeedsOnboarding({
        role: 'owner',
        employerId: null,
        firstName: null,
        lastName: null,
      }),
    ).toBe(false);
  });

  it('auto-completes onboarding when names exist but timestamp is missing', () => {
    expect(
      shouldAutoCompleteEmployeeOnboarding({
        id: 'employee-1',
        role: 'employee',
        employerId: 'owner-1',
        displayName: 'Pat Lee',
        firstName: 'Pat',
        lastName: 'Lee',
        phone: null,
        jobTitle: null,
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
      }),
    ).toBe(true);
  });

  it('detects incomplete profile names', () => {
    expect(employeeProfileNamesIncomplete({ firstName: 'Pat', lastName: null })).toBe(true);
    expect(employeeProfileNamesIncomplete({ firstName: 'Pat', lastName: 'Lee' })).toBe(false);
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
          jobTitle: null,
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
