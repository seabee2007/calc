import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccess } from '../../contexts/AppAccessContext';
import AccessLoadingSurface from '../../components/routing/AccessLoadingSurface';
import { isOwnerAppAccess } from '../../lib/appAccessRouting';
import { employeeNeedsOnboarding } from '../../lib/employeeOnboarding';
import { resolveEmployeePortalAccess } from '../../lib/employeePortalAccess';
import { isEmployeeRole } from '../../types/fieldPlanner';
import { markOnboardingCompleted, updateProfile } from '../../services/profileService';
import { isValidUsPhoneNumber } from '../../utils/phoneFormatting';
import Button from '../../components/ui/Button';

export default function EmployeeOnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const { access, accessResolutionState, authSessionResolved, refreshAccess } = useAppAccess();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (authLoading || profileLoading || !authSessionResolved || accessResolutionState === 'loading') {
    return <AccessLoadingSurface message="Loading your employee profile…" />;
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  if (accessResolutionState !== 'resolved' || !access) {
    return <AccessLoadingSurface />;
  }

  if (isOwnerAppAccess(access)) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  if (!profile?.role || !isEmployeeRole(profile.role)) {
    navigate('/login', { replace: true });
    return null;
  }

  const portalAccess = resolveEmployeePortalAccess(access, false);
  if (!portalAccess.allowed) {
    navigate('/employee/dashboard', { replace: true });
    return null;
  }

  if (!employeeNeedsOnboarding(profile)) {
    navigate('/employee/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      setSubmitError('First and last name are required.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidUsPhoneNumber(trimmedPhone)) {
      setPhoneError('Enter a valid US phone number.');
      return;
    }
    setPhoneError(undefined);

    setSubmitting(true);
    try {
      await updateProfile(user.id, {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        phone: trimmedPhone || null,
      });
      await markOnboardingCompleted(user.id);
      await refreshProfile();
      await refreshAccess();
      navigate('/employee/dashboard', { replace: true });
    } catch {
      setSubmitError('Could not save your profile. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Welcome to your field portal</h1>
        <p className="mt-2 text-sm text-slate-400">
          Tell us a little about yourself to finish setting up your employee account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} data-testid="employee-onboarding-form">
          <div>
            <label htmlFor="employee-first-name" className="block text-sm font-medium text-slate-300">
              First name
            </label>
            <input
              id="employee-first-name"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label htmlFor="employee-last-name" className="block text-sm font-medium text-slate-300">
              Last name
            </label>
            <input
              id="employee-last-name"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label htmlFor="employee-phone" className="block text-sm font-medium text-slate-300">
              Phone number
            </label>
            <input
              id="employee-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            {phoneError ? (
              <p className="mt-1 text-xs text-red-400" role="alert">
                {phoneError}
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={submitting} className="min-h-[44px]">
            {submitting ? 'Saving…' : 'Continue to field portal'}
          </Button>
        </form>
      </div>
    </div>
  );
}
