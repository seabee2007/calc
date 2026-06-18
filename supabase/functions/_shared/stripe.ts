/**
 * Shared Stripe billing helpers for Supabase Edge Functions.
 * Lookup keys must stay in sync with `src/lib/stripeConfig.ts`.
 */
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import {
  fetchSubscriptionRowSnapshot,
  maybeSendSubscriptionWelcomeEmail,
} from "./subscriptionEmails.ts";

export type PlanId = "starter" | "professional" | "business";
export type BillingInterval = "month" | "year";
export type StripeKeyMode = "test" | "live";

let stripeEnvValidated = false;

export function detectStripeKeyMode(key: string | null | undefined): StripeKeyMode | null {
  if (!key || typeof key !== "string") return null;
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  return null;
}

function assertStripeEnvConsistency(): void {
  if (stripeEnvValidated) return;

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const secretMode = detectStripeKeyMode(secretKey);
  if (!secretMode) {
    throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
  }

  const configuredMode = Deno.env.get("STRIPE_MODE") as StripeKeyMode | undefined;
  if (configuredMode && configuredMode !== secretMode) {
    throw new Error(
      `STRIPE_MODE=${configuredMode} does not match STRIPE_SECRET_KEY mode (${secretMode}).`,
    );
  }

  const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
  const publishableMode = detectStripeKeyMode(publishableKey);
  if (publishableKey && publishableMode && publishableMode !== secretMode) {
    throw new Error(
      "STRIPE_PUBLISHABLE_KEY mode does not match STRIPE_SECRET_KEY mode.",
    );
  }

  stripeEnvValidated = true;
}

function validateAppUrlForStripeMode(appUrl: string): void {
  const secretMode = detectStripeKeyMode(Deno.env.get("STRIPE_SECRET_KEY"));
  if (secretMode !== "live") return;
  try {
    const host = new URL(appUrl).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      throw new Error("APP_URL must not point to localhost when using sk_live_.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("localhost")) throw error;
    throw new Error("APP_URL must be a valid absolute URL.");
  }
}

export const STRIPE_PRICE_LOOKUP_KEYS = {
  starter_monthly: "arden_starter_monthly",
  starter_annual: "arden_starter_annual",
  professional_monthly: "arden_professional_monthly",
  professional_annual: "arden_professional_annual",
  business_monthly: "arden_business_monthly",
  business_annual: "arden_business_annual",
  extra_field_seat: "arden_extra_field_seat_monthly",
  extra_project_pack: "arden_extra_project_pack_monthly",
  ai_overage: "arden_ai_requests_overage",
  ai_request_pack_100: "arden_ai_request_pack_100",
  weather_map_pack_500: "arden_weather_map_pack_500",
  email_send_pack_500: "arden_email_send_pack_500",
} as const;

const ADDON_LOOKUP_KEYS = new Set<string>([
  STRIPE_PRICE_LOOKUP_KEYS.extra_field_seat,
  STRIPE_PRICE_LOOKUP_KEYS.extra_project_pack,
  STRIPE_PRICE_LOOKUP_KEYS.ai_overage,
  STRIPE_PRICE_LOOKUP_KEYS.ai_request_pack_100,
  STRIPE_PRICE_LOOKUP_KEYS.weather_map_pack_500,
  STRIPE_PRICE_LOOKUP_KEYS.email_send_pack_500,
]);

export const LOOKUP_KEY_TO_PLAN: Record<string, PlanId> = {
  [STRIPE_PRICE_LOOKUP_KEYS.starter_monthly]: "starter",
  [STRIPE_PRICE_LOOKUP_KEYS.starter_annual]: "starter",
  [STRIPE_PRICE_LOOKUP_KEYS.professional_monthly]: "professional",
  [STRIPE_PRICE_LOOKUP_KEYS.professional_annual]: "professional",
  [STRIPE_PRICE_LOOKUP_KEYS.business_monthly]: "business",
  [STRIPE_PRICE_LOOKUP_KEYS.business_annual]: "business",
};

export const PLAN_INCLUDED_FIELD_SEATS: Record<PlanId, number> = {
  starter: 1,
  professional: 5,
  business: 15,
};

const VALID_PLAN_IDS = new Set<PlanId>(["starter", "professional", "business"]);

export function getStripe(): Stripe {
  assertStripeEnvConsistency();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(secretKey, {
    apiVersion: "2024-11-20.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getAppUrl(): string {
  const url = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  if (!url) {
    throw new Error("APP_URL is not configured.");
  }
  validateAppUrlForStripeMode(url);
  return url;
}

/** Same-origin path or absolute URL under the app origin — blocks open redirects. */
export function isSafeAppReturnUrl(candidate: string, appUrl: string): boolean {
  try {
    const app = new URL(appUrl);
    const resolved = candidate.startsWith("/")
      ? new URL(candidate, appUrl)
      : new URL(candidate);
    if (resolved.origin !== app.origin) return false;
    if (!resolved.pathname.startsWith("/")) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolveAppReturnUrl(
  candidate: unknown,
  appUrl: string,
  fallback: string,
): string {
  if (typeof candidate === "string" && isSafeAppReturnUrl(candidate, appUrl)) {
    return candidate.startsWith("/") ? `${appUrl}${candidate}` : candidate;
  }
  return fallback;
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && VALID_PLAN_IDS.has(value as PlanId);
}

export function parseBillingInterval(value: unknown): BillingInterval | null {
  if (value === "month" || value === "monthly") return "month";
  if (value === "year" || value === "annual") return "year";
  return null;
}

export function lookupKeyForPlan(plan: PlanId, interval: BillingInterval): string {
  if (plan === "starter") {
    return interval === "year"
      ? STRIPE_PRICE_LOOKUP_KEYS.starter_annual
      : STRIPE_PRICE_LOOKUP_KEYS.starter_monthly;
  }
  if (plan === "professional") {
    return interval === "year"
      ? STRIPE_PRICE_LOOKUP_KEYS.professional_annual
      : STRIPE_PRICE_LOOKUP_KEYS.professional_monthly;
  }
  return interval === "year"
    ? STRIPE_PRICE_LOOKUP_KEYS.business_annual
    : STRIPE_PRICE_LOOKUP_KEYS.business_monthly;
}

export function resolvePlanFromLookupKey(lookupKey: string | null | undefined): PlanId | null {
  if (!lookupKey || ADDON_LOOKUP_KEYS.has(lookupKey)) return null;
  return LOOKUP_KEY_TO_PLAN[lookupKey] ?? null;
}

export function resolvePlanFromMetadata(planId: unknown): PlanId | null {
  if (!isPlanId(planId)) return null;
  return planId;
}

export function resolvePlanFromStripeSubscription(
  subscription: Stripe.Subscription,
): PlanId {
  for (const item of subscription.items?.data ?? []) {
    const price = item.price;
    const lookupKey = typeof price.lookup_key === "string" ? price.lookup_key : null;
    const fromLookup = resolvePlanFromLookupKey(lookupKey);
    if (fromLookup) return fromLookup;
  }

  const metadataPlan = resolvePlanFromMetadata(subscription.metadata?.plan_id);
  if (metadataPlan) return metadataPlan;

  return "starter";
}

export async function findPriceIdByLookupKey(
  stripe: Stripe,
  lookupKey: string,
): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  const price = prices.data[0];
  if (!price?.id) {
    throw new Error(`Stripe price not found for lookup key: ${lookupKey}`);
  }
  return price.id;
}

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  admin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  userId: string,
  email?: string | null,
): Promise<string> {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { user_id: userId },
  });

  const { error: upsertError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
      // Explicit inactive status — DB default is trialing, which would grant paid trial access.
      status: "inactive",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    console.error("[stripe] subscriptions customer upsert failed", {
      userId,
      stripeCustomerId: customer.id,
      error: upsertError,
    });
    throw upsertError;
  }

  return customer.id;
}

function unixToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function resolveSubscriptionPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
} {
  const rootStart = unixToIso(subscription.current_period_start);
  const rootEnd = unixToIso(subscription.current_period_end);
  if (rootStart || rootEnd) {
    return { currentPeriodStart: rootStart, currentPeriodEnd: rootEnd };
  }

  const primaryItem = subscription.items?.data?.find((item) => {
    const lookupKey = typeof item.price?.lookup_key === "string" ? item.price.lookup_key : null;
    return lookupKey ? !ADDON_LOOKUP_KEYS.has(lookupKey) : true;
  }) ?? subscription.items?.data?.[0];

  return {
    currentPeriodStart: unixToIso(primaryItem?.current_period_start),
    currentPeriodEnd: unixToIso(primaryItem?.current_period_end),
  };
}

