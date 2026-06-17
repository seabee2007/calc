import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { isOwnerRole } from "../_shared/usageSummary.ts";
import { resolveUsageContext } from "../_shared/usage.ts";
import { getUsagePeriod } from "../_shared/usageLimits.ts";
import {
  getUsageCreditPack,
  isUsageCreditPackId,
  canPurchaseCreditPacks,
} from "../_shared/usageCreditPacks.ts";
import {
  buildUsageCreditPackCheckoutMetadata,
  buildUsageCreditPackCheckoutMetadata as buildCheckoutMetadata,
} from "../_shared/usageCreditPackCheckout.ts";

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
    const forbiddenCheckoutFields = [
      "priceId",
      "price",
      "amount",
      "line_items",
      "lineItems",
      "stripePriceId",
    ] as const;
    for (const field of forbiddenCheckoutFields) {
      if (field in body && body[field] != null) {
        return jsonResponse({ error: `Client must not send ${field}.` }, 400);
      }
    }

    const packId = body.packId;
    if (!isUsageCreditPackId(packId)) {
      return jsonResponse({ error: "Invalid packId." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, employer_id")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[create-usage-credit-checkout] profile lookup failed", profileError);
      return jsonResponse({ error: "Could not verify account role." }, 500);
    }

    if (!isOwnerRole(profile?.role ? String(profile.role) : null)) {
      return jsonResponse(
        {
          error: "Only company owners can purchase usage credit packs.",
          code: "owner_only",
        },
        403,
      );
    }

    const context = await resolveUsageContext(admin, authResult.user.id);
    if (!canPurchaseCreditPacks(context.planId)) {
      return jsonResponse(
        {
          error: "Upgrade to a paid plan before purchasing usage credits.",
          code: "paid_plan_required",
        },
        403,
      );
    }

    const pack = getUsageCreditPack(packId);
    const period = getUsagePeriod();
    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      admin,
      authResult.user.id,
      authResult.user.email,
    );
    const priceId = await findPriceIdByLookupKey(stripe, pack.stripeLookupKey);
    const appUrl = getAppUrl();
    const returnTo = typeof body.returnTo === "string" ? body.returnTo : "/settings/billing";
    const successUrl = resolveAppReturnUrl(
      body.successUrl,
      appUrl,
      `${appUrl}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}?creditCheckout=success#usage`,
    );
    const cancelUrl = resolveAppReturnUrl(
      body.cancelUrl,
      appUrl,
      `${appUrl}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}?creditCheckout=canceled#usage`,
    );

    const metadata = buildCheckoutMetadata({
      packId,
      userId: authResult.user.id,
      employerId: context.employerId,
      expiresAt: period.end,
      units: pack.units,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: authResult.user.id,
      metadata,
    });

    if (!session.url) {
      return jsonResponse({ error: "Stripe Checkout session URL missing." }, 500);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("[create-usage-credit-checkout]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Credit pack checkout failed." },
      500,
    );
  }
});
