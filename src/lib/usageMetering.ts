import type { PlanId } from './entitlements';
import {
  buildUsageLimitReachedPayload,
  isUsageLimitReachedPayload,
  usageLimitMessage,
  type UsageFeatureKey,
  type UsageLimitReachedPayload,
  type UsageUnit,
} from './usageLimits';

export class UsageLimitError extends Error {
  readonly code = 'usage_limit_reached' as const;
  readonly featureKey: UsageFeatureKey;
  readonly usageUnit: UsageUnit;
  readonly limit: number;
  readonly used: number;
  readonly planId: PlanId;
  readonly upgradeRequired = true as const;
  readonly status = 429;

  constructor(payload: UsageLimitReachedPayload) {
    super(usageLimitMessage(payload.usageUnit));
    this.name = 'UsageLimitError';
    this.featureKey = payload.featureKey;
    this.usageUnit = payload.usageUnit;
    this.limit = payload.limit;
    this.used = payload.used;
    this.planId = payload.planId;
  }
}

export function isUsageLimitError(error: unknown): error is UsageLimitError {
  return error instanceof UsageLimitError;
}

export function parseUsageLimitPayload(body: unknown): UsageLimitReachedPayload | null {
  if (!isUsageLimitReachedPayload(body)) return null;
  return body;
}

async function readResponseBody(res: Response): Promise<Record<string, unknown>> {
  try {
    if (typeof res.json === 'function') {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return data as Record<string, unknown>;
      }
    }
  } catch {
    // fall through to text parsing
  }

  if (typeof res.text === 'function') {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { error: text };
    }
  }

  return {};
}

export async function parseEdgeFunctionJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const body = await readResponseBody(res);

  const limitPayload = parseUsageLimitPayload(body);
  if (res.status === 429 && limitPayload) {
    throw new UsageLimitError(limitPayload);
  }

  if (!res.ok) {
    const message =
      typeof body.error === 'string' && body.error.trim()
        ? body.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

export function buildBillingUpgradeUrl(planId: PlanId, returnTo?: string): string {
  const params = new URLSearchParams({ upgrade: planId });
  if (returnTo) params.set('returnTo', returnTo);
  return `/settings/billing?${params.toString()}`;
}

export function usageLimitUpgradeLabel(planId: PlanId): string {
  switch (planId) {
    case 'starter':
      return 'Upgrade to Starter';
    case 'professional':
      return 'Upgrade to Professional';
    case 'business':
      return 'Upgrade to Business';
    default:
      return 'View plans';
  }
}

export { buildUsageLimitReachedPayload, usageLimitMessage };
