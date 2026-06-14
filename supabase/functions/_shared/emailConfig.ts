export interface EmailEnvConfig {
  resendApiKey: string;
  fromEmail: string;
  replyTo: string;
  proposalsFromEmail: string;
  notificationsFromEmail: string;
  sendingEnabled: boolean;
  testMode: boolean;
  testRecipient: string;
  siteUrl: string;
  webhookSecret: string;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function readEmailEnvConfig(env: Record<string, string | undefined>): EmailEnvConfig {
  return {
    resendApiKey: env.RESEND_API_KEY?.trim() ?? "",
    fromEmail: env.RESEND_FROM_EMAIL?.trim() ?? "",
    replyTo: env.RESEND_REPLY_TO?.trim() ?? "",
    proposalsFromEmail:
      env.RESEND_PROPOSALS_FROM_EMAIL?.trim() || env.RESEND_FROM_EMAIL?.trim() || "",
    notificationsFromEmail:
      env.RESEND_NOTIFICATIONS_FROM_EMAIL?.trim() || env.RESEND_FROM_EMAIL?.trim() || "",
    sendingEnabled: parseBoolean(env.EMAIL_SENDING_ENABLED, true),
    testMode: parseBoolean(env.EMAIL_TEST_MODE, false),
    testRecipient: env.EMAIL_TEST_RECIPIENT?.trim() ?? "",
    siteUrl: (env.SITE_URL ?? env.PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
    webhookSecret: env.RESEND_WEBHOOK_SECRET?.trim() ?? "",
  };
}

export function resolveOutboundRecipient(
  intendedRecipient: string,
  config: Pick<EmailEnvConfig, "testMode" | "testRecipient">,
): { to: string; metadata: Record<string, unknown> } {
  const trimmed = intendedRecipient.trim();
  if (config.testMode && config.testRecipient) {
    return {
      to: config.testRecipient,
      metadata: { originalTo: trimmed, testMode: true },
    };
  }
  return { to: trimmed, metadata: {} };
}

export function resolveFromEmail(
  templateKey: string,
  config: Pick<EmailEnvConfig, "fromEmail" | "proposalsFromEmail" | "notificationsFromEmail">,
): string {
  if (
    templateKey === "proposalSent" ||
    templateKey === "proposalFollowUp" ||
    templateKey === "depositRequest" ||
    templateKey === "clientCheckIn" ||
    templateKey === "proposalAccepted" ||
    templateKey === "clientPortalInvite" ||
    templateKey === "changeOrderSent"
  ) {
    return config.proposalsFromEmail || config.fromEmail;
  }
  if (
    templateKey === "paymentRequest" ||
    templateKey === "trialStarted" ||
    templateKey === "trialEndingSoon" ||
    templateKey === "subscriptionActive" ||
    templateKey === "paymentFailed"
  ) {
    return config.notificationsFromEmail || config.fromEmail;
  }
  return config.fromEmail;
}

export function validateEmailConfigForSend(
  config: EmailEnvConfig,
): { ok: true } | { ok: false; message: string } {
  if (!config.sendingEnabled) {
    return { ok: false, message: "Email sending is disabled." };
  }
  if (!config.resendApiKey) {
    return { ok: false, message: "Email provider is not configured." };
  }
  if (!config.fromEmail) {
    return { ok: false, message: "Sender email is not configured." };
  }
  if (config.testMode && !config.testRecipient) {
    return { ok: false, message: "Test mode is enabled but no test recipient is configured." };
  }
  return { ok: true };
}
