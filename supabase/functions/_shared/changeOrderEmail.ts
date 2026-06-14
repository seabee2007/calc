export interface ChangeOrderEmailPayload {
  emailSubject?: string;
  projectName?: string;
  changeOrderTitle?: string;
  changeOrderTotal?: string;
  changeOrderUrl?: string;
  messageBody?: string;
}

export function buildDefaultChangeOrderEmailText(input: {
  clientName: string;
  projectName: string;
  changeOrderLabel: string;
  changeOrderTotal: string;
  changeOrderUrl: string;
  companyName: string;
}): string {
  const lines = [
    `Hi ${input.clientName},`,
    "",
    "A change order is ready for your review.",
    "",
    "Project:",
    input.projectName,
    "",
    "Change Order:",
    input.changeOrderLabel,
  ];

  if (input.changeOrderTotal.trim()) {
    lines.push("", "Amount:", input.changeOrderTotal);
  }

  if (input.changeOrderUrl.trim()) {
    lines.push("", "Review and respond here:", input.changeOrderUrl);
  }

  lines.push(
    "",
    "Please review the change order and approve or decline it using the secure link.",
    "",
    "Thank you,",
    input.companyName,
  );

  return lines.join("\n");
}

export function validateChangeOrderSentPayload(
  data: Record<string, unknown>,
): string | null {
  const subject =
    typeof data.emailSubject === "string" ? data.emailSubject.trim() : "";
  if (!subject) {
    return "Missing email subject.";
  }

  const changeOrderUrl =
    typeof data.changeOrderUrl === "string" ? data.changeOrderUrl.trim() : "";
  if (!changeOrderUrl || !/^https?:\/\//i.test(changeOrderUrl)) {
    return "Missing change order review link.";
  }

  const projectName =
    typeof data.projectName === "string" ? data.projectName.trim() : "";
  if (!projectName) {
    return "Missing project name.";
  }

  const changeOrderTitle =
    typeof data.changeOrderTitle === "string" ? data.changeOrderTitle.trim() : "";
  if (!changeOrderTitle) {
    return "Missing change order title.";
  }

  const changeOrderTotal =
    typeof data.changeOrderTotal === "string" ? data.changeOrderTotal.trim() : "";
  if (!changeOrderTotal) {
    return "Missing change order total.";
  }

  return null;
}
