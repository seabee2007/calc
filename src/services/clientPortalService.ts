import { supabase } from '../lib/supabase';
import type { ClientPortalRecord, ClientPortalViewData } from '../types/clientPortal';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function mapPortalRow(row: Record<string, unknown>): ClientPortalRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    contractorUserId: String(row.contractor_user_id),
    clientName: String(row.client_name ?? ''),
    clientEmail: String(row.client_email ?? ''),
    token: String(row.token),
    isActive: row.is_active !== false,
    lastViewedAt: row.last_viewed_at ? String(row.last_viewed_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function generatePortalToken(): string {
  const extra = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(extra, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${crypto.randomUUID().replace(/-/g, '')}${hex}`;
}

export function getClientPortalUrl(token: string): string {
  return `${window.location.origin}/client/project/${token}`;
}

export async function fetchClientPortalByProjectId(
  projectId: string,
): Promise<ClientPortalRecord | null> {
  const { data, error } = await supabase
    .from('client_portals')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (error.message.includes('client_portals')) {
      console.warn('client_portals table missing — run migration 20260531120000_client_portals.sql');
      return null;
    }
    throw new Error(error.message);
  }

  return data ? mapPortalRow(data as Record<string, unknown>) : null;
}

export async function createClientPortal(input: {
  projectId: string;
  clientName: string;
  clientEmail: string;
}): Promise<ClientPortalRecord> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be signed in to create a client portal.');
  }

  const existing = await fetchClientPortalByProjectId(input.projectId);
  if (existing) return existing;

  const token = generatePortalToken();
  const { data, error } = await supabase
    .from('client_portals')
    .insert({
      project_id: input.projectId,
      contractor_user_id: user.id,
      client_name: input.clientName.trim(),
      client_email: input.clientEmail.trim(),
      token,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPortalRow(data as Record<string, unknown>);
}

export async function fetchClientPortalView(token: string): Promise<ClientPortalViewData> {
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
  }

  const res = await fetch(`${FN_BASE}/client-project-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ token }),
  });

  const data = (await res.json()) as ClientPortalViewData | { error?: string };

  if (!res.ok) {
    const message =
      'error' in data && data.error
        ? data.error
        : `Could not load client portal (${res.status})`;
    throw new Error(message);
  }

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as ClientPortalViewData;
}

export async function copyClientPortalLink(token: string): Promise<void> {
  const url = getClientPortalUrl(token);
  await navigator.clipboard.writeText(url);
}
