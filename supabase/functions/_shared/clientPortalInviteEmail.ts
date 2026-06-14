export const CLIENT_PORTAL_INVITE_SUBJECT = "Your project portal is ready";

export function buildClientPortalInviteMessageTemplate(): string {
  return [
    "Hi {clientName},",
    "",
    "Your project portal is ready. Use the secure button below to review project updates, documents, RFIs, proposals, and shared project information.",
    "",
    "Please keep this link private.",
    "",
    "Thank you,",
    "{companyName}",
  ].join("\n");
}

export function applyClientPortalInvitePlaceholders(
  template: string,
  values: { clientName: string; portalLink: string; companyName: string },
): string {
  return template
    .replaceAll("{clientName}", values.clientName)
    .replaceAll("{portalLink}", values.portalLink)
    .replaceAll("{companyName}", values.companyName);
}
