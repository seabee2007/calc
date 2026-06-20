import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { readEmailEnvConfig } from "../_shared/emailConfig.ts";
import { insertEmailEvent } from "../_shared/emailEvents.ts";
import { renderEmailTemplate } from "../_shared/emailTemplates.ts";
import { isValidEmailAddress } from "../_shared/emailValidation.ts";
import { resolveEmailSiteUrl, sendTransactionalEmail } from "../_shared/resend.ts";
import {
  isUsageConfigured,
  requireUsageQuota,
  trackMeteredUsage,
} from "../_shared/meterUsage.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const EMPLOYEE_PORTAL_PLANS = new Set(["starter", "professional", "business"]);
const DEFAULT_SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  professional: 5,
  business: 15,
};
const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  foreman: "Foreman",
  project_manager: "Project Manager",
  admin: "Admin",
};
const ALLOWED_INVITE_ROLES = new Set(["admin", "project_manager", "foreman", "employee"]);
const INVITE_EXPIRY_DAYS = 14;
const RESEND_COOLDOWN_SECONDS = 60;
const SEAT_LIMIT_MESSAGE =
  "Field seat limit reached. Starter includes 1 field seat. Remove a pending invite, deactivate a field user, or upgrade for additional field seats.";

type InviteRow = Record<string, unknown>;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRole(value: unknown): string {
  const role = typeof value === "string" ? value.trim() : "employee";
  if (!ALLOWED_INVITE_ROLES.has(role) || role === "admin") return "employee";
  return role;
}

function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function addDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "14 days";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isExpired(invite: InviteRow): boolean {
  const expiresAt = typeof invite.expires_at === "string" ? invite.expires_at : "";
  const date = new Date(expiresAt);
  return !expiresAt || Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

function secondsSince(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 1000);
}

async function resolveEmployer(
  admin: SupabaseClient,
  user: { id: string; email?: string },
): Promise<
  | { ok: true; employerId: string; inviterName: string }
  | { ok: false; status: number; error: string }
> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role, employer_id, display_name, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Could not verify team permissions." };
  }

  if (!profile) {
    return { ok: true, employerId: user.id, inviterName: user.email ?? "Team owner" };
  }

  const role = String(profile.role ?? "");
  const employerId = role === "admin" && profile.employer_id ? String(profile.employer_id) : user.id;

  if (role !== "owner" && role !== "admin") {
    return { ok: false, status: 403, error: "Only team owners and admins can invite employees." };
  }

  const nameParts = [profile.first_name, profile.last_name]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => String(part).trim());
  const inviterName =
    String(profile.display_name ?? "").trim() ||
    nameParts.join(" ") ||
    user.email ||
    "Team owner";

  return { ok: true, employerId, inviterName };
}

async function resolveCompanyName(admin: SupabaseClient, employerId: string): Promise<{
  companyName: string;
  supportContact: string;
}> {
  const { data } = await admin
    .from("company_settings")
    .select("company_name, email")
    .eq("user_id", employerId)
    .maybeSingle();

  const config = readEmailEnvConfig(Deno.env.toObject());
  return {
    companyName: String(data?.company_name ?? "").trim() || "your company",
    supportContact:
      String(data?.email ?? "").trim() || config.replyTo || "support@ardenprojectos.com",
  };
}

async function resolveSeatLimit(
  admin: SupabaseClient,
  employerId: string,
): Promise<
  | { ok: true; seatLimit: number; effectivePlan: string }
  | { ok: false; status: number; error: string }
> {
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("plan_id, status, included_field_seats")
    .eq("user_id", employerId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Could not verify subscription." };
  }

  const effectivePlan =
    subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription.status))
      ? String(subscription.plan_id)
      : "starter";

  if (!EMPLOYEE_PORTAL_PLANS.has(effectivePlan)) {
    return { ok: false, status: 403, error: "Upgrade required to invite team members." };
  }

  const seatLimit =
    typeof subscription?.included_field_seats === "number"
      ? subscription.included_field_seats
      : DEFAULT_SEAT_LIMITS[effectivePlan] ?? 0;

  return { ok: true, seatLimit, effectivePlan };
}

