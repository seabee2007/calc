import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { readEmailEnvConfig } from "../_shared/emailConfig.ts";
import {
  findLatestSuppressedRecipient,
  insertEmailEvent,
  updateEmailEvent,
} from "../_shared/emailEvents.ts";
import {
  isAllowedTemplateKey,
  isValidEmailAddress,
  rejectRawEmailBody,
} from "../_shared/emailValidation.ts";
import { renderEmailTemplate } from "../_shared/emailTemplates.ts";
import {
  getPublicProposalUrl,
  prepareTransactionalEmail,
  sendTransactionalEmail,
} from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

interface RequestBody {
  templateKey?: string;
  to?: string;
  data?: Record<string, unknown>;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureProposalPublicToken(
  admin: ReturnType<typeof createClient>,
  proposalId: string,
  userId: string,
): Promise<{ publicToken: string; projectId: string | null; title: string; data: Record<string, unknown> } | null> {
  const { data, error } = await admin
    .from("proposals")
    .select("id, public_token, project_id, title, data, user_id")
    .eq("id", proposalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  let publicToken = String(data.public_token ?? "").trim();
  if (!publicToken) {
    const { data: updated, error: updateError } = await admin
      .from("proposals")
      .update({ public_token: crypto.randomUUID() })
      .eq("id", proposalId)
      .eq("user_id", userId)
      .select("public_token")
      .single();
    if (updateError || !updated) return null;
    publicToken = String(updated.public_token);
  }

  return {
    publicToken,
    projectId: (data.project_id as string | null) ?? null,
    title: String(data.title ?? "Proposal"),
    data: (data.data as Record<string, unknown>) ?? {},
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
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const rawBodyError = rejectRawEmailBody(body as Record<string, unknown>);
    if (rawBodyError) {
      return jsonResponse({ error: rawBodyError }, 400);
    }

    if (!isAllowedTemplateKey(body.templateKey)) {
      return jsonResponse({ error: "Unknown email template." }, 400);
    }

    const recipient = String(body.to ?? "").trim();
    if (!isValidEmailAddress(recipient)) {
      return jsonResponse({ error: "Enter a valid recipient email address." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const config = readEmailEnvConfig(Deno.env.toObject());
    const templateKey = body.templateKey;
    const data = body.data ?? {};

    const suppressed = await findLatestSuppressedRecipient(admin, recipient);
    if (suppressed) {
      return jsonResponse(
        {
          error: `This recipient previously ${suppressed.status}. Update the email address before sending again.`,
        },
        400,
      );
    }

    let proposalId: string | null = null;
    let projectId: string | null = typeof data.projectId === "string" ? data.projectId : null;
    let templateData = { ...data };

    if (templateKey === "proposalSent") {
      proposalId = typeof data.proposalId === "string" ? data.proposalId : null;
      if (!proposalId) {
        return jsonResponse({ error: "proposalId is required." }, 400);
      }

      const proposal = await ensureProposalPublicToken(admin, proposalId, user.id);
      if (!proposal) {
        return jsonResponse({ error: "Proposal not found." }, 404);
      }

      projectId = proposal.projectId;
      const projectTitle =
        typeof proposal.data.projectTitle === "string" && proposal.data.projectTitle.trim()
          ? proposal.data.projectTitle.trim()
          : proposal.title;

      templateData = {
        ...templateData,
        proposalTitle: projectTitle,
        projectName: projectTitle,
        senderName:
          typeof data.senderName === "string"
            ? data.senderName
            : typeof proposal.data.businessName === "string"
              ? proposal.data.businessName
              : "Your contractor",
        proposalUrl: getPublicProposalUrl(config.siteUrl, proposal.publicToken),
      };
    }

    if (templateKey === "teamInvite") {
      const inviteId = typeof data.inviteId === "string" ? data.inviteId : null;
      if (!inviteId) {
        return jsonResponse({ error: "inviteId is required." }, 400);
      }

      const { data: invite, error: inviteError } = await admin
        .from("employee_invites")
        .select("*")
        .eq("id", inviteId)
        .eq("employer_id", user.id)
        .is("accepted_at", null)
        .maybeSingle();

      if (inviteError || !invite) {
        return jsonResponse({ error: "Invite not found." }, 404);
      }

      const token = invite.token as string;
      const inviteUrl = config.siteUrl
        ? `${config.siteUrl}/signup?invite=${encodeURIComponent(token)}`
        : `/signup?invite=${encodeURIComponent(token)}`;

      templateData = {
        ...templateData,
        inviteUrl,
        companyName: typeof data.companyName === "string" ? data.companyName : "your team",
        inviterName: typeof data.inviterName === "string" ? data.inviterName : user.email ?? "Team owner",
      };
    }

    const rendered = renderEmailTemplate(templateKey, templateData);
    const prepared = prepareTransactionalEmail({
      templateKey,
      to: recipient,
      data: templateData,
    });

    const initialStatus = !config.sendingEnabled
      ? "disabled"
      : prepared.ok
        ? "queued"
        : "failed";

    const event = await insertEmailEvent(admin, {
      userId: user.id,
      projectId,
      proposalId,
      templateKey,
      toEmail: prepared.ok ? prepared.to : recipient,
      fromEmail: prepared.from,
      subject: rendered.subject,
      status: initialStatus,
      errorMessage: prepared.ok ? null : prepared.error ?? null,
      metadata: prepared.metadata,
    });

    if (!config.sendingEnabled) {
      return jsonResponse({
        ok: true,
        skipped: true,
        disabled: true,
        message: "Email sending is disabled.",
        emailEventId: event?.id ?? null,
      });
    }

    if (!prepared.ok) {
      return jsonResponse({ error: prepared.error ?? "Unable to send email." }, 500);
    }

    const sendResult = await sendTransactionalEmail({
      templateKey,
      to: recipient,
      data: templateData,
    });

    if (!sendResult.ok) {
      if (event?.id) {
        await updateEmailEvent(admin, event.id, {
          status: "failed",
          error_message: sendResult.error ?? "Unable to send email.",
        });
      }
      return jsonResponse(
        { error: sendResult.error ?? "Unable to send email right now." },
        502,
      );
    }

    if (event?.id) {
      await updateEmailEvent(admin, event.id, {
        status: "sent",
        resend_email_id: sendResult.messageId ?? null,
        sent_at: new Date().toISOString(),
        metadata: { ...prepared.metadata, ...(sendResult.metadata ?? {}) },
      });
    }

    if (templateKey === "proposalSent" && proposalId) {
      const now = new Date().toISOString();
      const { error: proposalUpdateError } = await admin
        .from("proposals")
        .update({ status: "sent", sent_at: now })
        .eq("id", proposalId)
        .eq("user_id", user.id);

      if (proposalUpdateError) {
        return jsonResponse(
          {
            error: "Email sent, but proposal status could not be updated. Contact support.",
            emailEventId: event?.id ?? null,
            resendEmailId: sendResult.messageId ?? null,
          },
          500,
        );
      }
    }

    return jsonResponse({
      ok: true,
      emailEventId: event?.id ?? null,
      resendEmailId: sendResult.messageId ?? null,
      to: sendResult.to,
      testMode: Boolean(prepared.metadata?.testMode),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
