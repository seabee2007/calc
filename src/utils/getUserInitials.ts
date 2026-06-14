export function getUserInitials(profile?: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
} | null): string {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (last) {
    return last.slice(0, 2).toUpperCase();
  }

  const displayName = profile?.displayName?.trim();
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }

  const email = profile?.email?.trim();
  if (email) return email.slice(0, 2).toUpperCase();

  return 'U';
}
