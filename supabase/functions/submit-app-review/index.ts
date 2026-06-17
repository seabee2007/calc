import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { isOwnerRole } from "../_shared/usageSummary.ts";
import { resolveUsageContext } from "../_shared/usage.ts";
import { getUsagePeriod } from "../_shared/usageLimits.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const REVIEW_REWARD_QUANTITY = 25;
const REVIEW_REWARD_UNIT = "ai_request";
const MIN_ACCOUNT_AGE_DAYS = 7;
const MIN_REVIEW_TEXT_LENGTH = 20;
const MAX_REVIEW_TEXT_LENGTH = 2000;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function daysSince(isoDate: string): number {
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function trimOptional(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
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
    const rating = body.rating;
    const reviewText = typeof body.reviewText === "string" ? body.reviewText.trim() : "";
    const publicConsent = body.publicConsent === true;

    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      return jsonResponse({ error: "Rating must be an integer from 0 to 5." }, 400);
    }

    if (reviewText.length < MIN_REVIEW_TEXT_LENGTH) {
      return jsonResponse({
        error: `Feedback must be at least ${MIN_REVIEW_TEXT_LENGTH} characters.`,
      }, 400);
    }

    if (reviewText.length > MAX_REVIEW_TEXT_LENGTH) {
      return jsonResponse({
        error: `Feedback must be at most ${MAX_REVIEW_TEXT_LENGTH} characters.`,
      }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, employer_id, created_at")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[submit-app-review] profile lookup failed", profileError);
      return jsonResponse({ error: "Could not verify account." }, 500);
    }

    if (!isOwnerRole(profile?.role ? String(profile.role) : null)) {
      return jsonResponse(
        {
          error: "Only company owners can submit feedback for usage credits.",
          code: "owner_only",
        },
        403,
      );
    }

    const createdAt = profile?.created_at ? String(profile.created_at) : null;
    if (!createdAt) {
      return jsonResponse({ error: "Could not determine account age." }, 500);
    }

    const accountAgeDays = daysSince(createdAt);
    if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
      return jsonResponse({
        error: "not_eligible_yet",
        code: "not_eligible_yet",
        daysRemaining: MIN_ACCOUNT_AGE_DAYS - accountAgeDays,
      }, 403);
    }

    const context = await resolveUsageContext(admin, authResult.user.id);
    const employerId = context.employerId;

    const existingQuery = admin
      .from("app_reviews")
      .select("id")
      .eq("reward_granted", true)
      .limit(1);

    const { data: existingReview, error: existingError } = employerId
      ? await existingQuery.eq("employer_id", employerId).maybeSingle()
      : await existingQuery.eq("user_id", authResult.user.id).is("employer_id", null).maybeSingle();

    if (existingError) {
      console.error("[submit-app-review] existing review lookup failed", existingError);
      return jsonResponse({ error: "Could not verify review status." }, 500);
    }

    if (existingReview?.id) {
      return jsonResponse({
        error: "already_claimed",
        code: "already_claimed",
        reviewId: existingReview.id,
      }, 409);
    }

    const reviewerName = trimOptional(body.reviewerName, 120);
    const reviewerCompany = trimOptional(body.reviewerCompany, 200);
    const reviewerRole = trimOptional(body.reviewerRole, 120);

    const { data: reviewRow, error: insertReviewError } = await admin
      .from("app_reviews")
      .insert({
        user_id: authResult.user.id,
        employer_id: employerId,
        rating,
        review_text: reviewText,
        public_consent: publicConsent,
        reviewer_name: reviewerName,
        reviewer_company: reviewerCompany,
        reviewer_role: reviewerRole,
        source: "in_app",
        status: "submitted",
        reward_granted: false,
        metadata: {},
      })
      .select("id")
      .single();

    if (insertReviewError || !reviewRow?.id) {
      console.error("[submit-app-review] insert review failed", insertReviewError);
      if (insertReviewError?.code === "23505") {
        return jsonResponse({
          error: "already_claimed",
          code: "already_claimed",
        }, 409);
      }
      return jsonResponse({ error: "Could not save feedback." }, 500);
    }

    const reviewId = String(reviewRow.id);
    const period = getUsagePeriod();
    const expiresAt = period.end;

    const { error: creditError } = await admin.from("usage_credit_packs").insert({
      user_id: authResult.user.id,
      employer_id: employerId,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_customer_id: null,
      usage_unit: REVIEW_REWARD_UNIT,
      quantity_purchased: REVIEW_REWARD_QUANTITY,
      quantity_remaining: REVIEW_REWARD_QUANTITY,
      status: "active",
      expires_at: expiresAt,
      metadata: {
        pack_id: "review_reward_ai_25",
        source: "review_reward",
        reviewId,
        rewardName: "Review feedback reward",
      },
    });

    if (creditError) {
      console.error("[submit-app-review] credit pack insert failed", creditError);
      await admin.from("app_reviews").delete().eq("id", reviewId);
      return jsonResponse({ error: "Could not grant usage credits." }, 500);
    }

    const grantedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("app_reviews")
      .update({
        reward_granted: true,
        reward_granted_at: grantedAt,
      })
      .eq("id", reviewId);

    if (updateError) {
      console.error("[submit-app-review] mark reward granted failed", updateError);
      return jsonResponse({ error: "Review saved but reward status could not be finalized." }, 500);
    }

    return jsonResponse({
      ok: true,
      reviewId,
      reward: {
        usageUnit: REVIEW_REWARD_UNIT,
        quantity: REVIEW_REWARD_QUANTITY,
        expiresAt,
      },
    });
  } catch (err) {
    console.error("[submit-app-review] exception:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
