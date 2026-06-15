/**
 * Stripe webhook handler (stub).
 *
 * Wire real Stripe signature verification and SDK calls when Checkout goes live.
 * Never trust client-supplied plan IDs — resolve plan from Stripe price lookup keys only.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

type PlanId = 'starter' | 'professional' | 'business';

const LOOKUP_KEY_TO_PLAN: Record<string, PlanId> = {
  arden_starter_monthly: 'starter',
  arden_starter_annual: 'starter',
  arden_professional_monthly: 'professional',
  arden_professional_annual: 'professional',
  arden_business_monthly: 'business',
  arden_business_annual: 'business',
};

interface StripeEventStub {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

function resolvePlanFromPriceLookup(priceLookupKey: string | undefined): PlanId {
  if (!priceLookupKey) return 'starter';
  return LOOKUP_KEY_TO_PLAN[priceLookupKey] ?? 'starter';
}

function resolvePlanFromStripeObject(object: Record<string, unknown>): PlanId {
  const metadataPlan = object.metadata && typeof object.metadata === 'object'
    ? (object.metadata as Record<string, unknown>).plan_id
    : undefined;
  if (typeof metadataPlan === 'string' && metadataPlan in LOOKUP_KEY_TO_PLAN === false) {
    const normalized = metadataPlan as PlanId;
    if (normalized === 'starter' || normalized === 'professional' || normalized === 'business') {
      return normalized;
    }
  }

  const items = object.items as { data?: Array<{ price?: { lookup_key?: string } }> } | undefined;
  const lookupKey = items?.data?.[0]?.price?.lookup_key;
  return resolvePlanFromPriceLookup(typeof lookupKey === 'string' ? lookupKey : undefined);
}

async function upsertSubscriptionFromStripeObject(
  admin: ReturnType<typeof createClient>,
  userId: string,
  object: Record<string, unknown>,
) {
  const planId = resolvePlanFromStripeObject(object);
  const status = typeof object.status === 'string' ? object.status : 'trialing';

  const payload = {
    user_id: userId,
    stripe_customer_id:
      typeof object.customer === 'string' ? object.customer : null,
    stripe_subscription_id: typeof object.id === 'string' ? object.id : null,
    plan_id: planId,
    status,
    current_period_start:
      typeof object.current_period_start === 'number'
        ? new Date(object.current_period_start * 1000).toISOString()
        : null,
    current_period_end:
      typeof object.current_period_end === 'number'
        ? new Date(object.current_period_end * 1000).toISOString()
        : null,
    trial_end:
      typeof object.trial_end === 'number'
        ? new Date(object.trial_end * 1000).toISOString()
        : null,
    cancel_at_period_end: Boolean(object.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from('subscriptions').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

function extractUserId(object: Record<string, unknown>): string | null {
  const metadata = object.metadata;
  if (metadata && typeof metadata === 'object') {
    const userId = (metadata as Record<string, unknown>).user_id;
    if (typeof userId === 'string' && userId.length > 0) return userId;
  }
  const clientReferenceId = object.client_reference_id;
  if (typeof clientReferenceId === 'string' && clientReferenceId.length > 0) {
    return clientReferenceId;
  }
  return null;
}

async function handleStripeEvent(admin: ReturnType<typeof createClient>, event: StripeEventStub) {
  const object = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = extractUserId(object);
      if (!userId) return;
      const subscriptionId = object.subscription;
      if (typeof subscriptionId === 'string') {
        // When Stripe SDK is wired, fetch the subscription object here instead of trusting the session.
        await upsertSubscriptionFromStripeObject(admin, userId, {
          ...object,
          id: subscriptionId,
          status: 'active',
        });
      }
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = extractUserId(object);
      if (!userId) return;
      await upsertSubscriptionFromStripeObject(admin, userId, object);
      return;
    }
    case 'customer.subscription.deleted': {
      const userId = extractUserId(object);
      if (!userId) return;
      await upsertSubscriptionFromStripeObject(admin, userId, {
        ...object,
        status: 'canceled',
      });
      return;
    }
    case 'invoice.payment_failed': {
      const userId = extractUserId(object);
      if (!userId) return;
      await upsertSubscriptionFromStripeObject(admin, userId, {
        ...object,
        status: 'past_due',
      });
      return;
    }
    case 'invoice.payment_succeeded': {
      const userId = extractUserId(object);
      if (!userId) return;
      await upsertSubscriptionFromStripeObject(admin, userId, {
        ...object,
        status: 'active',
      });
      return;
    }
    default:
      return;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signature = req.headers.get('Stripe-Signature');
  const rawBody = await req.text();

  // TODO: verify signature with Stripe SDK:
  // const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured — stub mode only.');
  }
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing Stripe-Signature header.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: StripeEventStub;
  try {
    event = JSON.parse(rawBody) as StripeEventStub;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    await handleStripeEvent(admin, event);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[stripe-webhook] handler failed', error);
    return new Response(JSON.stringify({ error: 'Webhook handler failed.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
