import {
  PROJECT_LIFECYCLE_TIMELINE,
  customEstimatesHasLines,
  hasEstimateSignals,
  inferLifecycleFromSignals,
  lifecycleStepIndex,
  resolveProposalForProject,
  type PortalProposalRow,
  type ProjectLifecycleKey,
} from "./projectLifecycle.ts";

export type ClientTimelineStepKey = ProjectLifecycleKey;

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

function buildTimeline(currentKey: ProjectLifecycleKey): ClientTimelineStep[] {
  const currentIdx = lifecycleStepIndex(currentKey);
  return PROJECT_LIFECYCLE_TIMELINE.map((step, idx) => {
    let status: ClientTimelineStepStatus = "upcoming";
    if (idx < currentIdx) status = "completed";
    else if (idx === currentIdx) status = "current";
    return { ...step, status };
  });
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
    custom_estimates?: unknown;
    placement_order?: {
      lifecycleStage?: string;
      status?: string;
      summaryLines?: string[];
    } | null;
  };
  calculationsCount?: number;
  hasLaborEstimate?: boolean;
  company?: {
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  } | null;
  proposal?: PortalProposalRow | null;
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
      placementOrder?.lifecycleStage === "job_completed" ||
      placementOrder?.lifecycleStage === "paid" ||
      placementOrder?.status === "completed" ||
      (pourDate && new Date(pourDate) < new Date()),
  );

  const qcComplete = twentyEightDayComplete;
  const hasSavedEstimates = hasEstimateSignals({
    calculationsCount: input.calculationsCount,
    hasLaborEstimate: input.hasLaborEstimate,
    hasCustomEstimateLines: customEstimatesHasLines(input.project.custom_estimates),
  });

  const currentKey = inferLifecycleFromSignals({
    proposalStatus,
    pourDate,
    lifecycleStage: placementOrder?.lifecycleStage ?? null,
    orderStatus: placementOrder?.status ?? null,
    concretePlaced,
    qcComplete,
    hasSavedEstimates,
  });

  const timeline = buildTimeline(currentKey);
  const currentPhase =
    PROJECT_LIFECYCLE_TIMELINE.find((s) => s.key === currentKey)?.label ?? "Created";
  const nextIdx = Math.min(lifecycleStepIndex(currentKey) + 1, PROJECT_LIFECYCLE_TIMELINE.length - 1);
  const nextMilestone = PROJECT_LIFECYCLE_TIMELINE[nextIdx]?.label ?? "Closed";

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
  if (pourDate && currentKey === "in_progress") {
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
