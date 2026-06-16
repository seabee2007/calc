import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/fieldPlanner';

export const DEFAULT_PROFILE_DISPLAY_NAME = 'Team member';
export const CURRENT_AGREEMENT_VERSION = '2025-01';
export const CURRENT_ONBOARDING_VERSION = '2025-01';

function mapProfile(row: Record<string, unknown>): Profile {
  const firstName = (row.first_name as string) ?? null;
  const lastName = (row.last_name as string) ?? null;
  const displayName =
    (row.display_name as string) ??
    (firstName && lastName ? `${firstName} ${lastName}` : firstName ?? lastName ?? null);

  return {
    id: row.id as string,
    role: row.role as UserRole,
    employerId: (row.employer_id as string) ?? null,
    displayName,
    firstName,
    lastName,
    phone: (row.phone as string) ?? null,
    businessAddressStreet: (row.business_address_street as string) ?? null,
    businessAddressStreet2: (row.business_address_street2 as string) ?? null,
    businessAddressCity: (row.business_address_city as string) ?? null,
    businessAddressState: (row.business_address_state as string) ?? null,
    businessAddressPostalCode: (row.business_address_postal_code as string) ?? null,
    agreementAcceptedAt: (row.agreement_accepted_at as string) ?? null,
    agreementVersion: (row.agreement_version as string) ?? null,
    onboardingCompletedAt: (row.onboarding_completed_at as string) ?? null,
    onboardingVersion: (row.onboarding_version as string) ?? null,
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

export async function createOwnerProfile(
  userId: string,
  fields: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    businessAddress?: {
      street?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
    acceptedAgreement?: boolean;
  },
): Promise<Profile> {
  const displayName = `${fields.firstName} ${fields.lastName}`.trim();
  const now = new Date().toISOString();
  const addr = fields.businessAddress;

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role: 'owner',
      employer_id: null,
      display_name: displayName,
      first_name: fields.firstName,
      last_name: fields.lastName,
      phone: fields.phone?.trim() || null,
      business_address_street: addr?.street?.trim() || null,
      business_address_street2: addr?.street2?.trim() || null,
      business_address_city: addr?.city?.trim() || null,
      business_address_state: addr?.state?.trim() || null,
      business_address_postal_code: addr?.postalCode?.trim() || null,
      agreement_accepted_at: fields.acceptedAgreement ? now : null,
      agreement_version: fields.acceptedAgreement ? CURRENT_AGREEMENT_VERSION : null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function updateProfile(
  userId: string,
  patch: Partial<{
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string | null;
    businessAddress: {
      street?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    } | null;
    acceptedAgreement: boolean;
  }>,
): Promise<Profile> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.firstName !== undefined) {
    payload.first_name = patch.firstName;
  }
  if (patch.lastName !== undefined) {
    payload.last_name = patch.lastName;
  }
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const first = patch.firstName ?? '';
    const last = patch.lastName ?? '';
    payload.display_name = `${first} ${last}`.trim() || patch.displayName;
  } else if (patch.displayName !== undefined) {
    payload.display_name = patch.displayName;
  }
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.businessAddress !== undefined) {
    const addr = patch.businessAddress;
    payload.business_address_street = addr?.street?.trim() ?? null;
    payload.business_address_street2 = addr?.street2?.trim() ?? null;
    payload.business_address_city = addr?.city?.trim() ?? null;
    payload.business_address_state = addr?.state?.trim() ?? null;
    payload.business_address_postal_code = addr?.postalCode?.trim() ?? null;
  }
  if (patch.acceptedAgreement) {
    payload.agreement_accepted_at = new Date().toISOString();
    payload.agreement_version = CURRENT_AGREEMENT_VERSION;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function markOnboardingCompleted(userId: string): Promise<Profile> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: now,
      onboarding_version: CURRENT_ONBOARDING_VERSION,
      updated_at: now,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return mapProfile(data);
}

/** Ensure owner profile exists — used after OAuth when no profile row is present yet.
 *  Prefers first/last from OAuth metadata; falls back to email local-part as displayName. */
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
      display_name: displayName ?? DEFAULT_PROFILE_DISPLAY_NAME,
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

export function displayNameFor(
  profile: Profile | undefined,
  fallback = DEFAULT_PROFILE_DISPLAY_NAME,
): string {
  return profile?.displayName?.trim() || fallback;
}

export async function buildProfileNameMap(
  ids: string[],
  fallback = DEFAULT_PROFILE_DISPLAY_NAME,
): Promise<Map<string, string>> {
  const profiles = await fetchProfilesByIds(ids);
  const map = new Map<string, string>();
  for (const id of [...new Set(ids)]) {
    map.set(id, displayNameFor(profiles.get(id), fallback));
  }
  return map;
}

export function nameFromMap(
  map: Map<string, string>,
  id: string | null | undefined,
  fallback = DEFAULT_PROFILE_DISPLAY_NAME,
): string {
  if (!id) return fallback;
  return map.get(id) ?? fallback;
}
