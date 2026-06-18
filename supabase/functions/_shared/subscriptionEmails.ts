/**
 * Billing/system subscription welcome emails — server-side only.
 * Does not meter email_send usage or respect marketing notification preferences.
 */
import { sendTransactionalEmail } from "./resend.ts";
import type { EmailTemplateKey } from "./emailValidation.ts";
import {
  buildSubscriptionUsageSummary,
  isPaidPlanId,
  resolveSubscriptionEmailAppUrl,
  shouldSendSubscriptionWelcomeEmail,
  SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN,
  SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN,
  type PaidPlanId,
  type SubscriptionRowSnapshot,
  type SubscriptionWelcomeEmailType,
} from "./subscriptionEmailRules.ts";

export {
  ACTIVE_PAID_SUBSCRIPTION_STATUSES,
  buildSubscriptionUsageSummary,
  isActivePaidSubscriptionStatus,
  isPaidPlanId,
  planRank,
  shouldSendSubscriptionWelcomeEmail,
  SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN,
  SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN,
  type PaidPlanId,
  type SubscriptionRowSnapshot,
  type SubscriptionWelcomeEmailType,
} from "./subscriptionEmailRules.ts";

type SupabaseAdmin = ReturnType<
  typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient
>;

export interface MaybeSendSubscriptionWelcomeEmailInput {
  userId: string;
  stripeSubscriptionId: string;
  stripeEventId: string;
  planId: PaidPlanId;
  status: string;
  previousRow?: SubscriptionRowSnapshot | null;
}