async function countSeatUsage(admin: SupabaseClient, employerId: string): Promise<
  | { ok: true; teamCount: number; activePendingCount: number }
  | { ok: false; status: number; error: string }
> {
  const { count: teamCount, error: teamCountError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employerId);

  if (teamCountError) {
    return { ok: false, status: 500, error: "Could not verify team seat usage." };
  }

  const { count: activePendingCount, error: pendingCountError } = await admin
    .from("employee_invites")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .eq("status", "pending")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());

  if (pendingCountError) {
    return { ok: false, status: 500, error: "Could not verify pending invites." };
  }

  return {
    ok: true,
    teamCount: teamCount ?? 0,
    activePendingCount: activePendingCount ?? 0,
  };
}

async function assertSeatAvailableForNewInvite(
  admin: SupabaseClient,
  employerId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const seatLimit = await resolveSeatLimit(admin, employerId);
  if (!seatLimit.ok) return seatLimit;

  const usage = await countSeatUsage(admin, employerId);
  if (!usage.ok) return usage;

  const seatUsage = usage.teamCount + usage.activePendingCount;
  if (seatLimit.seatLimit >= 0 && seatUsage >= seatLimit.seatLimit) {
    return { ok: false, status: 403, error: SEAT_LIMIT_MESSAGE };
  }

  return { ok: true };
}

async function findInviteById(
  admin: SupabaseClient,
  inviteId: string,
  employerId: string,
): Promise<InviteRow | null> {
  const { data, error } = await admin
    .from("employee_invites")
    .select("*")
    .eq("id", inviteId)
    .eq("employer_id", employerId)
    .eq("status", "pending")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error("Invite not found");
  return data as InviteRow | null;
}

async function findPendingInviteByEmail(
  admin: SupabaseClient,
  employerId: string,
  email: string,
): Promise<InviteRow | null> {
  const { data, error } = await admin
    .from("employee_invites")
    .select("*")
    .eq("employer_id", employerId)
    .ilike("email", email)
    .eq("status", "pending")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not verify existing invite.");
  return data as InviteRow | null;
}

