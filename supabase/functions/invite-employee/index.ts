import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { readEmailEnvConfig } from "../_shared/emailConfig.ts";
import { insertEmailEvent } from "../_shared/emailEvents.ts";
import { renderEmailTemplate } from "../_shared/emailTemplates.ts";
import { prepareTransactionalEmail, sendTransactionalEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(
  /\/$/,
  "",
);

function isExistingUserError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already") ||
    lower.includes("registered") ||
    lower.includes("exists") ||
    lower.includes("duplicate")
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const inviteId = String(body.inviteId ?? "").trim();

    if (!inviteId) {
      return new Response(JSON.stringify({ error: "inviteId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("plan_id, status, included_field_seats")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return new Response(JSON.stringify({ error: "Could not verify subscription." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeStatuses = new Set(["active", "trialing"]);
    const effectivePlan =
      subscription && activeStatuses.has(String(subscription.status))
        ? String(subscription.plan_id)
        : "starter";
    const employeePortalPlans = new Set(["professional", "business"]);

    if (!employeePortalPlans.has(effectivePlan)) {
      return new Response(JSON.stringify({ error: "Upgrade required to invite team members." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const defaultSeatLimits: Record<string, number> = {
      professional: 5,
      business: 15,
    };
    const seatLimit =
      typeof subscription?.included_field_seats === "number"
        ? subscription.included_field_seats
        : defaultSeatLimits[effectivePlan] ?? 0;

    const { count: teamCount, error: teamCountError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("employer_id", user.id);

    if (teamCountError) {
      return new Response(JSON.stringify({ error: "Could not verify team seat usage." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: pendingCount, error: pendingCountError } = await admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("employer_id", user.id)
      .is("accepted_at", null);

    if (pendingCountError) {
      return new Response(JSON.stringify({ error: "Could not verify pending invites." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seatUsage = (teamCount ?? 0) + (pendingCount ?? 0);
    if (seatLimit >= 0 && seatUsage >= seatLimit) {
      return new Response(
        JSON.stringify({
          error: "Field seat limit reached. Upgrade your plan or remove a pending invite.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bodySiteUrl = String(body.siteUrl ?? "").replace(/\/$/, "");
    const siteUrl = (SITE_URL || bodySiteUrl).replace(/\/$/, "");

    const { data: invite, error: inviteError } = await admin
      .from("employee_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("employer_id", user.id)
      .is("accepted_at", null)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = invite.token as string;
    const email = invite.email as string;
    const inviteLink = siteUrl
      ? `${siteUrl}/signup?invite=${encodeURIComponent(token)}`
      : `/signup?invite=${encodeURIComponent(token)}`;
    const loginLink = siteUrl
      ? `${siteUrl}/login?invite=${encodeURIComponent(token)}`
      : `/login?invite=${encodeURIComponent(token)}`;

    const config = readEmailEnvConfig(Deno.env.toObject());
    const templateData = {
      inviteUrl: inviteLink,
      companyName: String(body.companyName ?? "your team"),
      inviterName: String(body.inviterName ?? user.email ?? "Team owner"),
    };
    const rendered = renderEmailTemplate("teamInvite", templateData);
    const prepared = prepareTransactionalEmail({
      templateKey: "teamInvite",
      to: email,
      data: templateData,
    });

    if (!config.sendingEnabled) {
      await insertEmailEvent(admin, {
        userId: user.id,
        templateKey: "teamInvite",
        toEmail: email,
        fromEmail: prepared.from,
        subject: rendered.subject,
        status: "disabled",
        metadata: prepared.metadata,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          inviteLink: loginLink ?? inviteLink,
          emailSent: false,
          disabled: true,
          message: "Email sending is disabled. Share the invite link manually.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sendResult = await sendTransactionalEmail({
      templateKey: "teamInvite",
      to: email,
      data: templateData,
    });

    if (sendResult.ok) {
      const event = await insertEmailEvent(admin, {
        userId: user.id,
        templateKey: "teamInvite",
        toEmail: sendResult.to,
        fromEmail: sendResult.from,
        subject: sendResult.subject,
        status: "sent",
        resendEmailId: sendResult.messageId ?? null,
        sentAt: new Date().toISOString(),
        metadata: sendResult.metadata,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          inviteLink: inviteLink ?? loginLink,
          emailSent: true,
          emailEventId: event?.id ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await insertEmailEvent(admin, {
      userId: user.id,
      templateKey: "teamInvite",
      toEmail: email,
      fromEmail: prepared.from,
      subject: rendered.subject,
      status: "failed",
      errorMessage: sendResult.error ?? "Unable to send invite email.",
      metadata: prepared.metadata,
    });

    const { data: inviteData, error: sendError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: inviteLink ?? loginLink ?? undefined,
        data: {
          invite_token: token,
          employer_id: user.id,
          role: invite.role,
        },
      },
    );

    if (sendError) {
      if (isExistingUserError(sendError.message) && (inviteLink || loginLink)) {
        return new Response(
          JSON.stringify({
            ok: true,
            inviteLink: loginLink ?? inviteLink,
            existingUser: true,
            emailSent: false,
            message: "User already has an account. Share the login invite link.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const event = await insertEmailEvent(admin, {
        userId: user.id,
        templateKey: "teamInvite",
        toEmail: email,
        fromEmail: prepared.from,
        subject: rendered.subject,
        status: "failed",
        errorMessage: sendResult.error ?? sendError.message,
        metadata: { ...prepared.metadata, fallback: "supabase_auth_invite" },
      });
      void event;

      if (inviteLink) {
        return new Response(
          JSON.stringify({
            ok: true,
            inviteLink,
            emailSent: false,
            warning: sendResult.error ?? sendError.message,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: sendResult.error ?? sendError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inviteLink: inviteLink ?? loginLink,
        emailSent: true,
        user: inviteData.user?.id ?? null,
        fallback: "supabase_auth_invite",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
