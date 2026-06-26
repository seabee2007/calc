import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccess } from '../../contexts/AppAccessContext';
import { useEmployeeFieldContext } from '../../hooks/useEmployeeFieldContext';
import AccessLoadingSurface from '../../components/routing/AccessLoadingSurface';
import { isOwnerAppAccess } from '../../lib/appAccessRouting';
import { employeeNeedsOnboarding } from '../../lib/employeeOnboarding';
import { resolveEmployeePortalAccess } from '../../lib/employeePortalAccess';
import { isEmployeeRole } from '../../types/fieldPlanner';
import { markOnboardingCompleted, updateProfile } from '../../services/profileService';
import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/notificationPreferenceService';
import { isValidUsPhoneNumber } from '../../utils/phoneFormatting';
import Button from '../../components/ui/Button';
import { EmployeeCompanyStrip } from '../../components/employee/profile/EmployeeProfileCards';
import {
  DEFAULT_EMPLOYEE_NOTIFICATION_PREFS,
  EmployeeNotificationPrefsForm,
  notificationPrefsFromRecord,
} from '../../components/employee/profile/EmployeeNotificationPrefs';

export default function EmployeeOnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const { access, accessResolutionState, authSessionResolved, refreshAccess } = useAppAccess();
  const { context, loading: contextLoading, refresh: refreshFieldContext } = useEmployeeFieldContext(
    Boolean(user && profile?.role && isEmployeeRole(profile.role)),
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_EMPLOYEE_NOTIFICATION_PREFS);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setPhone(profile.phone ?? '');
    setJobTitle(profile.jobTitle ?? '');
  }, [profile?.id, profile?.firstName, profile?.lastName, profile?.phone, profile?.jobTitle]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void ensureNotificationPreferences()
      .then((prefs) => {
        if (active && prefs) setNotificationPrefs(notificationPrefsFromRecord(prefs));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (
    authLoading ||
    profileLoading ||
    !authSessionResolved ||
    accessResolutionState === 'loading' ||
    contextLoading
  ) {
    return <AccessLoadingSurface message="Loading your field profile…" />;
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

  const companyName = context?.company.companyName || 'your company';

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
        jobTitle: jobTitle.trim() || null,
      });
      await ensureNotificationPreferences(notificationPrefs);
      await updateNotificationPreferences(notificationPrefs);
      await markOnboardingCompleted(user.id);
      await refreshProfile();
      await refreshAccess();
      await refreshFieldContext();
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Field portal
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">Complete your field profile</h1>
        <p className="mt-2 text-sm text-slate-400">
          You&apos;ve been invited to Arden Project OS for {companyName}. Add your details so your
          team knows who you are in the field.
        </p>

        {context ? (
          <div className="mt-4">
            <EmployeeCompanyStrip
              companyName={context.company.companyName}
              phone={context.company.phone}
              logoUrl={context.company.logoUrl}
            />
          </div>
        ) : null}

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
              Phone number <span className="text-slate-500">(optional)</span>
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

          <div>
            <label htmlFor="employee-job-title" className="block text-sm font-medium text-slate-300">
              Job title <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="employee-job-title"
              type="text"
              autoComplete="organization-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300">Notification preferences</p>
            <div className="mt-2">
              <EmployeeNotificationPrefsForm
                value={notificationPrefs}
                onChange={setNotificationPrefs}
                disabled={submitting}
              />
            </div>
          </div>

          {submitError ? (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={submitting} className="min-h-[44px]">
            {submitting ? 'Saving…' : 'Go to Field Dashboard'}
          </Button>
        </form>
      </div>
    </div>
  );
}