async function createOrReuseInvite(
  admin: SupabaseClient,
  employerId: string,
  email: string,
  role: string,
): Promise<{ invite: InviteRow; reused: boolean; rotatedToken: boolean } | { error: string; status: number }> {
  const existing = await findPendingInviteByEmail(admin, employerId, email);

  if (existing && !isExpired(existing)) {
    const { data, error } = await admin
      .from("employee_invites")
      .update({ role })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { error: "Could not update existing invite.", status: 500 };
    return { invite: data as InviteRow, reused: true, rotatedToken: false };
  }

  const seats = await assertSeatAvailableForNewInvite(admin, employerId);
  if (!seats.ok) return seats;

  if (existing) {
    const { data, error } = await admin
      .from("employee_invites")
      .update({
        role,
        token: generateInviteToken(),
        expires_at: addDays(INVITE_EXPIRY_DAYS),
        status: "pending",
        email_status: "pending",
        email_last_error: null,
        email_sent_at: null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { error: "Could not refresh expired invite.", status: 500 };
    return { invite: data as InviteRow, reused: true, rotatedToken: true };
  }

  const { data, error } = await admin
    .from("employee_invites")
    .insert({
      employer_id: employerId,
      email,
      role,
      token: generateInviteToken(),
      expires_at: addDays(INVITE_EXPIRY_DAYS),
      status: "pending",
      email_status: "pending",
    })
    .select("*")
    .single();

  if (error) return { error: "Could not create invite.", status: 500 };
  return { invite: data as InviteRow, reused: false, rotatedToken: false };
}

async function markInviteAttempt(
  admin: SupabaseClient,
  inviteId: unknown,
): Promise<void> {
  if (typeof inviteId !== "string") return;
  const { error } = await admin.rpc("increment_employee_invite_send_count", {
    p_invite_id: inviteId,
  });

  if (!error) return;

  const { data } = await admin
    .from("employee_invites")
    .select("email_send_count")
    .eq("id", inviteId)
    .maybeSingle();
  await admin
    .from("employee_invites")
    .update({
      email_send_count: Number(data?.email_send_count ?? 0) + 1,
      email_last_attempt_at: new Date().toISOString(),
    })
    .eq("id", inviteId);
}

async function updateInviteDelivery(
  admin: SupabaseClient,
  inviteId: unknown,
  patch: Record<string, unknown>,
): Promise<void> {
  if (typeof inviteId !== "string") return;
  await admin.from("employee_invites").update(patch).eq("id", inviteId);
}

async function revokeInvite(input: {
  admin: SupabaseClient;
  inviteId: string;
  employerId: string;
  revokedBy: string;
}): Promise<InviteRow | { error: string; status: number }> {
  const invite = await findInviteById(input.admin, input.inviteId, input.employerId);
  if (!invite) return { error: "Invite not found", status: 404 };

  const revokedAt = new Date().toISOString();
  const { data, error } = await input.admin
    .from("employee_invites")
    .update({
      status: "revoked",
      revoked_at: revokedAt,
      revoked_by: input.revokedBy,
    })
    .eq("id", input.inviteId)
    .select("*")
    .single();

  if (error) return { error: "Could not revoke invite.", status: 500 };
  return data as InviteRow;
}

async function sendInviteEmail(input: {
  admin: SupabaseClient;
  req: Request;
  userId: string;
  invite: InviteRow;
  inviterName: string;
  companyName: string;
  supportContact: string;
}): Promise<{
  emailStatus: "sent" | "failed";
  emailSent: boolean;
  emailEventId: string | null;
  error?: string;
}> {
  const config = readEmailEnvConfig(Deno.env.toObject());
  const email = String(input.invite.email ?? "");
  const token = String(input.invite.token ?? "");
  const expiresAt = String(input.invite.expires_at ?? "");
  const inviteUrl = `${resolveEmailSiteUrl(config.siteUrl)}/signup?invite=${encodeURIComponent(token)}`;
  const templateData = {
    inviteUrl,
    companyName: input.companyName,
    inviterName: input.inviterName,
    roleLabel: ROLE_LABELS[String(input.invite.role ?? "employee")] ?? "Employee",
    expiresAt: formatExpiry(expiresAt),
    supportContact: input.supportContact,
  };
  const rendered = renderEmailTemplate("teamInvite", templateData);

  await markInviteAttempt(input.admin, input.invite.id);

  if (!isUsageConfigured()) {
    await updateInviteDelivery(input.admin, input.invite.id, {
      email_status: "failed",
      email_last_error: "Usage metering is not configured.",
    });
    return {
      emailStatus: "failed",
      emailSent: false,
      emailEventId: null,
      error: "Usage metering is not configured.",
    };
  }

  const quota = await requireUsageQuota(
    input.userId,
    "email.employee_invite",
    "email_send",
    corsHeaders,
  );
  if (!quota.ok) {
    await updateInviteDelivery(input.admin, input.invite.id, {
      email_status: "failed",
      email_last_error: "Email usage limit reached.",
    });
    return {
      emailStatus: "failed",
      emailSent: false,
      emailEventId: null,
      error: "Email usage limit reached.",
    };
  }

  const sendResult = await sendTransactionalEmail({
    templateKey: "teamInvite",
    to: email,
    data: templateData,
  });

  if (sendResult.ok) {
    await trackMeteredUsage(quota.context, {
      featureKey: "email.employee_invite",
      usageUnit: "email_send",
      requestId: input.req.headers.get("x-request-id"),
      metadata: { inviteId: input.invite.id },
    });

    const sentAt = new Date().toISOString();
    const event = await insertEmailEvent(input.admin, {
      userId: input.userId,
      templateKey: "teamInvite",
      toEmail: sendResult.to,
      fromEmail: sendResult.from,
      subject: sendResult.subject,
      status: "sent",
      resendEmailId: sendResult.messageId ?? null,
      sentAt,
      metadata: { ...sendResult.metadata, inviteId: input.invite.id },
    });

    await updateInviteDelivery(input.admin, input.invite.id, {
      email_status: "sent",
      email_sent_at: sentAt,
      email_last_error: null,
    });

    return {
      emailStatus: "sent",
      emailSent: true,
      emailEventId: event?.id ?? null,
    };
  }

  const event = await insertEmailEvent(input.admin, {
    userId: input.userId,
    templateKey: "teamInvite",
    toEmail: sendResult.to,
    fromEmail: sendResult.from,
    subject: sendResult.subject || rendered.subject,
    status: "failed",
    errorMessage: sendResult.error ?? "Unable to send invite email.",
    metadata: { ...sendResult.metadata, inviteId: input.invite.id },
  });

  await updateInviteDelivery(input.admin, input.invite.id, {
    email_status: "failed",
    email_last_error: sendResult.error ?? "Unable to send invite email.",
  });

  return {
    emailStatus: "failed",
    emailSent: false,
    emailEventId: event?.id ?? null,
    error: sendResult.error ?? "Unable to send invite email.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Server configuration error." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "send").trim().toLowerCase();
    const inviteId = String(body.inviteId ?? "").trim();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const employer = await resolveEmployer(admin, user);
    if (!employer.ok) return jsonResponse({ error: employer.error }, employer.status);

    if (action === "revoke") {
      if (!inviteId) return jsonResponse({ error: "inviteId is required" }, 400);
      const revoked = await revokeInvite({
        admin,
        inviteId,
        employerId: employer.employerId,
        revokedBy: user.id,
      });
      if ("error" in revoked) return jsonResponse({ error: revoked.error }, revoked.status ?? 500);
      return jsonResponse({
        ok: true,
        inviteId: revoked.id,
        email: revoked.email,
        status: revoked.status,
        revokedAt: revoked.revoked_at,
      });
    }

    let invite: InviteRow | null = null;
    let reused = false;
    let rotatedToken = false;

    if (inviteId) {
      invite = await findInviteById(admin, inviteId, employer.employerId);
      if (!invite) return jsonResponse({ error: "Invite not found" }, 404);

      if (isExpired(invite)) {
        const seats = await assertSeatAvailableForNewInvite(admin, employer.employerId);
        if (!seats.ok) return jsonResponse({ error: seats.error }, seats.status);
        const { data, error } = await admin
          .from("employee_invites")
          .update({
            token: generateInviteToken(),
            expires_at: addDays(INVITE_EXPIRY_DAYS),
            status: "pending",
            email_status: "pending",
            email_last_error: null,
            email_sent_at: null,
          })
          .eq("id", invite.id)
          .select("*")
          .single();
        if (error) return jsonResponse({ error: "Could not refresh expired invite." }, 500);
        invite = data as InviteRow;
        rotatedToken = true;
      }
      reused = true;
    } else {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!isValidEmailAddress(email)) {
        return jsonResponse({ error: "Enter a valid employee email address." }, 400);
      }

      const created = await createOrReuseInvite(
        admin,
        employer.employerId,
        email,
        normalizeRole(body.role),
      );
      if ("error" in created) return jsonResponse({ error: created.error }, created.status);
      invite = created.invite;
      reused = created.reused;
      rotatedToken = created.rotatedToken;
    }

    const recentAttemptSeconds = secondsSince(invite.email_last_attempt_at);
    if (recentAttemptSeconds !== null && recentAttemptSeconds < RESEND_COOLDOWN_SECONDS) {
      return jsonResponse(
        {
          ok: false,
          inviteId: invite.id,
          email: invite.email,
          emailStatus: invite.email_status ?? "pending",
          emailSent: false,
          error: `Please wait ${RESEND_COOLDOWN_SECONDS - recentAttemptSeconds} seconds before resending this invite.`,
        },
        429,
      );
    }

    const company = await resolveCompanyName(admin, employer.employerId);
    const delivery = await sendInviteEmail({
      admin,
      req,
      userId: user.id,
      invite,
      inviterName: employer.inviterName,
      companyName: company.companyName,
      supportContact: company.supportContact,
    });

    return jsonResponse({
      ok: true,
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expires_at,
      reused,
      rotatedToken,
      emailSent: delivery.emailSent,
      emailStatus: delivery.emailStatus,
      emailEventId: delivery.emailEventId,
      error: delivery.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
