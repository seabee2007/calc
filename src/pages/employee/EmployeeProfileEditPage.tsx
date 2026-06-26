import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployeeFieldContext } from '../../hooks/useEmployeeFieldContext';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import { updateProfile } from '../../services/profileService';
import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/notificationPreferenceService';
import { isValidUsPhoneNumber } from '../../utils/phoneFormatting';
import Button from '../../components/ui/Button';
import AccessLoadingSurface from '../../components/routing/AccessLoadingSurface';
import {
  DEFAULT_EMPLOYEE_NOTIFICATION_PREFS,
  EmployeeNotificationPrefsForm,
  notificationPrefsFromRecord,
} from '../../components/employee/profile/EmployeeNotificationPrefs';

export default function EmployeeProfileEditPage() {
  useEmployeePageTitle('Edit profile');
  const navigate = useNavigate();
  const { user, profile, profileLoading, refreshProfile } = useAuth();
  const { refresh: refreshFieldContext } = useEmployeeFieldContext();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
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
    setDisplayName(profile.displayName ?? '');
    setPhone(profile.phone ?? '');
    setJobTitle(profile.jobTitle ?? '');
  }, [
    profile?.id,
    profile?.firstName,
    profile?.lastName,
    profile?.displayName,
    profile?.phone,
    profile?.jobTitle,
  ]);

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

  if (profileLoading || !profile || !user) {
    return <AccessLoadingSurface message="Loading profile…" />;
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
        displayName: displayName.trim() || `${trimmedFirst} ${trimmedLast}`.trim(),
        phone: trimmedPhone || null,
        jobTitle: jobTitle.trim() || null,
      });
      await ensureNotificationPreferences(notificationPrefs);
      await updateNotificationPreferences(notificationPrefs);
      await refreshProfile();
      await refreshFieldContext();
      navigate('/employee/profile', { replace: true });
    } catch {
      setSubmitError('Could not save your profile. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Update your personal details and notification preferences. Company settings can only be
        changed by your workspace admin.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit} data-testid="employee-profile-edit-form">
        <div>
          <label htmlFor="edit-first-name" className="block text-sm font-medium text-slate-300">
            First name
          </label>
          <input
            id="edit-first-name"
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="edit-last-name" className="block text-sm font-medium text-slate-300">
            Last name
          </label>
          <input
            id="edit-last-name"
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="edit-display-name" className="block text-sm font-medium text-slate-300">
            Display name
          </label>
          <input
            id="edit-display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="edit-phone" className="block text-sm font-medium text-slate-300">
            Phone
          </label>
          <input
            id="edit-phone"
            type="tel"
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
          <label htmlFor="edit-job-title" className="block text-sm font-medium text-slate-300">
            Job title
          </label>
          <input
            id="edit-job-title"
            type="text"
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

        <div className="flex flex-col gap-3 pt-2">
          <Button type="submit" fullWidth disabled={submitting} className="min-h-[48px]">
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            variant="outline"
            fullWidth
            className="min-h-[48px]"
            disabled={submitting}
            onClick={() => navigate('/employee/profile')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
