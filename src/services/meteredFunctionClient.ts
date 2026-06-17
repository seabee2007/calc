import { supabase } from '../lib/supabase';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

function getFunctionsBaseUrl(): string {
  const configured = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new Error('Missing VITE_SUPABASE_URL for edge function requests.');
  }
  return `${base.replace(/\/$/, '')}/functions/v1`;
}

export async function getMeteredAuthHeaders(): Promise<HeadersInit> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('User must be signed in for this action.');
  }

  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };
}

export async function postMeteredFunction<T extends Record<string, unknown>>(
  functionName: string,
  body: unknown,
): Promise<T> {
  const headers = await getMeteredAuthHeaders();
  const res = await fetch(`${getFunctionsBaseUrl()}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return parseEdgeFunctionJson<T>(res);
}
