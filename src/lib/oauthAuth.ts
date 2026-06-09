import { supabase } from './supabase';

export type OAuthProvider = 'google' | 'github';

export function getOAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const redirectTo = getOAuthCallbackUrl();
  console.log('[OAuth] redirectTo', redirectTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw error;
  }
}
