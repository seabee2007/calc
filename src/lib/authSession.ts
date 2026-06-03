import { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * True when Supabase cannot refresh the session (revoked/expired/missing refresh token).
 */
export function isStaleRefreshTokenError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message =
    error instanceof AuthError
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const normalized = message.toLowerCase();
  return (
    normalized.includes('refresh token not found') ||
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token revoked')
  );
}

/**
 * Clear persisted auth locally without requiring a valid server session.
 */
export async function clearStaleAuthSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Session may already be invalid; local sign-out is best-effort.
  }
}
