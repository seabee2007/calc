import type { EmailTemplateKey } from "./emailValidation.ts";
import { buildDefaultChangeOrderEmailText } from "./changeOrderEmail.ts";

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
  heading?: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): RenderedEmail {
  const heading = input.heading ?? input.title;
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;"><tr><td align="center" style="border-radius:8px;background:#0891b2;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:16px;line-height:1.2;">${escapeHtml(input.ctaLabel)}</a></td></tr></table>`
      : "";
  const fallbackHtml = input.ctaUrl
    ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p><p style="margin:8px 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(input.ctaUrl)}" style="color:#0891b2;text-decoration:underline;">${escapeHtml(input.ctaUrl)}</a></p>`
    : "";
  const ctaText =
    input.ctaLabel && input.ctaUrl
      ? `\n\n${input.ctaLabel}: ${input.ctaUrl}\n\nIf the button does not work, copy and paste this link into your browser:\n${input.ctaUrl}\n`
      : "";

  return {
    subject: input.title,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><tr><td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:700;">Arden Project OS</td></tr><tr><td style="padding:24px;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>${input.bodyHtml}${ctaHtml}${fallbackHtml}<p style="margin:24px 0 0;font-size:13px;color:#64748b;">Arden Project OS — estimating, scheduling, and project management for contractors.</p></td></tr></table></td></tr></table></body></html>`,
    text: `${input.title}\n\n${input.bodyText}${ctaText}\nArden Project OS — estimating, scheduling, and project management for contractors.`,
  };
}

