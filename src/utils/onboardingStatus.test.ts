import { describe, expect, it } from 'vitest';
import {
  hasEstablishedCompanySettings,
  shouldShowOwnerOnboarding,
} from './onboardingStatus';

describe('hasEstablishedCompanySettings', () => {
  it('returns true when company name is saved', () => {
    expect(hasEstablishedCompanySettings({ companyName: 'Acme Concrete' })).toBe(true);
  });

  it('returns true when email plus phone are saved', () => {
    expect(
      hasEstablishedCompanySettings({
        email: 'office@acme.com',
        phone: '(555) 123-4567',
      }),
    ).toBe(true);
  });

  it('returns false for empty defaults', () => {
    expect(
      hasEstablishedCompanySettings({
        companyName: '',
        email: '',
        phone: '',
        address: '',
      }),
    ).toBe(false);
  });
});

describe('shouldShowOwnerOnboarding', () => {
  it('shows onboarding for new owners without saved settings', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        localOnboardingCompleted: false,
        companySettings: { companyName: '' },
      }),
    ).toBe(true);
  });

  it('skips onboarding when local flag is set', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        localOnboardingCompleted: true,
        companySettings: { companyName: '' },
      }),
    ).toBe(false);
  });

  it('skips onboarding for existing owners with saved company settings', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        localOnboardingCompleted: false,
        companySettings: { companyName: 'Acme Concrete' },
      }),
    ).toBe(false);
  });

  it('skips onboarding for employees regardless of local flag', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'employee',
        localOnboardingCompleted: false,
        companySettings: { companyName: '' },
      }),
    ).toBe(false);
  });

  it('skips onboarding for owners with existing projects', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        localOnboardingCompleted: false,
        companySettings: { companyName: '' },
        hasExistingProjects: true,
      }),
    ).toBe(false);
  });

  it('forces onboarding on the test route', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        localOnboardingCompleted: true,
        companySettings: { companyName: 'Acme Concrete' },
        isTestOnboardingRoute: true,
      }),
    ).toBe(true);
  });
});
