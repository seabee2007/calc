import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import {
  findPriceIdByLookupKey,
  getAppUrl,
  getOrCreateStripeCustomer,
  getStripe,
  isPlanId,
  lookupKeyForPlan,
  parseBillingInterval,
  PLAN_INCLUDED_FIELD_SEATS,
  STRIPE_PRICE_LOOKUP_KEYS,
  type PlanId,
} from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authResult = await requireAuth(req, corsHeaders);
  if (!authResult.ok) return authResult.response;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Server configuration error." }, 500);
  }

  try {
    const body = await req.json();
    const planId = body.planId;
    const billingInterval = parseBillingInterval(body.billingInterval);
    const fieldSeatQuantity = Number(body.fieldSeatQuantity ?? 0);

    if (!isPlanId(planId)) {
      return jsonResponse({ error: "Invalid planId." }, 400);
    }
    if (!billingInterval) {
      return jsonResponse({ error: "Invalid billingInterval." }, 400);
    }
    if (!Number.isFinite(fieldSeatQuantity) || fieldSeatQuantity < 0) {
      return jsonResponse({ error: "Invalid fieldSeatQuantity." }, 400);
    }

    const stripe = getStripe();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      admin,
      authResult.user.id,
      authResult.user.email,
    );

    const planLookupKey = lookupKeyForPlan(planId as PlanId, billingInterval);
    const planPriceId = await findPriceIdByLookupKey(stripe, planLookupKey);

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: planPriceId, quantity: 1 },
    ];

    const includedSeats = PLAN_INCLUDED_FIELD_SEATS[planId as PlanId];
    const extraSeats = Math.max(0, Math.floor(fieldSeatQuantity) - includedSeats);
    if (extraSeats > 0) {
      const seatPriceId = await findPriceIdByLookupKey(
        stripe,
        STRIPE_PRICE_LOOKUP_KEYS.extra_field_seat,
      );
      lineItems.push({ price: seatPriceId, quantity: extraSeats });
    }

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${appUrl}/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/settings/billing?checkout=canceled`,
      client_reference_id: authResult.user.id,
      subscription_data: {
        metadata: {
          user_id: authResult.user.id,
          plan_id: planId,
          billing_interval: billingInterval,
        },
      },
      metadata: {
        user_id: authResult.user.id,
        plan_id: planId,
        billing_interval: billingInterval,
      },
    });

    if (!session.url) {
      return jsonResponse({ error: "Stripe Checkout session URL missing." }, 500);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("[create-checkout-session]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Checkout session failed." },
      500,
    );
  }
});