export interface SubscriptionUpsertPayload {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: PlanId;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  included_field_seats: number | null;
  updated_at: string;
}

export function buildSubscriptionUpsertPayload(
  userId: string,
  subscription: Stripe.Subscription,
): SubscriptionUpsertPayload {
  const planId = resolvePlanFromStripeSubscription(subscription);
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
  const { currentPeriodStart, currentPeriodEnd } = resolveSubscriptionPeriod(subscription);

  return {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_id: planId,
    status: subscription.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_end: unixToIso(subscription.trial_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    included_field_seats: PLAN_INCLUDED_FIELD_SEATS[planId],
    updated_at: new Date().toISOString(),
  };
}

export interface UpsertSubscriptionRowOptions {
  stripeEventId?: string;
}

export async function upsertSubscriptionRow(
  admin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  payload: SubscriptionUpsertPayload,
  options?: UpsertSubscriptionRowOptions,
): Promise<void> {
  const previousRow = await fetchSubscriptionRowSnapshot(admin, payload.user_id);

  const { error } = await admin.from("subscriptions").upsert(payload, {
    onConflict: "user_id",
  });
  if (error) {
    console.error("[stripe-webhook] subscriptions upsert failed", {
      userId: payload.user_id,
      stripeCustomerId: payload.stripe_customer_id,
      stripeSubscriptionId: payload.stripe_subscription_id,
      planId: payload.plan_id,
      status: payload.status,
      error,
    });
    throw error;
  }

  if (!options?.stripeEventId || !payload.stripe_subscription_id) {
    return;
  }

  try {
    await maybeSendSubscriptionWelcomeEmail(admin, {
      userId: payload.user_id,
      stripeSubscriptionId: payload.stripe_subscription_id,
      stripeEventId: options.stripeEventId,
      planId: payload.plan_id,
      status: payload.status,
      previousRow,
    });
  } catch (emailError) {
    console.error("[stripe-webhook] subscription welcome email failed; subscription sync kept", {
      userId: payload.user_id,
      stripeSubscriptionId: payload.stripe_subscription_id,
      stripeEventId: options.stripeEventId,
      planId: payload.plan_id,
      status: payload.status,
      error: emailError,
    });
  }
}

export async function findUserIdForStripeCustomer(
  admin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("[stripe-webhook] customer lookup failed", { customerId, error });
    throw error;
  }

  return (data?.user_id as string | undefined) ?? null;
}

export function extractUserIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  const userId = metadata?.user_id;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

export async function fetchStripeSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}
