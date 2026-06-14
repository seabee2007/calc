import {
  readEmailEnvConfig,
  resolveFromEmail,
  resolveOutboundRecipient,
  validateEmailConfigForSend,
  type EmailEnvConfig,
} from "./emailConfig.ts";
import { renderEmailTemplate } from "./emailTemplates.ts";
import type { EmailTemplateKey } from "./emailValidation.ts";

export interface SendTransactionalEmailInput {
  templateKey: EmailTemplateKey;
  to: string;
  cc?: string[];
  bcc?: string[];
  data?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
}

export interface SendTransactionalEmailResult {
  ok: boolean;
  messageId?: string;
  skipped?: boolean;
  disabled?: boolean;
  error?: string;
  to: string;
  subject: string;
  from: string;
  metadata: Record<string, unknown>;
}

export function prepareTransactionalEmail(
  input: SendTransactionalEmailInput,
): SendTransactionalEmailResult | { ok: false; error: string; disabled?: boolean; skipped?: boolean } {
  const config = readEmailEnvConfig(input.env ?? Deno.env.toObject());
  const rendered = renderEmailTemplate(input.templateKey, input.data ?? {});
  const from = resolveFromEmail(input.templateKey, config);
  const { to, metadata } = resolveOutboundRecipient(input.to, config);

  if (!config.sendingEnabled) {
    return {
      ok: false,
      disabled: true,
      skipped: true,
      error: "Email sending is disabled.",
      to,
      subject: rendered.subject,
      from,
      metadata,
    };
  }

  const validation = validateEmailConfigForSend(config);
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }

  return {
    ok: true,
    to,
    subject: rendered.subject,
    from,
    metadata,
    messageId: undefined,
  };
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const config = readEmailEnvConfig(input.env ?? Deno.env.toObject());
  const prepared = prepareTransactionalEmail(input);

  if (!prepared.ok) {
    return {
      ok: false,
      disabled: "disabled" in prepared ? prepared.disabled : undefined,
      skipped: "skipped" in prepared ? prepared.skipped : undefined,
      error: prepared.error,
      to: "to" in prepared ? prepared.to : input.to.trim(),
      subject: "subject" in prepared ? prepared.subject : "",
      from: "from" in prepared ? prepared.from : config.fromEmail,
      metadata: "metadata" in prepared ? prepared.metadata : {},
    };
  }

  const rendered = renderEmailTemplate(input.templateKey, input.data ?? {});

  try {
    const payload: Record<string, unknown> = {
      from: prepared.from,
      to: [prepared.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      reply_to: config.replyTo || undefined,
    };

    if (!config.testMode) {
      if (input.cc?.length) payload.cc = input.cc;
      if (input.bcc?.length) payload.bcc = input.bcc;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof body?.message === "string"
          ? body.message
          : typeof body?.error === "string"
            ? body.error
            : "Unable to send email right now.";
      return {
        ok: false,
        error: message,
        to: prepared.to,
        subject: rendered.subject,
        from: prepared.from,
        metadata: prepared.metadata,
      };
    }

    return {
      ok: true,
      messageId: typeof body?.id === "string" ? body.id : undefined,
      to: prepared.to,
      subject: rendered.subject,
      from: prepared.from,
      metadata: prepared.metadata,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to send email right now.",
      to: prepared.to,
      subject: rendered.subject,
      from: prepared.from,
      metadata: prepared.metadata,
    };
  }
}

export function getPublicProposalUrl(siteUrl: string, publicToken: string): string {
  const base = siteUrl.replace(/\/$/, "");
  if (!base) return `/proposal/${publicToken}`;
  return `${base}/proposal/${publicToken}`;
}

export function getPublicClientPortalUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/$/, "");
  if (!base) return `/client/project/${token}`;
  return `${base}/client/project/${token}`;
}

export type { EmailEnvConfig };