async function resolveRecipientProfile(
  admin: SupabaseAdmin,
  userId: string,
): Promise<{ email: string | null; firstName: string | null; employerId: string | null }> {
  const [{ data: profile, error: profileError }, { data: authData, error: authError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("first_name, employer_id")
        .eq("id", userId)
        .maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);

  if (profileError) {
    console.error("[subscription-email] profile lookup failed", { userId, error: profileError });
  }
  if (authError) {
    console.error("[subscription-email] auth user lookup failed", { userId, error: authError });
  }

  const email = authData?.user?.email?.trim() || null;
  const firstName = typeof profile?.first_name === "string" ? profile.first_name.trim() : null;
  const employerId = typeof profile?.employer_id === "string" ? profile.employer_id : null;

  return { email, firstName, employerId };
}

async function hasExistingSubscriptionEmailEvent(
  admin: SupabaseAdmin,
  input: {
    stripeEventId: string;
    emailType: SubscriptionWelcomeEmailType;
    stripeSubscriptionId: string;
    planId: PaidPlanId;
  },
): Promise<boolean> {
  const [byEvent, bySubscription] = await Promise.all([
    admin
      .from("subscription_email_events")
      .select("id")
      .eq("stripe_event_id", input.stripeEventId)
      .eq("email_type", input.emailType)
      .maybeSingle(),
    admin
      .from("subscription_email_events")
      .select("id")
      .eq("stripe_subscription_id", input.stripeSubscriptionId)
      .eq("plan_id", input.planId)
      .eq("email_type", input.emailType)
      .maybeSingle(),
  ]);

  if (byEvent.error) {
    console.error("[subscription-email] event dedupe lookup failed", byEvent.error);
    throw byEvent.error;
  }
  if (bySubscription.error) {
    console.error("[subscription-email] subscription dedupe lookup failed", bySubscription.error);
    throw bySubscription.error;
  }

  return Boolean(byEvent.data?.id || bySubscription.data?.id);
}

async function recordSubscriptionEmailEvent(
  admin: SupabaseAdmin,
  input: {
    userId: string;
    employerId: string | null;
    stripeSubscriptionId: string;
    stripeEventId: string;
    planId: PaidPlanId;
    emailType: SubscriptionWelcomeEmailType;
    sentTo: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("subscription_email_events").insert({
    user_id: input.userId,
    employer_id: input.employerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_event_id: input.stripeEventId,
    plan_id: input.planId,
    email_type: input.emailType,
    sent_to: input.sentTo,
    metadata: input.metadata ?? {},
  });

  if (error) {
    if (error.code === "23505") {
      console.warn("[subscription-email] duplicate send prevented by unique index", {
        stripeEventId: input.stripeEventId,
        emailType: input.emailType,
        stripeSubscriptionId: input.stripeSubscriptionId,
        planId: input.planId,
      });
      return;
    }
    throw error;
  }
}

export async function maybeSendSubscriptionWelcomeEmail(
  admin: SupabaseAdmin,
  input: MaybeSendSubscriptionWelcomeEmailInput,
): Promise<{ sent: boolean; skippedReason?: string; error?: string }> {
  if (!isPaidPlanId(input.planId)) {
    return { sent: false, skippedReason: "not_eligible" };
  }

  if (!shouldSendSubscriptionWelcomeEmail({
    planId: input.planId,
    status: input.status,
    previousRow: input.previousRow,
  })) {
    return { sent: false, skippedReason: "not_eligible" };
  }

  if (!input.stripeSubscriptionId) {
    return { sent: false, skippedReason: "missing_subscription_id" };
  }

  const emailType = SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN[input.planId];
  const templateKey = SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN[
    input.planId
  ] as EmailTemplateKey;

  const alreadySent = await hasExistingSubscriptionEmailEvent(admin, {
    stripeEventId: input.stripeEventId,
    emailType,
    stripeSubscriptionId: input.stripeSubscriptionId,
    planId: input.planId,
  });
  if (alreadySent) {
    return { sent: false, skippedReason: "already_sent" };
  }

  const recipient = await resolveRecipientProfile(admin, input.userId);
  if (!recipient.email) {
    console.warn("[subscription-email] missing recipient email; skipping welcome email", {
      userId: input.userId,
      planId: input.planId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    });
    return { sent: false, skippedReason: "missing_email" };
  }

  let appUrl: string;
  try {
    appUrl = resolveSubscriptionEmailAppUrl();
  } catch (error) {
    console.error("[subscription-email] APP_URL missing", error);
    return { sent: false, skippedReason: "missing_app_url" };
  }

  const sendResult = await sendTransactionalEmail({
    templateKey,
    to: recipient.email,
    data: {
      firstName: recipient.firstName ?? "",
      billingUrl: `${appUrl}/settings/billing`,
      dashboardUrl: `${appUrl}/`,
      usageSummary: buildSubscriptionUsageSummary(input.planId),
    },
  });

  if (!sendResult.ok) {
    console.error("[subscription-email] send failed", {
      userId: input.userId,
      planId: input.planId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeEventId: input.stripeEventId,
      error: sendResult.error,
      disabled: sendResult.disabled,
      skipped: sendResult.skipped,
    });
    return {
      sent: false,
      skippedReason: sendResult.skipped ? "email_disabled" : "send_failed",
      error: sendResult.error,
    };
  }

  await recordSubscriptionEmailEvent(admin, {
    userId: input.userId,
    employerId: recipient.employerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeEventId: input.stripeEventId,
    planId: input.planId,
    emailType,
    sentTo: sendResult.to,
    metadata: {
      resendMessageId: sendResult.messageId ?? null,
      templateKey,
      billingSystemEmail: true,
      unmetered: true,
      ...sendResult.metadata,
    },
  });

  console.log("[subscription-email] welcome email sent", {
    userId: input.userId,
    planId: input.planId,
    emailType,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeEventId: input.stripeEventId,
    to: sendResult.to,
  });

  return { sent: true };
}

export async function fetchSubscriptionRowSnapshot(
  admin: SupabaseAdmin,
  userId: string,
): Promise<SubscriptionRowSnapshot | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan_id, status, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[subscription-email] previous subscription lookup failed", { userId, error });
    throw error;
  }

  return data ?? null;
}
