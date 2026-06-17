import { supabase } from '../lib/supabase';
import type { PlanId } from '../lib/entitlements';
import type { BillingInterval } from '../lib/stripeBilling';

export interface CheckoutSessionRequest {
  planId: PlanId;
  billingInterval: BillingInterval;
  fieldSeatQuantity?: number;
  successUrl?: string;
  cancelUrl?: string;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

function getFunctionsBaseUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('Missing VITE_SUPABASE_URL');
  return base.replace(/\/$/, '');
}

async function invokeBillingFunction<T>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${getFunctionsBaseUrl()}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error ?? `Billing request failed (${functionName}).`);
  }
  return payload;
}

export async function createCheckoutSession(
  request: CheckoutSessionRequest,
): Promise<string> {
  const result = await invokeBillingFunction<{ url?: string }>('create-checkout-session', {
    planId: request.planId,
    billingInterval: request.billingInterval,
    fieldSeatQuantity: request.fieldSeatQuantity ?? 0,
    successUrl: request.successUrl,
    cancelUrl: request.cancelUrl,
  });
  if (!result.url) throw new Error('Checkout URL missing from server response.');
  return result.url;
}

export async function createCustomerPortalSession(returnUrl?: string): Promise<string> {
  const result = await invokeBillingFunction<{ url?: string }>(
    'create-customer-portal-session',
    returnUrl ? { returnUrl } : undefined,
  );
  if (!result.url) throw new Error('Customer portal URL missing from server response.');
  return result.url;
}

export function redirectToStripeUrl(url: string): void {
  window.location.assign(url);
}

export function isStripeConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}

export function getAppBaseUrl(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}
