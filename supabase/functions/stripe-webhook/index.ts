/**
 * Stripe webhook — source of truth for subscription status.
 * Never trust client-provided plan IDs; resolve from Stripe Price lookup keys.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildSubscriptionUpsertPayload,
  detectStripeKeyMode,
  extractUserIdFromMetadata,
  fetchStripeSubscription,
  findUserIdForStripeCustomer,
  getStripe,
  upsertSubscriptionRow,
} from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logWebhookContext(
  event: Stripe.Event,
  extra: Record<string, unknown> = {},
): void {
  console.log("[stripe-webhook] handling event", {
    eventType: event.type,
    eventId: event.id,
    ...extra,
  });
}

function logSubscriptionContext(
  subscription: Stripe.Subscription,
  userId: string | null,
): void {
  const primaryItem = subscription.items?.data?.[0];
  console.log("[stripe-webhook] subscription context", {
    stripeCustomerId: typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscription.id,
    metadataUserId: extractUserIdFromMetadata(subscription.metadata),
    metadataPlanId: subscription.metadata?.plan_id ?? null,
    metadataBillingInterval: subscription.metadata?.billing_interval ?? null,
    resolvedUserId: userId,
    status: subscription.status,
    lookupKey: typeof primaryItem?.price?.lookup_key === "string"
      ? primaryItem.price.lookup_key
      : null,
  });
}

async function resolveUserIdForSubscription(
  admin: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = extractUserIdFromMetadata(subscription.metadata);
  if (fromMetadata) return fromMetadata;

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  if (!customerId) return null;
  return findUserIdForStripeCustomer(admin, customerId);
}

async function syncSubscriptionById(
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  subscriptionId: string,
  userIdHint?: string | null,
): Promise<void> {
  const subscription = await fetchStripeSubscription(stripe, subscriptionId);
  const userId = userIdHint ?? await resolveUserIdForSubscription(admin, subscription);
  logSubscriptionContext(subscription, userId);

  if (!userId) {
    console.warn("[stripe-webhook] Could not resolve user for subscription", {
      subscriptionId,
      stripeCustomerId: typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null,
    });
    return;
  }

  const payload = buildSubscriptionUpsertPayload(userId, subscription);
  console.log("[stripe-webhook] upserting subscription row", {
    userId: payload.user_id,
    planId: payload.plan_id,
    status: payload.status,
    stripeSubscriptionId: payload.stripe_subscription_id,
  });
  await upsertSubscriptionRow(admin, payload);
}

async function updateStatusForCustomer(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  status: string,
): Promise<void> {
  const userId = await findUserIdForStripeCustomer(admin, customerId);
  if (!userId) {
    console.warn("[stripe-webhook] Could not resolve user for customer status update", {
      customerId,
      status,
    });
    return;
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[stripe-webhook] subscription status update failed", {
      userId,
      customerId,
      status,
      error,
    });
    throw error;
  }
}

async function upsertCustomerOnlyRow(
  admin: ReturnType<typeof createClient>,
  userId: string,
  customerId: string,
): Promise<void> {
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      // Never inherit DB default trialing on customer-only rows.
      status: "inactive",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[stripe-webhook] customer-only subscriptions upsert failed", {
      userId,
      customerId,
      error,
    });
    throw error;
  }
}

async function handleStripeEvent(
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = extractUserIdFromMetadata(session.metadata) ??
        (typeof session.client_reference_id === "string" ? session.client_reference_id : null);
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

      logWebhookContext(event, {
        metadataUserId: extractUserIdFromMetadata(session.metadata),
        metadataPlanId: session.metadata?.plan_id ?? null,
        metadataBillingInterval: session.metadata?.billing_interval ?? null,
        resolvedUserId: userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });

      if (subscriptionId) {
        try {
          await syncSubscriptionById(admin, stripe, subscriptionId, userId);
        } catch (error) {
          console.error(
            "[stripe-webhook] checkout.session.completed sync failed; subscription events may retry",
            {
              subscriptionId,
              userId,
              error,
            },
          );
        }
        return;
      }

      if (userId && customerId) {
        await upsertCustomerOnlyRow(admin, userId, customerId);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscription(admin, subscription);
      logWebhookContext(event, {
        stripeCustomerId: typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null,
        stripeSubscriptionId: subscription.id,
      });
      logSubscriptionContext(subscription, userId);

      if (!userId) {
        console.warn("[stripe-webhook] Skipping subscription event without resolvable user", {
          eventType: event.type,
          subscriptionId: subscription.id,
        });
        return;
      }

      const payload = buildSubscriptionUpsertPayload(userId, subscription);
      await upsertSubscriptionRow(admin, payload);
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscription(admin, subscription);
      logWebhookContext(event, {
        stripeSubscriptionId: subscription.id,
        resolvedUserId: userId,
      });

      if (!userId) return;

      await upsertSubscriptionRow(admin, {
        ...buildSubscriptionUpsertPayload(userId, subscription),
        status: "canceled",
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
      logWebhookContext(event, {
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null,
      });
      if (!customerId) return;
      await updateStatusForCustomer(admin, customerId, "past_due");
      return;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id ?? null;

      logWebhookContext(event, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId ?? null,
      });

      if (subscriptionId) {
        await syncSubscriptionById(admin, stripe, subscriptionId);
        return;
      }
      if (!customerId) return;
      await updateStatusForCustomer(admin, customerId, "active");
      return;
    }
    default:
      logWebhookContext(event);
      return;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "Server configuration error." }, 500);
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return jsonResponse({ error: "Missing Stripe-Signature header." }, 400);
  }

  const stripe = getStripe();
  const secretMode = detectStripeKeyMode(Deno.env.get("STRIPE_SECRET_KEY"));
  const configuredMode = Deno.env.get("STRIPE_MODE") as "test" | "live" | undefined;
  if (configuredMode && secretMode && configuredMode !== secretMode) {
    return jsonResponse({ error: "Stripe webhook mode mismatch." }, 500);
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", error);
    return jsonResponse({ error: "Invalid Stripe signature." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    await handleStripeEvent(admin, stripe, event);
    return jsonResponse({ received: true, eventType: event.type, eventId: event.id });
  } catch (error) {
    const details = error && typeof error === "object"
      ? {
        message: "message" in error ? String(error.message) : undefined,
        code: "code" in error ? String(error.code) : undefined,
        details: "details" in error ? error.details : undefined,
        hint: "hint" in error ? error.hint : undefined,
      }
      : { message: String(error) };

    console.error("[stripe-webhook] handler failed", {
      eventType: event.type,
      eventId: event.id,
      ...details,
      error,
    });
    return jsonResponse({ error: "Webhook handler failed." }, 500);
  }
});
