import { supabase } from './supabase';

export type OAuthProvider = 'google' | 'github';

export function getOAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const redirectTo = getOAuthCallbackUrl();

  const options: {
    redirectTo: string;
    queryParams?: { prompt: string };
  } = { redirectTo };

  if (provider === 'google') {
    options.queryParams = { prompt: 'select_account' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options,
  });

  if (error) {
    throw error;
  }
}
