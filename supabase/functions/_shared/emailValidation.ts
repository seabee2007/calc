export const EMAIL_TEMPLATE_KEYS = [
  "welcome",
  "teamInvite",
  "proposalSent",
  "proposalAccepted",
  "paymentRequest",
  "trialStarted",
  "trialEndingSoon",
  "subscriptionActive",
  "paymentFailed",
  "changeOrderSent",
  "rfiAssigned",
  "farAssigned",
  "qcReminder",
  "scheduleMilestoneReminder",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 320) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function isAllowedTemplateKey(value: unknown): value is EmailTemplateKey {
  return typeof value === "string" && (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function rejectRawEmailBody(body: Record<string, unknown>): string | null {
  const forbidden = ["html", "text", "subject", "from", "replyTo", "reply_to"];
  for (const key of forbidden) {
    if (key in body && body[key] != null) {
      return `Field "${key}" is not allowed. Use templateKey and data only.`;
    }
  }
  return null;
}

export function mapResendWebhookStatus(eventType: string): string | null {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delivery_delayed";
    case "email.complained":
      return "complained";
    case "email.bounced":
      return "bounced";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    default:
      return null;
  }
}

export const SUPPRESSION_STATUSES = new Set(["bounced", "complained"]);

export function isSuppressedRecipientStatus(status: string): boolean {
  return SUPPRESSION_STATUSES.has(status);
}
