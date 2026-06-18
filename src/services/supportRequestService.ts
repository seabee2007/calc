import { supabase } from '../lib/supabase';
import { parseEdgeFunctionJson } from '../lib/usageMetering';
import type { SupportRequestTopicId } from '../features/support/supportRequestTopics';

export interface SendSupportRequestInput {
  topic: SupportRequestTopicId;
  subject: string;
  message: string;
  contactEmail?: string;
  pageUrl?: string;
  userAgent?: string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SendSupportRequestResponse {
  ok: boolean;
  supportRequestId?: string;
  message?: string;
  error?: string;
}

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

async function getSupportRequestHeaders(): Promise<HeadersInit> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${token ?? anonKey}`,
  };
}

export async function sendSupportRequest(
  input: SendSupportRequestInput,
): Promise<SendSupportRequestResponse> {
  const headers = await getSupportRequestHeaders();
  const res = await fetch(`${getFunctionsBaseUrl()}/send-support-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  return parseEdgeFunctionJson<SendSupportRequestResponse>(res);
}
