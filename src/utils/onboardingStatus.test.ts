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

  it('returns false for bootstrap defaults with auth email only', () => {
    expect(
      hasEstablishedCompanySettings({
        companyName: '',
        email: 'owner@example.com',
        phone: '',
        address: '',
      }),
    ).toBe(false);
  });
});

describe('shouldShowOwnerOnboarding', () => {
  it('shows onboarding for new owners without onboarding_completed_at', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: null,
      }),
    ).toBe(true);
  });

  it('shows onboarding when bootstrap company_settings exist but onboarding is incomplete', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: null,
        profileAgreementAcceptedAt: '2026-01-01T00:00:00.000Z',
        companySettings: {
          companyName: '',
          email: 'owner@example.com',
          phone: '',
          address: '',
        },
      }),
    ).toBe(true);
  });

  it('shows onboarding for owners with existing projects when onboarding is incomplete', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: null,
      }),
    ).toBe(true);
  });

  it('skips onboarding when onboarding_completed_at is populated', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        profileAgreementAcceptedAt: '2026-01-01T00:00:00.000Z',
        companySettings: { companyName: '' },
      }),
    ).toBe(false);
  });

  it('does not skip onboarding based on saved company settings alone', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: null,
        companySettings: { companyName: 'Acme Concrete' },
      }),
    ).toBe(true);
  });

  it('skips onboarding for employees regardless of completion state', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'employee',
        profileOnboardingCompletedAt: null,
        companySettings: { companyName: '' },
      }),
    ).toBe(false);
  });

  it('forces onboarding on the test route', () => {
    expect(
      shouldShowOwnerOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: '2026-01-01T00:00:00.000Z',
        companySettings: { companyName: 'Acme Concrete' },
        isTestOnboardingRoute: true,
      }),
    ).toBe(true);
  });
});
