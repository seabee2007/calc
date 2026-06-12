import type { EmailTemplateKey } from "./emailValidation.ts";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(input: {
  title: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): RenderedEmail {
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const ctaText =
    input.ctaLabel && input.ctaUrl ? `\n\n${input.ctaLabel}: ${input.ctaUrl}\n` : "";

  return {
    subject: input.title,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><tr><td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:700;">ConcreteCalc</td></tr><tr><td style="padding:24px;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(input.title)}</h1>${input.bodyHtml}${ctaHtml}<p style="margin:24px 0 0;font-size:13px;color:#64748b;">ConcreteCalc — estimating, scheduling, and project management for contractors.</p></td></tr></table></td></tr></table></body></html>`,
    text: `${input.title}\n\n${input.bodyText}${ctaText}\nConcreteCalc — estimating, scheduling, and project management for contractors.`,
  };
}

function str(data: Record<string, unknown>, key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

export function renderEmailTemplate(
  templateKey: EmailTemplateKey,
  data: Record<string, unknown>,
): RenderedEmail {
  switch (templateKey) {
    case "welcome":
      return layout({
        title: "Welcome to ConcreteCalc",
        bodyHtml: `<p style="margin:0 0 12px;">Your account is ready. Start building estimates, schedules, and project plans from one workspace.</p>`,
        bodyText: "Your account is ready. Start building estimates, schedules, and project plans from one workspace.",
        ctaLabel: "Open ConcreteCalc",
        ctaUrl: str(data, "appUrl"),
      });
    case "teamInvite":
      return layout({
        title: "You have been invited to join a ConcreteCalc team",
        bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(str(data, "inviterName", "A team owner"))} invited you to join ${escapeHtml(str(data, "companyName", "their company"))} on ConcreteCalc.</p>`,
        bodyText: `${str(data, "inviterName", "A team owner")} invited you to join ${str(data, "companyName", "their company")} on ConcreteCalc.`,
        ctaLabel: "Accept invite",
        ctaUrl: str(data, "inviteUrl"),
      });
    case "proposalSent": {
      const projectName = str(data, "projectName", str(data, "proposalTitle", "your project"));
      return layout({
        title: `Proposal for ${projectName}`,
        bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(str(data, "senderName", "Your contractor"))} sent you a proposal for <strong>${escapeHtml(projectName)}</strong>.</p><p style="margin:0;">Review the proposal details and respond online.</p>`,
        bodyText: `${str(data, "senderName", "Your contractor")} sent you a proposal for ${projectName}. Review the proposal details and respond online.`,
        ctaLabel: "View proposal",
        ctaUrl: str(data, "proposalUrl"),
      });
    }
    case "proposalAccepted":
      return layout({
        title: `Proposal accepted: ${str(data, "proposalTitle", "Project")}`,
        bodyHtml: `<p style="margin:0;">${escapeHtml(str(data, "clientName", "Your client"))} accepted the proposal for ${escapeHtml(str(data, "proposalTitle", "your project"))}.</p>`,
        bodyText: `${str(data, "clientName", "Your client")} accepted the proposal for ${str(data, "proposalTitle", "your project")}.`,
        ctaLabel: "Open proposal",
        ctaUrl: str(data, "proposalUrl"),
      });
    case "paymentRequest":
      return layout({
        title: `Payment request: ${str(data, "projectName", "Project")}`,
        bodyHtml: `<p style="margin:0;">Please review the payment request for ${escapeHtml(str(data, "projectName", "your project"))}.</p>`,
        bodyText: `Please review the payment request for ${str(data, "projectName", "your project")}.`,
        ctaLabel: "View payment details",
        ctaUrl: str(data, "actionUrl"),
      });
    case "trialStarted":
      return layout({
        title: "Your ConcreteCalc trial has started",
        bodyHtml: `<p style="margin:0;">Your trial is active. Explore estimating, scheduling, and project tools during your trial period.</p>`,
        bodyText: "Your trial is active. Explore estimating, scheduling, and project tools during your trial period.",
        ctaLabel: "Open ConcreteCalc",
        ctaUrl: str(data, "appUrl"),
      });
    case "trialEndingSoon":
      return layout({
        title: "Your ConcreteCalc trial ends soon",
        bodyHtml: `<p style="margin:0;">Your trial ends on ${escapeHtml(str(data, "trialEndDate", "soon"))}. Activate your subscription to keep your workspace running.</p>`,
        bodyText: `Your trial ends on ${str(data, "trialEndDate", "soon")}. Activate your subscription to keep your workspace running.`,
        ctaLabel: "Manage subscription",
        ctaUrl: str(data, "billingUrl"),
      });
    case "subscriptionActive":
      return layout({
        title: "Your ConcreteCalc subscription is active",
        bodyHtml: `<p style="margin:0;">Thank you. Your subscription is active and your workspace is ready.</p>`,
        bodyText: "Thank you. Your subscription is active and your workspace is ready.",
        ctaLabel: "Open ConcreteCalc",
        ctaUrl: str(data, "appUrl"),
      });
    case "paymentFailed":
      return layout({
        title: "Payment failed for your ConcreteCalc subscription",
        bodyHtml: `<p style="margin:0;">We could not process your latest payment. Update your billing details to avoid interruption.</p>`,
        bodyText: "We could not process your latest payment. Update your billing details to avoid interruption.",
        ctaLabel: "Update billing",
        ctaUrl: str(data, "billingUrl"),
      });
    case "changeOrderSent":
      return layout({
        title: `Change order: ${str(data, "changeOrderTitle", "Project update")}`,
        bodyHtml: `<p style="margin:0;">Review the change order for ${escapeHtml(str(data, "projectName", "your project"))}.</p>`,
        bodyText: `Review the change order for ${str(data, "projectName", "your project")}.`,
        ctaLabel: "Review change order",
        ctaUrl: str(data, "changeOrderUrl"),
      });
    case "rfiAssigned":
      return layout({
        title: `RFI assigned: ${str(data, "rfiTitle", "Request for information")}`,
        bodyHtml: `<p style="margin:0;">You have been assigned an RFI on ${escapeHtml(str(data, "projectName", "a project"))}.</p>`,
        bodyText: `You have been assigned an RFI on ${str(data, "projectName", "a project")}.`,
        ctaLabel: "Open RFI",
        ctaUrl: str(data, "rfiUrl"),
      });
    case "farAssigned":
      return layout({
        title: `Field adjustment assigned: ${str(data, "farTitle", "Field update")}`,
        bodyHtml: `<p style="margin:0;">You have been assigned a field adjustment on ${escapeHtml(str(data, "projectName", "a project"))}.</p>`,
        bodyText: `You have been assigned a field adjustment on ${str(data, "projectName", "a project")}.`,
        ctaLabel: "Open field record",
        ctaUrl: str(data, "farUrl"),
      });
    case "qcReminder":
      return layout({
        title: `QC reminder: ${str(data, "qcTitle", "Quality control item")}`,
        bodyHtml: `<p style="margin:0;">A QC item on ${escapeHtml(str(data, "projectName", "your project"))} needs attention.</p>`,
        bodyText: `A QC item on ${str(data, "projectName", "your project")} needs attention.`,
        ctaLabel: "Open QC item",
        ctaUrl: str(data, "qcUrl"),
      });
    case "scheduleMilestoneReminder":
      return layout({
        title: `Schedule milestone: ${str(data, "milestoneTitle", "Upcoming milestone")}`,
        bodyHtml: `<p style="margin:0;">${escapeHtml(str(data, "milestoneTitle", "A schedule milestone"))} on ${escapeHtml(str(data, "projectName", "your project"))} is coming up.</p>`,
        bodyText: `${str(data, "milestoneTitle", "A schedule milestone")} on ${str(data, "projectName", "your project")} is coming up.`,
        ctaLabel: "Open schedule",
        ctaUrl: str(data, "scheduleUrl"),
      });
    default:
      return layout({
        title: "ConcreteCalc notification",
        bodyHtml: `<p style="margin:0;">You have a new update in ConcreteCalc.</p>`,
        bodyText: "You have a new update in ConcreteCalc.",
      });
  }
}
