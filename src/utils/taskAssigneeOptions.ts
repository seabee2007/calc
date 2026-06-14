import type { Profile } from '../types/fieldPlanner';
import { DEFAULT_PROFILE_DISPLAY_NAME } from '../services/profileService';

export type TaskAssigneeOptionSource =
  | 'current_user'
  | 'field_user'
  | 'contact'
  | 'unassigned';

export interface TaskAssigneeOption {
  id: string;
  label: string;
  email?: string | null;
  source: TaskAssigneeOptionSource;
}

export function formatCurrentUserAssigneeLabel(
  profile: Profile | null | undefined,
  user: { email?: string | null } | null | undefined,
): string {
  const name = profile?.displayName?.trim();
  if (name) return `${name} (me)`;
  if (user?.email) return `${user.email} (me)`;
  return 'Me';
}

function dedupeAssigneesById(options: TaskAssigneeOption[]): TaskAssigneeOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (option.source === 'unassigned') return true;
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

export function buildTaskAssigneeOptions(
  team: Profile[],
  currentUser: { id: string; email?: string | null } | null | undefined,
  currentProfile: Profile | null | undefined,
): TaskAssigneeOption[] {
  const currentUserOption: TaskAssigneeOption | null = currentUser
    ? {
        id: currentUser.id,
        label: formatCurrentUserAssigneeLabel(currentProfile, currentUser),
        email: currentUser.email ?? null,
        source: 'current_user',
      }
    : null;

  const fieldPortalAssignees: TaskAssigneeOption[] = team
    .filter((member) => member.id !== currentUser?.id)
    .map((member) => ({
      id: member.id,
      label: member.displayName ?? DEFAULT_PROFILE_DISPLAY_NAME,
      source: 'field_user' as const,
    }));

  return dedupeAssigneesById([
    { id: '', label: 'Unassigned', source: 'unassigned' },
    ...(currentUserOption ? [currentUserOption] : []),
    ...fieldPortalAssignees,
  ]);
}

export function taskAssigneeOptionsToSelectOptions(
  options: TaskAssigneeOption[],
): { value: string; label: string }[] {
  return options.map((option) => ({ value: option.id, label: option.label }));
}

/** Options suitable for multi-select (excludes Unassigned sentinel). */
export function buildTaskAssigneeMultiSelectOptions(
  team: Profile[],
  currentUser: { id: string; email?: string | null } | null | undefined,
  currentProfile: Profile | null | undefined,
): TaskAssigneeOption[] {
  return buildTaskAssigneeOptions(team, currentUser, currentProfile).filter(
    (option) => option.source !== 'unassigned',
  );
}

export function normalizeAssigneeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function isUserAssignedToTask(
  task: { assignedToIds?: string[]; assignedTo?: string | null },
  userId: string,
): boolean {
  if (task.assignedToIds?.includes(userId)) return true;
  return task.assignedTo === userId;
}

export function formatAssigneeNames(names: readonly string[]): string {
  return names.filter(Boolean).join(', ');
}

export function getAssigneeInitials(label: string): string {
  const cleaned = label.replace('(me)', '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}

export function resolveSelectedAssignees(
  assigneeIds: readonly string[],
  options: readonly TaskAssigneeOption[],
): TaskAssigneeOption[] {
  return assigneeIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is TaskAssigneeOption => Boolean(option));
}