function str(data: Record<string, unknown>, key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

function textToEmailParagraphs(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`
        : `<p style="margin:0 0 12px;">&nbsp;</p>`,
    )
    .join("");
}

export function renderEmailTemplate(
  templateKey: EmailTemplateKey,
  data: Record<string, unknown>,
): RenderedEmail {
  switch (templateKey) {
    case "welcome":
      return layout({
        title: "Welcome to Arden Project OS",
        bodyHtml: `<p style="margin:0 0 12px;">Your account is ready. Start building estimates, schedules, and project plans from one workspace.</p>`,
        bodyText: "Your account is ready. Start building estimates, schedules, and project plans from one workspace.",
        ctaLabel: "Open Arden Project OS",
        ctaUrl: str(data, "appUrl"),
      });
    case "teamInvite":
      return layout({
        title: "You have been invited to join a Arden Project OS team",
        bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(str(data, "inviterName", "A team owner"))} invited you to join ${escapeHtml(str(data, "companyName", "their company"))} on Arden Project OS.</p>`,
        bodyText: `${str(data, "inviterName", "A team owner")} invited you to join ${str(data, "companyName", "their company")} on Arden Project OS.`,
        ctaLabel: "Accept invite",
        ctaUrl: str(data, "inviteUrl"),
      });
    case "clientPortalInvite": {
      const emailSubject = str(data, "emailSubject", "Your project portal is ready");
      const messageBody = str(data, "messageBody");
      const companyName = str(data, "companyName", "Your contractor");
      const companyEmail = str(data, "companyEmail");
      const companyPhone = str(data, "companyPhone");
      const portalUrl = str(data, "portalUrl");
      const contactParts = [companyEmail, companyPhone].filter(Boolean);
      const contactSuffix = contactParts.length
        ? ` at ${contactParts.join(" or ")}`
        : "";
      const contactHtml = contactParts.length
        ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Questions? Contact ${escapeHtml(companyName)}${escapeHtml(contactSuffix)}.</p>`
        : "";
      const contactText = contactParts.length
        ? `\n\nQuestions? Contact ${companyName}${contactSuffix}.`
        : "";
      const bodyParagraphs = messageBody
        ? messageBody
            .split("\n")
            .map((line) =>
              line.trim()
                ? `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`
                : `<p style="margin:0 0 12px;">&nbsp;</p>`
            )
            .join("")
        : `<p style="margin:0 0 12px;">Your project portal is ready.</p>`;
      const bodyText = messageBody || "Your project portal is ready.";
      return layout({
        title: emailSubject,
        bodyHtml: `${bodyParagraphs}${contactHtml}`,
        bodyText: `${bodyText}${contactText}`,
        ctaLabel: portalUrl ? "View project portal" : undefined,
        ctaUrl: portalUrl || undefined,
      });
    }
    case "proposalSent": {
      const projectName = str(data, "projectName", str(data, "proposalTitle", "your project"));
      const messageNote = str(data, "messageNote").trim();
      const noteHtml = messageNote
        ? `<p style="margin:12px 0 0;padding:12px;background:#f8fafc;border-radius:8px;">${escapeHtml(messageNote)}</p>`
        : "";
      const noteText = messageNote ? `\n\nNote: ${messageNote}` : "";
      return layout({
        title: `Proposal for ${projectName}`,
        bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(str(data, "senderName", "Your contractor"))} sent you a proposal for <strong>${escapeHtml(projectName)}</strong>.</p><p style="margin:0;">Review the proposal details and respond online.</p>${noteHtml}`,
        bodyText: `${str(data, "senderName", "Your contractor")} sent you a proposal for ${projectName}. Review the proposal details and respond online.${noteText}`,
        ctaLabel: "View proposal",
        ctaUrl: str(data, "proposalUrl"),
      });
    }
    case "proposalFollowUp": {
      const proposalTitle = str(data, "proposalTitle", str(data, "projectName", "your project"));
      const messageNote = str(data, "messageNote").trim();
      const noteHtml = messageNote
        ? `<p style="margin:12px 0 0;padding:12px;background:#f8fafc;border-radius:8px;">${escapeHtml(messageNote)}</p>`
        : "";
      const noteText = messageNote ? `\n\nNote: ${messageNote}` : "";
      return layout({
        title: `Follow up: ${proposalTitle}`,
        bodyHtml: `<p style="margin:0 0 12px;">This is a follow-up regarding your proposal for <strong>${escapeHtml(proposalTitle)}</strong>.</p><p style="margin:0;">When you have a moment, please review the proposal using the link below.</p>${noteHtml}`,
        bodyText: `This is a follow-up regarding your proposal for ${proposalTitle}. When you have a moment, please review the proposal using the link below.${noteText}`,
        ctaLabel: "View proposal",
        ctaUrl: str(data, "proposalUrl"),
      });
    }
    case "depositRequest": {
      const projectName = str(data, "projectName", str(data, "proposalTitle", "your project"));
      const depositAmount = str(data, "depositAmount").trim();
      const messageNote = str(data, "messageNote").trim();
      const amountLine = depositAmount
        ? `<p style="margin:0 0 12px;">The requested deposit amount is <strong>${escapeHtml(depositAmount)}</strong>.</p>`
        : `<p style="margin:0 0 12px;">Please contact us to arrange the deposit for this project.</p>`;
      const noteHtml = messageNote
        ? `<p style="margin:12px 0 0;padding:12px;background:#f8fafc;border-radius:8px;">${escapeHtml(messageNote)}</p>`
        : "";
      const noteText = messageNote ? `\n\nNote: ${messageNote}` : "";
      const proposalUrl = str(data, "proposalUrl");
      return layout({
        title: `Deposit request: ${projectName}`,
        bodyHtml: `<p style="margin:0 0 12px;">Thank you for accepting the proposal for <strong>${escapeHtml(projectName)}</strong>.</p>${amountLine}${noteHtml}`,
        bodyText: `Thank you for accepting the proposal for ${projectName}. ${depositAmount ? `The requested deposit amount is ${depositAmount}.` : 'Please contact us to arrange the deposit for this project.'}${noteText}`,
        ctaLabel: proposalUrl ? "View proposal" : undefined,
        ctaUrl: proposalUrl || undefined,
      });
    }
    case "clientCheckIn": {
      const projectName = str(data, "projectName", str(data, "proposalTitle", "your project"));
      const messageNote = str(data, "messageNote").trim();
      const noteHtml = messageNote
        ? `<p style="margin:12px 0 0;padding:12px;background:#f8fafc;border-radius:8px;">${escapeHtml(messageNote)}</p>`
        : "";
      const noteText = messageNote ? `\n\nNote: ${messageNote}` : "";
      const proposalUrl = str(data, "proposalUrl");
      return layout({
        title: `Checking in: ${projectName}`,
        bodyHtml: `<p style="margin:0 0 12px;">Checking in regarding <strong>${escapeHtml(projectName)}</strong>.</p><p style="margin:0;">Reply if you have questions or need anything from our team.</p>${noteHtml}`,
        bodyText: `Checking in regarding ${projectName}. Reply if you have questions or need anything from our team.${noteText}`,
        ctaLabel: proposalUrl ? "View proposal" : undefined,
        ctaUrl: proposalUrl || undefined,
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
        title: "Your Arden Project OS trial has started",
        bodyHtml: `<p style="margin:0;">Your trial is active. Explore estimating, scheduling, and project tools during your trial period.</p>`,
        bodyText: "Your trial is active. Explore estimating, scheduling, and project tools during your trial period.",
        ctaLabel: "Open Arden Project OS",
        ctaUrl: str(data, "appUrl"),
      });
    case "trialEndingSoon":
      return layout({
        title: "Your Arden Project OS trial ends soon",
        bodyHtml: `<p style="margin:0;">Your trial ends on ${escapeHtml(str(data, "trialEndDate", "soon"))}. Activate your subscription to keep your workspace running.</p>`,
        bodyText: `Your trial ends on ${str(data, "trialEndDate", "soon")}. Activate your subscription to keep your workspace running.`,
        ctaLabel: "Manage subscription",
        ctaUrl: str(data, "billingUrl"),
      });
    case "subscriptionActive":
      return layout({
        title: "Your Arden Project OS subscription is active",
        bodyHtml: `<p style="margin:0;">Thank you. Your subscription is active and your workspace is ready.</p>`,
        bodyText: "Thank you. Your subscription is active and your workspace is ready.",
        ctaLabel: "Open Arden Project OS",
        ctaUrl: str(data, "appUrl"),
      });
    case "paymentFailed":
      return layout({
        title: "Payment failed for your Arden Project OS subscription",
        bodyHtml: `<p style="margin:0;">We could not process your latest payment. Update your billing details to avoid interruption.</p>`,
        bodyText: "We could not process your latest payment. Update your billing details to avoid interruption.",
        ctaLabel: "Update billing",
        ctaUrl: str(data, "billingUrl"),
      });
    case "changeOrderSent": {
      const projectName = str(data, "projectName", "your project");
      const emailSubject =
        str(data, "emailSubject") || `Change Order for ${projectName}`;
      const clientName = str(data, "clientName", "there");
      const changeOrderTitle = str(data, "changeOrderTitle", "Change order");
      const changeOrderNumber = str(data, "changeOrderNumber").trim();
      const changeOrderTotal = str(data, "changeOrderTotal").trim();
      const changeOrderUrl = str(data, "changeOrderUrl");
      const companyName = str(data, "companyName", "Your contractor");
      const messageBody = str(data, "messageBody").trim();

      const changeOrderLabel = changeOrderNumber
        ? `${changeOrderTitle} (${changeOrderNumber})`
        : changeOrderTitle;

      const defaultBodyText = buildDefaultChangeOrderEmailText({
        clientName,
        projectName,
        changeOrderLabel,
        changeOrderTotal,
        changeOrderUrl,
        companyName,
      });

      const bodyText = messageBody || defaultBodyText;
      const bodyHtml = textToEmailParagraphs(bodyText);

      return layout({
        title: emailSubject,
        heading: "Change Order Ready for Review",
        bodyHtml,
        bodyText,
        ctaLabel: changeOrderUrl ? "Review Change Order" : undefined,
        ctaUrl: changeOrderUrl || undefined,
      });
    }
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
        title: "Arden Project OS notification",
        bodyHtml: `<p style="margin:0;">You have a new update in Arden Project OS.</p>`,
        bodyText: "You have a new update in Arden Project OS.",
      });
  }
}
