import type { Profile } from '../types/fieldPlanner';
import type { AssigneeOption } from '../components/schedule/ScheduleAssigneeCombobox';
import {
  displayNameFor,
  fetchProfile,
  fetchProfilesByIds,
} from '../services/profileService';
import { fetchAssignmentsForProject } from '../services/employeeService';
import { supabase } from '../lib/supabase';

function profileStorageName(profile: Profile): string {
  return displayNameFor(profile);
}

/** Build combobox options from profiles — current user first with "(me)" label. */
export function buildScheduleAssigneeOptions(
  profiles: Profile[],
  currentUserId?: string | null,
): AssigneeOption[] {
  const byId = new Map<string, Profile>();
  for (const profile of profiles) {
    byId.set(profile.id, profile);
  }

  const options: AssigneeOption[] = [];
  const usedNames = new Set<string>();

  const pushOption = (profile: Profile, isMe: boolean) => {
    const name = profileStorageName(profile);
    const key = name.toLowerCase();
    if (usedNames.has(key)) return;
    usedNames.add(key);
    options.push({
      id: profile.id,
      name,
      label: isMe ? `${name} (me)` : name,
    });
  };

  if (currentUserId && byId.has(currentUserId)) {
    pushOption(byId.get(currentUserId)!, true);
  }

  const rest = [...byId.values()]
    .filter((p) => p.id !== currentUserId)
    .sort((a, b) => profileStorageName(a).localeCompare(profileStorageName(b)));

  for (const profile of rest) {
    pushOption(profile, false);
  }

  return options;
}

/**
 * Profiles assignable on a schedule event for the given project:
 * - current user (always)
 * - project owner
 * - everyone assigned to the project (any role)
 */
export async function fetchScheduleAssigneeProfilesForProject(
  projectId: string,
  userId: string,
): Promise<Profile[]> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  if (!project) return [];

  const ownerId = project.user_id as string;
  const ids = new Set<string>([userId, ownerId]);

  const assignments = await fetchAssignmentsForProject(projectId);
  for (const assignment of assignments) {
    ids.add(assignment.employeeId);
  }

  const profileMap = await fetchProfilesByIds([...ids]);
  const profiles: Profile[] = [];

  for (const id of ids) {
    const profile = profileMap.get(id);
    if (profile) profiles.push(profile);
  }

  if (!profileMap.has(userId)) {
    const self = await fetchProfile(userId);
    if (self) profiles.push(self);
  }

  return profiles;
}
