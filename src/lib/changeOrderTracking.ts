import { supabase } from './supabase';
import { mapChangeOrder } from '../services/changeOrderService';
import type { ChangeOrder } from '../types/changeOrder';

export function getPublicChangeOrderUrl(publicToken: string): string {
  return `${window.location.origin}/change-order/${publicToken}`;
}

export async function fetchChangeOrderByPublicToken(
  token: string,
): Promise<ChangeOrder | null> {
  const { data, error } = await supabase.rpc('get_change_order_by_public_token', {
    p_token: token,
  });
  if (error) throw error;
  if (!data) return null;
  return mapChangeOrder(data as Record<string, unknown>);
}

async function recordClientAction(
  token: string,
  action: string,
  client?: { name: string; signature: string },
): Promise<ChangeOrder> {
  const { data, error } = await supabase.rpc('record_change_order_client_action', {
    p_token: token,
    p_action: action,
    p_client_name: client?.name ?? null,
    p_client_signature: client?.signature ?? null,
  });
  if (error) throw error;
  return mapChangeOrder(data as Record<string, unknown>);
}

export async function markChangeOrderOpened(token: string): Promise<ChangeOrder> {
  return recordClientAction(token, 'opened');
}

export async function acceptChangeOrder(
  token: string,
  client: { name: string; signature: string },
): Promise<ChangeOrder> {
  return recordClientAction(token, 'accepted', client);
}

export async function declineChangeOrder(token: string): Promise<ChangeOrder> {
  return recordClientAction(token, 'declined');
}
