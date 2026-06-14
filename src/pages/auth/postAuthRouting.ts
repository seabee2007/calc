import { supabase } from '../../lib/supabase';
import type { LoginIntent } from '../../lib/loginIntent';
import {
  acceptInviteForCurrentUser,
  syncEmployeeProfileFromInvites,
} from '../../services/employeeService';
import type { Profile } from '../../types/fieldPlanner';
import { isEmployeeRole } from '../../types/fieldPlanner';
import {
  ensureOwnerProfile,
  fetchProfile,
} from '../../services/profileService';

export const FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE =
  'We signed you in, but could not verify your Field Portal access. Ask your company admin to confirm your employee invite or assignment.';

export const FIELD_PORTAL_NO_ASSIGNMENT_MESSAGE =
  'Your account is signed in, but no employee access is assigned yet. Ask your company admin to send or approve a Field Portal invite.';

export const FIELD_PORTAL_OWNER_ACCOUNT_MESSAGE =
  'This account is not assigned Field Portal access. Use Company / Admin Login instead.';

export async function applyFieldEmployeeProfileLinking(options: {
  inviteToken?: string;
  loginIntent?: LoginIntent | null;
}): Promise<void> {
  const isFieldFlow = options.loginIntent === 'field' || Boolean(options.inviteToken);
  if (!isFieldFlow) return;

  if (options.inviteToken) {
    await acceptInviteForCurrentUser(options.inviteToken);
    return;
  }

  await syncEmployeeProfileFromInvites();
}

export async function resolveProfileAfterAuth(
  userId: string,
  email?: string,
  loginIntent?: LoginIntent | null,
): Promise<Profile | null> {
  const existing = await fetchProfile(userId).catch(() => null);
  if (existing) return existing;
  if (loginIntent === 'admin') {
    return await ensureOwnerProfile(userId, email);
  }
  return null;
}

export async function loadAuthenticatedUserProfile(
  loginIntent?: LoginIntent | null,
): Promise<Profile | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  return await resolveProfileAfterAuth(user.id, user.email, loginIntent);
}

export function resolveFieldPortalLoginError(
  profile: Profile | null,
  loginIntent?: LoginIntent | null,
): string | null {
  if (loginIntent !== 'field') return null;
  if (!profile) return FIELD_PORTAL_NO_ASSIGNMENT_MESSAGE;
  if (isEmployeeRole(profile.role)) return null;
  if (profile.role === 'owner' || profile.role === 'admin') {
    return FIELD_PORTAL_OWNER_ACCOUNT_MESSAGE;
  }
  return FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE;
}
