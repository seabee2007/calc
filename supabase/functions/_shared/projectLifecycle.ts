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

/** Prefer the furthest-along lifecycle stage (avoids stale manual "estimating" blocking sent). */
export function mergeLifecycleStage(
  inferred: ProjectLifecycleKey,
  manual: string | null | undefined,
): ProjectLifecycleKey {
  if (!manual?.trim()) return inferred;
  const normalized = normalizeLifecycleStage(manual);
  if (!PROJECT_LIFECYCLE_TIMELINE.some((t) => t.key === normalized)) return inferred;
  const inferredIdx = lifecycleStepIndex(inferred);
  const manualIdx = lifecycleStepIndex(normalized);
  return manualIdx > inferredIdx ? normalized : inferred;
}

export type PortalProposalRow = {
  status?: string | null;
  public_token?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  deposit_paid_at?: string | null;
  title?: string | null;
  data?: { projectTitle?: string | null } | null;
  project_id?: string | null;
  updated_at?: string | null;
};

const PROPOSAL_STATUS_RANK: Record<string, number> = {
  draft: 1,
  declined: 2,
  sent: 3,
  viewed: 4,
  opened: 4,
  accepted: 5,
  deposit_paid: 6,
  scheduled: 7,
  paid: 8,
};

function proposalRank(status: string | null | undefined): number {
  return PROPOSAL_STATUS_RANK[String(status ?? "draft")] ?? 0;
}

/** Match proposals the same way as the contractor dashboard (project_id, then title). */
export function resolveProposalForProject(
  project: { id: string; name: string },
  proposals: PortalProposalRow[],
): PortalProposalRow | null {
  if (!proposals.length) return null;

  const name = project.name?.trim() ?? "";
  const matches = proposals.filter((p) => {
    if (p.project_id === project.id) return true;
    if (!name) return false;
    const title = String(p.title ?? "").toLowerCase();
    const projectTitle = String(p.data?.projectTitle ?? "").trim();
    return projectTitle === name || title.includes(name.toLowerCase());
  });

  if (!matches.length) return null;

  return [...matches].sort((a, b) => {
    const rankDiff = proposalRank(b.status) - proposalRank(a.status);
    if (rankDiff !== 0) return rankDiff;
    const aTs = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTs = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTs - aTs;
  })[0];
}

export function hasEstimateSignals(input: {
  calculationsCount?: number;
  hasLaborEstimate?: boolean;
  hasCustomEstimateLines?: boolean;
}): boolean {
  return (
    (input.calculationsCount ?? 0) > 0 ||
    Boolean(input.hasLaborEstimate) ||
    Boolean(input.hasCustomEstimateLines)
  );
}

export function customEstimatesHasLines(custom: unknown): boolean {
  if (!custom || typeof custom !== "object") return false;
  const c = custom as Record<string, unknown>;
  for (const key of ["laborItems", "materialItems", "equipmentItems"]) {
    const items = c[key];
    if (Array.isArray(items) && items.length > 0) return true;
  }
  return false;
}

export function inferLifecycleFromSignals(input: {
  proposalStatus?: string | null;
  pourDate?: string | null;
  lifecycleStage?: string | null;
  orderStatus?: string | null;
  concretePlaced: boolean;
  qcComplete: boolean;
  hasSavedEstimates?: boolean;
}): ProjectLifecycleKey {
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
    return mergeLifecycleStage("in_progress", input.lifecycleStage);
  }

  if (["accepted", "deposit_paid", "scheduled"].includes(ps)) {
    return mergeLifecycleStage("accepted", input.lifecycleStage);
  }
  if (["sent", "viewed", "opened", "declined"].includes(ps)) {
    return mergeLifecycleStage("proposal_sent", input.lifecycleStage);
  }

  if (ps === "draft" || input.hasSavedEstimates) {
    return mergeLifecycleStage("estimating", input.lifecycleStage);
  }

  return mergeLifecycleStage("created", input.lifecycleStage);
}
