import React from 'react';
import type { NotificationPreferences } from '../../../lib/notificationTypes';

export type EmployeeNotificationPrefsState = {
  projectRemindersEnabled: boolean;
  emailUpdatesEnabled: boolean;
  inAppNotificationsEnabled: boolean;
};

export const DEFAULT_EMPLOYEE_NOTIFICATION_PREFS: EmployeeNotificationPrefsState = {
  projectRemindersEnabled: true,
  emailUpdatesEnabled: true,
  inAppNotificationsEnabled: true,
};

export function notificationPrefsFromRecord(
  prefs: NotificationPreferences | null | undefined,
): EmployeeNotificationPrefsState {
  if (
    !prefs ||
    typeof prefs.projectRemindersEnabled !== 'boolean' ||
    typeof prefs.emailUpdatesEnabled !== 'boolean' ||
    typeof prefs.inAppNotificationsEnabled !== 'boolean'
  ) {
    return DEFAULT_EMPLOYEE_NOTIFICATION_PREFS;
  }
  return {
    projectRemindersEnabled: prefs.projectRemindersEnabled,
    emailUpdatesEnabled: prefs.emailUpdatesEnabled,
    inAppNotificationsEnabled: prefs.inAppNotificationsEnabled,
  };
}

type ToggleKey = keyof EmployeeNotificationPrefsState;

const TOGGLE_LABELS: Record<ToggleKey, { title: string; description: string }> = {
  projectRemindersEnabled: {
    title: 'Project reminders',
    description: 'Reminders about assigned projects and deadlines.',
  },
  emailUpdatesEnabled: {
    title: 'Email updates',
    description: 'Important field updates sent to your email.',
  },
  inAppNotificationsEnabled: {
    title: 'In-app notifications',
    description: 'Alerts inside the Field Portal.',
  },
};

export function EmployeeNotificationPrefsForm({
  value,
  onChange,
  disabled = false,
}: {
  value: EmployeeNotificationPrefsState;
  onChange: (next: EmployeeNotificationPrefsState) => void;
  disabled?: boolean;
}) {
  const handleToggle = (key: ToggleKey, checked: boolean) => {
    onChange({ ...value, [key]: checked });
  };

  return (
    <div className="space-y-3" data-testid="employee-notification-prefs">
      {(Object.keys(TOGGLE_LABELS) as ToggleKey[]).map((key) => {
        const { title, description } = TOGGLE_LABELS[key];
        return (
          <label
            key={key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <span>
              <span className="block text-sm font-medium text-white">{title}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              checked={value[key]}
              disabled={disabled}
              onChange={(event) => handleToggle(key, event.target.checked)}
            />
          </label>
        );
      })}
    </div>
  );
}

export function EmployeeNotificationPrefsSummary({
  value,
}: {
  value: EmployeeNotificationPrefsState;
}) {
  const items = [
    { label: 'Project reminders', enabled: value.projectRemindersEnabled },
    { label: 'Email updates', enabled: value.emailUpdatesEnabled },
    { label: 'In-app notifications', enabled: value.inAppNotificationsEnabled },
  ];

  return (
    <ul className="space-y-2" data-testid="employee-notification-summary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between text-sm">
          <span className="text-slate-300">{item.label}</span>
          <span className={item.enabled ? 'text-cyan-400' : 'text-slate-500'}>
            {item.enabled ? 'On' : 'Off'}
          </span>
        </li>
      ))}
    </ul>
  );
}
