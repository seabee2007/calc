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

function stripPortalUrlFromMessageBody(messageBody: string, portalUrl: string): string {
  if (!messageBody || !portalUrl) return messageBody;
  return messageBody
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed === portalUrl || trimmed.includes(portalUrl)) return false;
      if (/^Open your portal:/i.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function layout(input: {
  title: string;
  heading?: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  textLinkMode?: "cta-and-fallback" | "fallback-only";
}): RenderedEmail {
  const heading = input.heading ?? input.title;
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:24px 0;"><tr><td align="center" style="border-radius:10px;background:#0891b2;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;width:100%;max-width:100%;box-sizing:border-box;background:#0891b2;color:#ffffff !important;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;font-size:16px;line-height:1.2;text-align:center;">${escapeHtml(input.ctaLabel)}</a></td></tr></table>`
      : "";
  const fallbackHtml = input.ctaUrl
    ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" /><p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">If the button does not work, copy and paste this link into your browser:</p><p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;word-break:break-word;overflow-wrap:anywhere;"><a href="${escapeHtml(input.ctaUrl)}" style="color:#22d3ee;text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(input.ctaUrl)}</a></p>`
    : "";
  const textLinkMode = input.textLinkMode ?? "cta-and-fallback";
  const ctaText =
    input.ctaLabel && input.ctaUrl
      ? textLinkMode === "fallback-only"
        ? `\n\nIf the button does not work, copy and paste this link into your browser:\n${input.ctaUrl}\n`
        : `\n\n${input.ctaLabel}: ${input.ctaUrl}\n\nIf the button does not work, copy and paste this link into your browser:\n${input.ctaUrl}\n`
      : "";

  return {
    subject: input.title,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><tr><td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:700;">Arden Project OS</td></tr><tr><td style="padding:24px;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>${input.bodyHtml}${ctaHtml}${fallbackHtml}<p style="margin:24px 0 0;font-size:13px;color:#64748b;">Arden Project OS — estimating, scheduling, and project control for contractors.</p></td></tr></table></td></tr></table></body></html>`,
    text: `${input.title}\n\n${input.bodyText}${ctaText}\nArden Project OS — estimating, scheduling, and project control for contractors.`,
  };
}

function featureListHtml(features: string[]): string {
  return `<ul style="margin:12px 0 16px;padding-left:20px;">${
    features.map((feature) =>
      `<li style="margin:0 0 8px;">${escapeHtml(feature)}</li>`
    ).join("")
  }</ul>`;
}

function featureListText(features: string[]): string {
  return features.map((feature) => `- ${feature}`).join("\n");
}

function subscriptionWelcomeTemplate(input: {
  planLabel: string;
  features: string[];
  usageSummary: string;
  data: Record<string, unknown>;
}): RenderedEmail {
  const firstName = str(input.data, "firstName").trim();
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
  const greetingText = firstName ? `Hi ${firstName},` : "Hi there,";
  const billingUrl = str(input.data, "billingUrl");
  const dashboardUrl = str(input.data, "dashboardUrl");
  const title = `Welcome to Arden Project OS ${input.planLabel}`;

  const billingLinkHtml = billingUrl
    ? `<p style="margin:16px 0 0;">Manage billing and usage anytime from <a href="${escapeHtml(billingUrl)}" style="color:#0891b2;text-decoration:underline;">Settings → Billing</a>.</p>`
    : "";
  const billingLinkText = billingUrl
    ? `\n\nManage billing and usage anytime from Settings → Billing: ${billingUrl}`
    : "";

  return layout({
    title,
    heading: title,
    bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p><p style="margin:0 0 12px;">Thank you for upgrading to <strong>${escapeHtml(input.planLabel)}</strong>. Your workspace is ready with the features and usage limits below.</p>${featureListHtml(input.features)}<p style="margin:0 0 12px;"><strong>Usage &amp; billing:</strong> ${escapeHtml(input.usageSummary)}</p>${billingLinkHtml}`,
    bodyText: `${greetingText}\n\nThank you for upgrading to ${input.planLabel}. Your workspace is ready with the features and usage limits below.\n\n${featureListText(input.features)}\n\nUsage & billing: ${input.usageSummary}${billingLinkText}`,
    ctaLabel: dashboardUrl ? "Go to Dashboard" : undefined,
    ctaUrl: dashboardUrl || undefined,
  });
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
      {
        const companyName = str(data, "companyName", "your company");
        const inviterName = str(data, "inviterName").trim();
        const roleLabel = str(data, "roleLabel", "Employee");
        const expiresAt = str(data, "expiresAt");
        const supportContact = str(data, "supportContact", "your manager");
        const inviterLineHtml = inviterName
          ? `<p style="margin:0 0 12px;">${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(companyName)}</strong> on Arden Project OS.</p>`
          : `<p style="margin:0 0 12px;">You have been invited to join <strong>${escapeHtml(companyName)}</strong> on Arden Project OS.</p>`;
        const inviterLineText = inviterName
          ? `${inviterName} invited you to join ${companyName} on Arden Project OS.`
          : `You have been invited to join ${companyName} on Arden Project OS.`;
        const expiryHtml = expiresAt
          ? `<p style="margin:0 0 12px;">This invitation expires on ${escapeHtml(expiresAt)}.</p>`
          : `<p style="margin:0 0 12px;">This invitation expires in 14 days.</p>`;
        const expiryText = expiresAt
          ? `This invitation expires on ${expiresAt}.`
          : "This invitation expires in 14 days.";
        return layout({
          title: `You’ve been invited to join ${companyName} on Arden Project OS`,
          heading: `Join ${companyName} on Arden Project OS`,
          bodyHtml: `${inviterLineHtml}<p style="margin:0 0 12px;">You have been invited to access assigned project work in Arden Project OS.</p><p style="margin:0 0 12px;"><strong>Assigned role:</strong> ${escapeHtml(roleLabel)}</p>${expiryHtml}<p style="margin:0;">Questions? Contact ${escapeHtml(supportContact)}.</p>`,
          bodyText: `${inviterLineText}\n\nYou have been invited to access assigned project work in Arden Project OS.\n\nAssigned role: ${roleLabel}\n\n${expiryText}\n\nQuestions? Contact ${supportContact}.`,
          ctaLabel: "Accept Invitation",
          ctaUrl: str(data, "inviteUrl"),
          textLinkMode: "fallback-only",
        });
      }
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
      const sanitizedMessageBody = portalUrl
        ? stripPortalUrlFromMessageBody(messageBody, portalUrl)
        : messageBody;
      const bodyParagraphs = sanitizedMessageBody
        ? sanitizedMessageBody
            .split("\n")
            .map((line) =>
              line.trim()
                ? `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`
                : `<p style="margin:0 0 12px;">&nbsp;</p>`
            )
            .join("")
        : `<p style="margin:0 0 12px;">Your project portal is ready. Use the secure button below to review project updates, documents, RFIs, proposals, and shared project information.</p>`;
      const bodyText =
        sanitizedMessageBody ||
        "Your project portal is ready. Use the secure button below to review project updates, documents, RFIs, proposals, and shared project information.";
      return layout({
        title: emailSubject,
        bodyHtml: `${bodyParagraphs}${contactHtml}`,
        bodyText: `${bodyText}${contactText}`,
        ctaLabel: portalUrl ? "View project portal" : undefined,
        ctaUrl: portalUrl || undefined,
        textLinkMode: "fallback-only",
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
    case "subscriptionWelcomeStarter":
      return subscriptionWelcomeTemplate({
        planLabel: "Starter",
        features: [
          "Up to 3 active projects",
          "1 field seat included",
          "Employee field portal for assigned project work",
          "Starter monthly usage limits",
          "Quick estimating tools",
          "Basic proposal and project workflows",
          "Arden calculators and core resources",
        ],
        usageSummary: str(
          data,
          "usageSummary",
          "Starter includes 100 project emails, 250 weather lookups, and other monthly usage limits.",
        ),
        data,
      });
    case "subscriptionWelcomeProfessional":
      return subscriptionWelcomeTemplate({
        planLabel: "Professional",
        features: [
          "Up to 10 active projects",
          "Up to 5 field seats",
          "Expanded field capacity and project controls",
          "Detailed estimating and project controls",
          "Client portal access",
          "RFIs, FARs, QC, and change orders",
          "Field workflows",
          "Logic network, CPM, and Gantt scheduling",
        ],
        usageSummary: str(
          data,
          "usageSummary",
          "Professional includes 500 project emails, 1,000 weather lookups, and higher monthly usage limits.",
        ),
        data,
      });
    case "subscriptionWelcomeBusiness":
      return subscriptionWelcomeTemplate({
        planLabel: "Business",
        features: [
          "Unlimited active projects",
          "Up to 15 field seats",
          "Business monthly usage limits",
          "Accounting and tax exports",
          "Financial dashboards",
          "Advanced project and team management",
          "Highest standard usage limits",
        ],
        usageSummary: str(
          data,
          "usageSummary",
          "Business includes 2,000 project emails, 5,000 weather lookups, and the highest standard monthly usage limits.",
        ),
        data,
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
