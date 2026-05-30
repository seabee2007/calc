export type ClientTimelineStepKey =
  | "created"
  | "proposal_sent"
  | "accepted"
  | "placement_scheduled"
  | "ordered"
  | "placed"
  | "completed"
  | "qc_closeout"
  | "closed";

export type ClientTimelineStepStatus = "completed" | "current" | "upcoming";

export interface ClientTimelineStep {
  key: ClientTimelineStepKey;
  label: string;
  status: ClientTimelineStepStatus;
}

export interface ClientPortalDocument {
  label: string;
  url: string;
  type: "proposal" | "invoice" | "qc" | "other";
}

export interface ClientPortalUpdate {
  date: string;
  message: string;
}

export interface ClientPortalSafePayload {
  projectName: string;
  projectStatus: string;
  placementDate: string | null;
  jobsiteLocation: string | null;
  contractorCompany: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
  contractorLogoUrl: string | null;
  timeline: ClientTimelineStep[];
  currentPhase: string;
  nextMilestone: string;
  proposalStatus: string | null;
  paymentStatus: string | null;
  qcSummary: string;
  weatherDelayNotice: string | null;
  documents: ClientPortalDocument[];
  updates: ClientPortalUpdate[];
}

const TIMELINE_ORDER: Array<{ key: ClientTimelineStepKey; label: string }> = [
  { key: "created", label: "Created" },
  { key: "proposal_sent", label: "Proposal Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "placement_scheduled", label: "Placement Scheduled" },
  { key: "ordered", label: "Ready Mix Ordered" },
  { key: "placed", label: "Concrete Placed" },
  { key: "completed", label: "Completed" },
  { key: "qc_closeout", label: "QC Closeout" },
  { key: "closed", label: "Closed" },
];

function stepIndex(key: ClientTimelineStepKey): number {
  return TIMELINE_ORDER.findIndex((s) => s.key === key);
}

function formatIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function proposalStatusLabel(status: string | null | undefined): string | null {
  if (!status || status === "draft") return null;
  const map: Record<string, string> = {
    sent: "Proposal sent",
    viewed: "Proposal viewed",
    opened: "Proposal opened",
    accepted: "Proposal accepted",
    declined: "Proposal declined",
    deposit_paid: "Deposit received",
    scheduled: "Scheduled",
    paid: "Paid in full",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function paymentStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  if (status === "deposit_paid" || status === "paid") return "Deposit received";
  if (status === "accepted") return "Accepted — deposit pending";
  if (status === "sent" || status === "viewed" || status === "opened") {
    return "Awaiting client response";
  }
  if (status === "declined") return "Proposal declined";
  return null;
}

function inferCurrentStepKey(input: {
  proposalStatus?: string | null;
  pourDate?: string | null;
  lifecycleStage?: string | null;
  orderStatus?: string | null;
  qcComplete: boolean;
  concretePlaced: boolean;
}): ClientTimelineStepKey {
  const lifecycle = input.lifecycleStage ?? "";
  if (lifecycle === "closed") return "closed";
  if (input.qcComplete && input.concretePlaced) return "closed";
  if (input.concretePlaced && !input.qcComplete) return "qc_closeout";
  if (lifecycle === "paid" || input.orderStatus === "completed") return "completed";
  if (input.concretePlaced || lifecycle === "placed") return "placed";
  if (lifecycle === "ordered" || input.orderStatus === "ordered") return "ordered";
  if (input.pourDate || lifecycle === "placement_scheduled") return "placement_scheduled";

  const ps = input.proposalStatus ?? "";
  if (["accepted", "deposit_paid", "scheduled", "paid"].includes(ps)) return "accepted";
  if (["sent", "viewed", "opened", "declined"].includes(ps)) return "proposal_sent";

  return "created";
}

function buildTimeline(currentKey: ClientTimelineStepKey): ClientTimelineStep[] {
  const currentIdx = stepIndex(currentKey);
  return TIMELINE_ORDER.map((step, idx) => {
    let status: ClientTimelineStepStatus = "upcoming";
    if (idx < currentIdx) status = "completed";
    else if (idx === currentIdx) status = "current";
    return { ...step, status };
  });
}

function buildQcSummary(input: {
  concretePlaced: boolean;
  qcComplete: boolean;
  twentyEightDayComplete: boolean;
}): string {
  if (!input.concretePlaced) {
    return "QC testing will begin after concrete placement.";
  }
  if (input.qcComplete || input.twentyEightDayComplete) {
    return "QC closeout complete.";
  }
  return "Concrete placed. Final 28-day strength result pending.";
}

function detectWeatherDelay(summaryLines: string[] | undefined): string | null {
  if (!summaryLines?.length) return null;
  for (const line of summaryLines) {
    if (/delay|postpon|reschedule|weather hold/i.test(line)) {
      return line.trim();
    }
  }
  return null;
}

export function buildClientPortalSafePayload(input: {
  origin: string;
  project: {
    name: string;
    pour_date?: string | null;
    jobsite_city?: string | null;
    jobsite_state?: string | null;
    created_at?: string | null;
    placement_order?: {
      lifecycleStage?: string;
      status?: string;
      summaryLines?: string[];
    } | null;
  };
  company?: {
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  } | null;
  proposal?: {
    status?: string | null;
    public_token?: string | null;
    sent_at?: string | null;
    accepted_at?: string | null;
    deposit_paid_at?: string | null;
  } | null;
  qcRecords?: Array<{
    record_type?: string | null;
    record_data?: Record<string, unknown> | null;
    test_age_days?: number | null;
  }>;
}): ClientPortalSafePayload {
  const placementOrder = input.project.placement_order ?? undefined;
  const proposalStatus = input.proposal?.status ?? null;
  const pourDate = input.project.pour_date ?? null;

  const twentyEightDayComplete = (input.qcRecords ?? []).some((r) => {
    if (r.record_type === "break_test") {
      const age = r.test_age_days ??
        (typeof r.record_data?.testAgeDays === "number" ? r.record_data.testAgeDays : null);
      return age === 28;
    }
    return false;
  });

  const concretePlaced = Boolean(
    placementOrder?.lifecycleStage === "placed" ||
      placementOrder?.lifecycleStage === "paid" ||
      placementOrder?.status === "completed" ||
      (pourDate && new Date(pourDate) < new Date()),
  );

  const qcComplete = twentyEightDayComplete;
  const currentKey = inferCurrentStepKey({
    proposalStatus,
    pourDate,
    lifecycleStage: placementOrder?.lifecycleStage ?? null,
    orderStatus: placementOrder?.status ?? null,
    qcComplete,
    concretePlaced,
  });

  const timeline = buildTimeline(currentKey);
  const currentPhase = TIMELINE_ORDER.find((s) => s.key === currentKey)?.label ?? "Created";
  const nextIdx = Math.min(stepIndex(currentKey) + 1, TIMELINE_ORDER.length - 1);
  const nextMilestone = TIMELINE_ORDER[nextIdx]?.label ?? "Closed";

  const jobsiteLocation = [input.project.jobsite_city, input.project.jobsite_state]
    .filter(Boolean)
    .join(", ") || null;

  const documents: ClientPortalDocument[] = [];
  if (input.proposal?.public_token && proposalStatus && proposalStatus !== "draft") {
    documents.push({
      label: "View proposal",
      url: `${input.origin}/proposal/${input.proposal.public_token}`,
      type: "proposal",
    });
  }

  const updates: ClientPortalUpdate[] = [];
  if (input.project.created_at) {
    updates.push({ date: input.project.created_at, message: "Project created." });
  }
  if (input.proposal?.sent_at) {
    updates.push({ date: input.proposal.sent_at, message: "Proposal sent for review." });
  }
  if (input.proposal?.accepted_at) {
    updates.push({ date: input.proposal.accepted_at, message: "Proposal accepted." });
  }
  if (input.proposal?.deposit_paid_at) {
    updates.push({ date: input.proposal.deposit_paid_at, message: "Deposit received." });
  }
  if (pourDate) {
    updates.push({
      date: pourDate,
      message: `Placement scheduled for ${formatDisplayDate(pourDate) ?? "upcoming date"}.`,
    });
  }
  if (concretePlaced) {
    updates.push({
      date: pourDate ?? new Date().toISOString(),
      message: "Concrete placement completed.",
    });
  }

  return {
    projectName: input.project.name,
    projectStatus: currentPhase,
    placementDate: formatDisplayDate(pourDate),
    jobsiteLocation,
    contractorCompany: input.company?.company_name?.trim() || null,
    contractorEmail: input.company?.email?.trim() || null,
    contractorPhone: input.company?.phone?.trim() || null,
    contractorLogoUrl: input.company?.logo_url?.trim() || null,
    timeline,
    currentPhase,
    nextMilestone,
    proposalStatus: proposalStatusLabel(proposalStatus),
    paymentStatus: paymentStatusLabel(proposalStatus),
    qcSummary: buildQcSummary({ concretePlaced, qcComplete, twentyEightDayComplete }),
    weatherDelayNotice: detectWeatherDelay(placementOrder?.summaryLines),
    documents,
    updates: updates
      .filter((u) => formatIsoDate(u.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8),
  };
}

export function generatePortalToken(): string {
  const extra = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(extra, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${crypto.randomUUID().replace(/-/g, "")}${hex}`;
}
