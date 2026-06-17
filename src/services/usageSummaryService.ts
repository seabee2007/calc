import type { PlanId } from '../lib/entitlements';
import type { UsageUnit } from '../lib/usageLimits';
import { parseEdgeFunctionJson } from '../lib/usageMetering';
import { getMeteredAuthHeaders } from './meteredFunctionClient';

export interface UsageSummaryItem {
  usageUnit: UsageUnit;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  creditRemaining: number;
  creditsExpireAt: string | null;
  percentUsed: number;
  resetsAt: string;
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  planId: PlanId;
  items: UsageSummaryItem[];
}

function getFunctionsBaseUrl(): string {
  const configured = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new Error('Missing VITE_SUPABASE_URL for usage summary requests.');
  }
  return `${base.replace(/\/$/, '')}/functions/v1`;
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  const res = await fetch(`${getFunctionsBaseUrl()}/get-usage-summary`, {
    method: 'GET',
    headers: await getMeteredAuthHeaders(),
  });
  return parseEdgeFunctionJson<UsageSummary>(res);
}
