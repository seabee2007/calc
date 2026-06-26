export function capitalizeDisplayToken(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function resolveFieldGreetingName(params: {
  displayName?: string | null;
  firstName?: string | null;
  authFullName?: string | null;
  email?: string | null;
}): string {
  const display = params.displayName?.trim();
  if (display) {
    const first = display.split(/\s+/)[0];
    if (first) return capitalizeDisplayToken(first);
  }

  const firstName = params.firstName?.trim();
  if (firstName) return capitalizeDisplayToken(firstName);

  const authFull = params.authFullName?.trim();
  if (authFull) {
    const first = authFull.split(/\s+/)[0];
    if (first) return capitalizeDisplayToken(first);
  }

  if (params.email) {
    const local = params.email.split('@')[0]?.trim();
    if (local) return capitalizeDisplayToken(local);
  }

  return 'there';
}

export function resolveFieldFullName(params: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const display = params.displayName?.trim();
  if (display) return display;

  const first = params.firstName?.trim() ?? '';
  const last = params.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  if (params.email) {
    const local = params.email.split('@')[0]?.trim();
    if (local) return capitalizeDisplayToken(local);
  }

  return 'Team member';
}

export function profileInitials(params: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = params.firstName?.trim()?.charAt(0) ?? '';
  const last = params.lastName?.trim()?.charAt(0) ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();

  const display = params.displayName?.trim();
  if (!display) return '?';
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return display.charAt(0).toUpperCase();
}

export function resolveBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  } catch {
    return 'Local time';
  }
}
