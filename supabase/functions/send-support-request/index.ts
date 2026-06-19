import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { readEmailEnvConfig, validateEmailConfigForSend } from "../_shared/emailConfig.ts";
import { isValidEmailAddress } from "../_shared/emailValidation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPPORT_INBOX_EMAIL =
  Deno.env.get("SUPPORT_INBOX_EMAIL")?.trim() || "support@ardenprojectos.com";

const SUBJECT_MIN = 5;
const SUBJECT_MAX = 120;
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 5000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const AUTH_RATE_LIMIT = 10;
const ANON_RATE_LIMIT = 3;

const ALLOWED_TOPICS = new Set([
  "billing",
  "login",
  "project_setup",
  "estimate_proposal",
  "scheduling_planner",
  "file_import_export",
  "client_portal",
  "bug_report",
  "feature_request",
  "data_issue",
  "other",
]);

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function resolveOptionalAuth(
  req: Request,
): Promise<{ userId: string | null; email: string | null }> {
  if (!SUPABASE_URL) return { userId: null, email: null };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, email: null };
  }

  const jwt = authHeader.slice(7);
  if (!jwt || jwt === SUPABASE_ANON_KEY) {
    return { userId: null, email: null };
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) return { userId: null, email: null };
  return { userId: user.id, email: user.email ?? null };
}

async function resolvePlanName(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.plan_id) return null;
  const status = typeof data.status === "string" ? data.status : "";
  if (!["active", "trialing", "past_due"].includes(status)) return null;
  return String(data.plan_id);
}

async function isRateLimited(
  admin: ReturnType<typeof createClient>,
  input: { userId: string | null; contactEmail: string },
): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error } = input.userId
    ? await admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("user_id", input.userId)
    : await admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .is("user_id", null)
      .eq("contact_email", input.contactEmail);

  if (error) {
    console.error("[send-support-request] rate limit lookup failed", error);
    return false;
  }

  const limit = input.userId ? AUTH_RATE_LIMIT : ANON_RATE_LIMIT;
  return (count ?? 0) >= limit;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server configuration error." }, 500);
  }

  try {
    const body = await req.json();
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const contactEmailInput = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 500) : "";
    const userAgent = typeof body.userAgent === "string" ? body.userAgent.trim().slice(0, 500) : "";
    const projectId = typeof body.projectId === "string" ? body.projectId.trim().slice(0, 64) : null;
    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : {};

    if (!topic || !ALLOWED_TOPICS.has(topic)) {
      return jsonResponse({ ok: false, error: "Select a valid support topic." }, 400);
    }

    if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
      return jsonResponse({
        ok: false,
        error: `Subject must be between ${SUBJECT_MIN} and ${SUBJECT_MAX} characters.`,
      }, 400);
    }

    if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
      return jsonResponse({
        ok: false,
        error: `Message must be between ${MESSAGE_MIN} and ${MESSAGE_MAX} characters.`,
      }, 400);
    }

    const auth = await resolveOptionalAuth(req);
    const contactEmail = (contactEmailInput || auth.email || "").trim();

    if (!contactEmail || !isValidEmailAddress(contactEmail)) {
      return jsonResponse({ ok: false, error: "A valid contact email is required." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (await isRateLimited(admin, { userId: auth.userId, contactEmail })) {
      return jsonResponse({
        ok: false,
        error: "Too many support requests. Please wait and try again later.",
      }, 429);
    }

    let employerId: string | null = null;
    let planName: string | null = null;

    if (auth.userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("employer_id")
        .eq("id", auth.userId)
        .maybeSingle();
      employerId = typeof profile?.employer_id === "string" ? profile.employer_id : null;
      planName = await resolvePlanName(admin, auth.userId);
    }

    const topicLabel = typeof metadata.topicLabel === "string"
      ? metadata.topicLabel
      : topic.replaceAll("_", " ");

    const emailConfig = readEmailEnvConfig(Deno.env.toObject());
    const validation = validateEmailConfigForSend(emailConfig);
    if (!validation.ok) {
      return jsonResponse({ ok: false, error: validation.message }, 503);
    }

    const supportSubject = `[Arden Support] ${subject}`;
    const textBody = [
      `Topic: ${topicLabel}`,
      `From: ${contactEmail}`,
      auth.userId ? `User ID: ${auth.userId}` : "User ID: (guest)",
      planName ? `Plan: ${planName}` : null,
      pageUrl ? `Page URL: ${pageUrl}` : null,
      userAgent ? `Browser: ${userAgent}` : null,
      projectId ? `Project ID: ${projectId}` : null,
      "",
      "Message:",
      message,
    ].filter(Boolean).join("\n");

    const htmlBody = textBody
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");

    const fromEmail = emailConfig.notificationsFromEmail || emailConfig.fromEmail;

    const sendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [SUPPORT_INBOX_EMAIL],
        subject: supportSubject,
        reply_to: contactEmail,
        html: htmlBody,
        text: textBody,
      }),
    });

    const sendBody = await sendResponse.json().catch(() => ({}));
    if (!sendResponse.ok) {
      const sendError = typeof sendBody?.message === "string"
        ? sendBody.message
        : typeof sendBody?.error === "string"
          ? sendBody.error
          : "Unable to send support email.";
      console.error("[send-support-request] resend failed", sendError);
      return jsonResponse({ ok: false, error: sendError }, 502);
    }

    const { data: inserted, error: insertError } = await admin
      .from("support_requests")
      .insert({
        user_id: auth.userId,
        employer_id: employerId,
        contact_email: contactEmail,
        topic,
        subject,
        message,
        status: "submitted",
        metadata: {
          ...metadata,
          pageUrl: pageUrl || null,
          userAgent: userAgent || null,
          projectId,
          planName,
          resendEmailId: typeof sendBody?.id === "string" ? sendBody.id : null,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[send-support-request] insert failed", insertError);
    }

    return jsonResponse({
      ok: true,
      supportRequestId: inserted?.id ?? null,
      message: "Support request sent.",
    });
  } catch (error) {
    console.error("[send-support-request] exception", error);
    return jsonResponse({ ok: false, error: "Internal server error" }, 500);
  }
});
