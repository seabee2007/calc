/** Mirrors calc/src/utils/projectWorkflow.ts lifecycle for client portal (edge runtime). */

export type ProjectLifecycleKey =
  | "created"
  | "estimating"
  | "proposal_sent"
  | "accepted"
  | "in_progress"
  | "job_completed"
  | "paid"
  | "closed";

export const PROJECT_LIFECYCLE_TIMELINE: Array<{ key: ProjectLifecycleKey; label: string }> =
  [
    { key: "created", label: "Created" },
    { key: "estimating", label: "Estimating" },
    { key: "proposal_sent", label: "Proposal Sent" },
    { key: "accepted", label: "Accepted" },
    { key: "in_progress", label: "In Progress" },
    { key: "job_completed", label: "Job Completed" },
    { key: "paid", label: "Paid" },
    { key: "closed", label: "Closed" },
  ];

const LEGACY_IN_PROGRESS = new Set([
  "in_progress",
  "mix_approved",
  "placement_scheduled",
  "ordered",
]);

export function normalizeLifecycleStage(stage: string | null | undefined): ProjectLifecycleKey {
  if (!stage) return "created";
  const s = stage.trim().toLowerCase();
  if (s === "closed") return "closed";
  if (s === "paid") return "paid";
  if (s === "job_completed" || s === "placed") return "job_completed";
  if (LEGACY_IN_PROGRESS.has(s)) return "in_progress";
  if (PROJECT_LIFECYCLE_TIMELINE.some((t) => t.key === s)) return s as ProjectLifecycleKey;
  return "created";
}

export function lifecycleStepIndex(key: ProjectLifecycleKey): number {
  return PROJECT_LIFECYCLE_TIMELINE.findIndex((s) => s.key === key);
}

export function inferLifecycleFromSignals(input: {
  proposalStatus?: string | null;
  pourDate?: string | null;
  lifecycleStage?: string | null;
  orderStatus?: string | null;
  concretePlaced: boolean;
  qcComplete: boolean;
}): ProjectLifecycleKey {
  if (input.lifecycleStage?.trim()) {
    return normalizeLifecycleStage(input.lifecycleStage);
  }

  if (input.qcComplete && input.concretePlaced) return "closed";

  const ps = input.proposalStatus ?? "";
  if (ps === "paid") return "paid";
  if (input.concretePlaced) return "job_completed";

  const orderStatus = input.orderStatus ?? "";
  if (orderStatus === "completed") return "job_completed";

  if (
    orderStatus === "ordered" ||
    orderStatus === "scheduled" ||
    orderStatus === "ready_to_call" ||
    input.pourDate
  ) {
    return "in_progress";
  }

  if (["accepted", "deposit_paid", "scheduled"].includes(ps)) return "accepted";
  if (["sent", "viewed", "opened", "declined"].includes(ps)) return "proposal_sent";

  return "created";
}
