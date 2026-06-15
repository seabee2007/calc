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
  if (!userId) {
    console.warn("[stripe-webhook] Could not resolve user for subscription", subscriptionId);
    return;
  }
  await upsertSubscriptionRow(admin, buildSubscriptionUpsertPayload(userId, subscription));
}

async function updateStatusForCustomer(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  status: string,
): Promise<void> {
  const userId = await findUserIdForStripeCustomer(admin, customerId);
  if (!userId) return;

  const { error } = await admin
    .from("subscriptions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw error;
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

      if (subscriptionId) {
        await syncSubscriptionById(admin, stripe, subscriptionId, userId);
        return;
      }

      if (userId && typeof session.customer === "string") {
        await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscription(admin, subscription);
      if (!userId) return;
      await upsertSubscriptionRow(admin, buildSubscriptionUpsertPayload(userId, subscription));
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscription(admin, subscription);
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
      if (!customerId) return;
      await updateStatusForCustomer(admin, customerId, "past_due");
      return;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
      if (subscriptionId) {
        await syncSubscriptionById(admin, stripe, subscriptionId);
        return;
      }
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
      if (!customerId) return;
      await updateStatusForCustomer(admin, customerId, "active");
      return;
    }
    default:
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

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", error);
    return jsonResponse({ error: "Invalid Stripe signature." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    await handleStripeEvent(admin, stripe, event);
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] handler failed", error);
    return jsonResponse({ error: "Webhook handler failed." }, 500);
  }
});
