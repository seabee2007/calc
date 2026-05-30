import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/fieldPlanner';

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    role: row.role as UserRole,
    employerId: (row.employer_id as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    phone: (row.phone as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('profiles')) {
      return null;
    }
    throw error;
  }
  return data ? mapProfile(data) : null;
}

export async function ensureOwnerProfile(userId: string, email?: string): Promise<Profile> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const displayName = email?.split('@')[0] ?? 'User';
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role: 'owner',
      employer_id: null,
      display_name: displayName,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function ensureEmployeeProfile(
  userId: string,
  employerId: string,
  role: UserRole,
  displayName?: string,
): Promise<Profile> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role,
      employer_id: employerId,
      display_name: displayName ?? 'Team Member',
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function fetchTeamProfiles(employerId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('employer_id', employerId)
    .order('display_name');

  if (error) throw error;
  return (data ?? []).map(mapProfile);
}

export async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const unique = [...new Set(ids)];
  const { data, error } = await supabase.from('profiles').select('*').in('id', unique);
  if (error) throw error;
  const map = new Map<string, Profile>();
  for (const row of data ?? []) {
    const p = mapProfile(row);
    map.set(p.id, p);
  }
  return map;
}

export function displayNameFor(profile: Profile | undefined, fallback = 'Team Member'): string {
  return profile?.displayName?.trim() || fallback;
}
