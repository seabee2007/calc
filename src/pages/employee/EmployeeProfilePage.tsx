import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Pencil } from 'lucide-react';
import { logoutAndRedirect } from '../../services/appLogout';
import { useAuth } from '../../hooks/useAuth';
import { useEmployeeFieldContext } from '../../hooks/useEmployeeFieldContext';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';
import { roleLabelForFieldPortal } from '../../services/employeeFieldContextService';
import {
  profileInitials,
  resolveBrowserTimezone,
  resolveFieldFullName,
} from '../../lib/fieldDisplayName';
import {
  EmployeeProfileField,
  EmployeeProfileHeader,
  EmployeeProfileSection,
} from '../../components/employee/profile/EmployeeProfileCards';
import {
  DEFAULT_EMPLOYEE_NOTIFICATION_PREFS,
  EmployeeNotificationPrefsSummary,
  notificationPrefsFromRecord,
} from '../../components/employee/profile/EmployeeNotificationPrefs';
import AccessLoadingSurface from '../../components/routing/AccessLoadingSurface';
import Button from '../../components/ui/Button';

export default function EmployeeProfilePage() {
  useEmployeePageTitle('Profile');
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { context, loading, error, refresh } = useEmployeeFieldContext();

  const handleSignOut = () => {
    void logoutAndRedirect(signOut, navigate);
  };

  if (loading) {
    return <AccessLoadingSurface message="Loading profile…" />;
  }

  const fullName = resolveFieldFullName({
    displayName: profile?.displayName,
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    email: user?.email,
  });

  const initials = profileInitials({
    displayName: profile?.displayName,
    firstName: profile?.firstName,
    lastName: profile?.lastName,
  });

  const roleLabel = roleLabelForFieldPortal(context?.membership.role ?? profile?.role ?? 'employee');
  const notificationPrefs = notificationPrefsFromRecord(
    context?.preferences?.notificationPreferences ?? null,
  );
  const userPrefs = context?.preferences?.userPreferences;
  const employerContact = context?.employerContact;
  const projectNames = context?.assignments.projectNames ?? [];

  return (
    <div className="space-y-4">
      <EmployeeProfileHeader
        initials={initials}
        fullName={fullName}
        jobTitle={profile?.jobTitle ?? context?.profile.jobTitle ?? null}
        companyName={context?.company.companyName ?? ''}
        roleLabel={roleLabel}
      />

      {error ? (
        <p className="text-sm text-amber-400" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      ) : null}

      <EmployeeProfileSection title="Personal info">
        <dl className="space-y-3">
          <EmployeeProfileField label="First name" value={profile?.firstName} />
          <EmployeeProfileField label="Last name" value={profile?.lastName} />
          <EmployeeProfileField label="Display name" value={profile?.displayName} />
          <EmployeeProfileField label="Email" value={user?.email} />
          <EmployeeProfileField label="Phone" value={profile?.phone} />
          <EmployeeProfileField label="Job title" value={profile?.jobTitle} />
        </dl>
      </EmployeeProfileSection>

      {context ? (
        <EmployeeProfileSection title="Company" testId="employee-profile-company">
          <dl className="space-y-3">
            <EmployeeProfileField label="Company" value={context.company.companyName} />
            <EmployeeProfileField label="Phone" value={context.company.phone} />
            <EmployeeProfileField label="Address" value={context.company.address} />
            <EmployeeProfileField
              label="Owner / admin contact"
              value={
                employerContact?.displayName ||
                employerContact?.email ||
                employerContact?.phone ||
                null
              }
            />
          </dl>
        </EmployeeProfileSection>
      ) : null}

      {context ? (
        <EmployeeProfileSection title="Field access">
          <dl className="space-y-3">
            <EmployeeProfileField label="Permission role" value={roleLabel} />
            <EmployeeProfileField
              label="Assigned projects"
              value={String(context.assignments.projectCount)}
              testId="employee-profile-project-count"
            />
            <EmployeeProfileField
              label="Open tasks"
              value={String(context.assignments.taskCount)}
            />
            {projectNames.length > 0 ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">Recent projects</dt>
                <dd className="mt-1 text-sm text-white">
                  <ul className="list-inside list-disc space-y-0.5 text-slate-300">
                    {projectNames.slice(0, 5).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </EmployeeProfileSection>
      ) : null}

      <EmployeeProfileSection title="Preferences">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Notifications</p>
            <div className="mt-2">
              <EmployeeNotificationPrefsSummary
                value={context ? notificationPrefs : DEFAULT_EMPLOYEE_NOTIFICATION_PREFS}
              />
            </div>
          </div>
          <dl className="space-y-3">
            <EmployeeProfileField
              label="Unit system"
              value={userPrefs?.measurementSystem ?? userPrefs?.units ?? '—'}
            />
            <EmployeeProfileField label="Currency" value={userPrefs?.currency ?? '—'} />
            <EmployeeProfileField label="Timezone" value={resolveBrowserTimezone()} />
          </dl>
        </div>
      </EmployeeProfileSection>

      <div className="space-y-3 pt-2">
        <Link
          to="/employee/profile/edit"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20"
          data-testid="employee-profile-edit-link"
        >
          <Pencil className="h-4 w-4" />
          Edit profile
        </Link>

        <Button
          type="button"
          variant="outline"
          fullWidth
          className="min-h-[48px] border-red-500/40 text-red-300 hover:border-red-500/60 hover:bg-red-950/30"
          icon={<LogOut className="h-4 w-4" />}
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
