import type { Project, Calculation } from '../types';
import type { PlacementOrder, PlacementOrderStatus } from '../types/placementOrder';
import { PLACEMENT_ORDER_STATUS_LABELS } from '../types/placementOrder';
import { MITIGATION_OPTIONS } from './pourMitigations';
import {
  buildReadinessIssues,
  isProjectClosedOut,
  resolveProjectWorkflow,
  type ProjectNextAction,
  type ProjectWorkflowStage,
} from './projectWorkflow';
import type { TrackedProposalRow } from '../types/proposalTracking';
import {
  buildProposalDashboardMetrics,
  type ProposalDashboardMetrics,
} from './proposalKpis';
import { getProjectFolder, summarizeQcBreakAlerts } from './projectFolders';

export type OpsRiskLevel = 'low' | 'moderate' | 'high' | 'unknown';
export type TimelineStatus = 'on_schedule' | 'at_risk' | 'delayed' | 'pending';

export interface TimelineEvent {
  id: string;
  timeLabel: string;
  sortMinutes: number;
  label: string;
  status: TimelineStatus;
}

export interface DispatchTruckRow {
  id: string;
  truckNumber: string;
  status: 'scheduled' | 'loading' | 'en_route' | 'on_site' | 'washing_out';
  etaLabel: string;
}

export interface DashboardProjectCard {
  id: string;
  name: string;
  volumeYd: number;
  remainingCyLabel: string;
  nextPourLabel: string;
  mixLabel: string;
  statusLabel: string;
  orderStatus: PlacementOrderStatus | null;
  batchPlantName: string;
  readinessScore: number;
  qcCount: number;
  hasJobsite: boolean;
  pourDateIso?: string;
  workflowStage: ProjectWorkflowStage;
  workflowLabel: string;
  nextAction: ProjectNextAction;
  healthScore: number;
}

export interface DeliveryScheduleSnapshot {
  projectName: string;
  truckIndex: number;
  truckTotal: number;
  etaLabel: string;
  spacingMin: number;
  plantName: string;
}

export interface UpcomingPlacementRow {
  projectId: string;
  projectName: string;
  pourDateLabel: string;
  sortTime: number;
  volumeYd: number;
  batchPlantName: string;
  nextLoadLabel: string;
  timeline: TimelineEvent[];
}

export interface SmartPourTip {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface OperationsSnapshot {
  todayPourCount: number;
  upcomingPourCount: number;
  totalCyScheduled: number;
  activeProjectCount: number;
  weatherRisk: OpsRiskLevel;
  weatherRiskLabel: string;
  qcTestsDue: number;
  qcTestsOverdue: number;
  deliveryStatusLabel: string;
  pumpScheduledToday: boolean;
  nextTruckEtaLabel: string;
  globalReadiness: number;
  projects: DashboardProjectCard[];
  todayPours: DashboardProjectCard[];
  /** True when at least one project has a pour date of today */
  hasPlacementsToday: boolean;
  timeline: TimelineEvent[];
  dispatchTrucks: DispatchTruckRow[];
  heatRisk: OpsRiskLevel;
  rainRisk: OpsRiskLevel;
  windRisk: OpsRiskLevel;
  evaporationRisk: OpsRiskLevel;
  recommendedStartWindow: string;
  mitigations: string[];
  smartTips: SmartPourTip[];
  deliverySchedule: DeliveryScheduleSnapshot | null;
  proposalMetrics: ProposalDashboardMetrics;
  upcomingPlacements: UpcomingPlacementRow[];
  proposalsSentCount: number;
  globalHealthScore: number;
  primaryReadinessIssues: { message: string; fixPath: string; fixSearch?: string }[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function parsePourDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPourDateLabel(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Calendar date for ops displays, e.g. "31 May 2026". */
export function formatProfessionalCalendarDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${day} ${month} ${d.getFullYear()}`;
}

export function formatPourTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function calendarDaysUntil(target: Date, from: Date): number {
  const fromDay = startOfDay(from);
  const targetDay = startOfDay(target);
  return Math.round((targetDay.getTime() - fromDay.getTime()) / 86400000);
}

export function formatNextPlacementLeadLabel(daysUntil: number): string {
  if (daysUntil <= 0) return 'Next placement today';
  if (daysUntil === 1) return 'Next placement tomorrow';
  return `Next placement in ${daysUntil} days`;
}

export function resolveNextUpcomingPlacement(
  upcoming: UpcomingPlacementRow[],
  hasPlacementsToday: boolean,
): UpcomingPlacementRow | null {
  if (hasPlacementsToday || upcoming.length === 0) return null;
  return upcoming[0];
}

function calculationVolumeYd(calc: Calculation): number {
  const v = calc.result?.volume ?? 0;
  if (v <= 0) return 0;
  return v;
}

function projectVolumeYd(project: Project): number {
  return (project.calculations ?? []).reduce(
    (sum, c) => sum + calculationVolumeYd(c),
    0,
  );
}

function parseSummaryNumber(lines: string[] | undefined, pattern: RegExp): number | null {
  if (!lines?.length) return null;
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

function parseStartTimeFromSummary(lines: string[] | undefined): string {
  if (!lines?.length) return '07:00';
  for (const line of lines) {
    const m = line.match(/Requested Start Time:\s*(.+)/i);
    if (m) {
      const inner = m[1].match(/\((\d{1,2}:\d{2})\)/);
      if (inner) return inner[1];
      if (/^\d{1,2}:\d{2}/.test(m[1].trim())) return m[1].trim().slice(0, 5);
    }
  }
  return '07:00';
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h)) return 7 * 60;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatMilitaryTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildDeliverySchedule(
  order: PlacementOrder | undefined,
  pourDate: Date | null,
  projectName: string,
  now = new Date(),
): DeliveryScheduleSnapshot | null {
  if (!pourDate || !isSameDay(pourDate, now) || !order) return null;

  const lines = order.summaryLines;
  const truckTotal = Math.max(
    1,
    Math.round(parseSummaryNumber(lines, /Number of Trucks:\s*(\d+)/i) ?? 4),
  );
  const spacingMin =
    parseSummaryNumber(lines, /Truck Spacing[^:]*:\s*(\d+)/i) ?? 20;
  const startMin = timeToMinutes(parseStartTimeFromSummary(lines));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let truckIndex = 1;
  for (let i = 0; i < truckTotal; i++) {
    const truckMin = startMin + i * spacingMin;
    if (nowMin < truckMin + spacingMin) {
      truckIndex = i + 1;
      return {
        projectName,
        truckIndex,
        truckTotal,
        etaLabel: formatMilitaryTime(truckMin),
        spacingMin,
        plantName: order.batchPlantName ?? 'Batch plant TBD',
      };
    }
  }

  return {
    projectName,
    truckIndex: truckTotal,
    truckTotal,
    etaLabel: formatMilitaryTime(startMin + (truckTotal - 1) * spacingMin),
    spacingMin,
    plantName: order.batchPlantName ?? 'Batch plant TBD',
  };
}

export function computeReadinessScore(
  project: Project,
  order?: PlacementOrder,
): { score: number; statusLabel: string } {
  let score = 0;
  if (project.jobsiteAddress?.city || project.jobsiteAddress?.street) score += 12;
  if (project.calculations?.length) score += 18;
  if (project.pourDate) score += 20;
  if (order?.batchPlantName || order?.batchPlantAddress) score += 15;
  if (order?.contact?.phone || order?.contact?.email) score += 10;
  if (order?.summaryLines?.length) score += 10;
  if (order?.status === 'scheduled') score += 15;
  else if (order?.status === 'ordered') score += 10;
  else if (order?.status === 'ready_to_call') score += 5;
  if ((project.qcRecords?.length ?? 0) > 0) score += 10;

  const statusLabel =
    score >= 85
      ? 'READY'
      : score >= 65
        ? 'ALMOST READY'
        : score >= 40
          ? 'IN PROGRESS'
          : 'SETUP NEEDED';

  return { score: Math.min(100, score), statusLabel };
}

export function buildPourTimeline(
  order: PlacementOrder | undefined,
  pourDate: Date | null,
  now = new Date(),
): TimelineEvent[] {
  const lines = order?.summaryLines;
  const startTime = parseStartTimeFromSummary(lines);
  const spacing =
    parseSummaryNumber(lines, /Truck Spacing[^:]*:\s*(\d+)/i) ?? 15;
  const trucks = Math.max(
    1,
    Math.round(
      parseSummaryNumber(lines, /Number of Trucks:\s*(\d+)/i) ??
        parseSummaryNumber(lines, /Trucks:\s*(\d+)/i) ??
        3,
    ),
  );
  const pumpRequired = Boolean(
    lines?.some((l) => /Pump Required:\s*Yes/i.test(l)) ||
      order?.callSheet?.pumpCompany,
  );

  let cursor = timeToMinutes(startTime);
  const events: TimelineEvent[] = [];

  const statusFor = (eventMin: number): TimelineStatus => {
    if (!pourDate || !isSameDay(pourDate, now)) return 'pending';
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (eventMin < nowMin - 20) return 'on_schedule';
    if (eventMin < nowMin - 5) return 'at_risk';
    if (eventMin <= nowMin + 30) return 'pending';
    return 'pending';
  };

  if (pumpRequired) {
    events.push({
      id: 'pump',
      timeLabel: formatClock(cursor - 30),
      sortMinutes: cursor - 30,
      label: 'Pump setup',
      status: statusFor(cursor - 30),
    });
  }

  for (let i = 0; i < trucks; i++) {
    events.push({
      id: `truck-${i}`,
      timeLabel: formatClock(cursor),
      sortMinutes: cursor,
      label: `Truck ${i + 1}`,
      status: statusFor(cursor),
    });
    cursor += spacing;
  }

  events.push({
    id: 'finish',
    timeLabel: formatClock(cursor),
    sortMinutes: cursor,
    label: 'Finish start (est.)',
    status: statusFor(cursor),
  });

  events.push({
    id: 'cure',
    timeLabel: formatClock(cursor + 90),
    sortMinutes: cursor + 90,
    label: 'Cure start (est.)',
    status: statusFor(cursor + 90),
  });

  return events.sort((a, b) => a.sortMinutes - b.sortMinutes);
}

export function buildDispatchTrucks(
  order: PlacementOrder | undefined,
  pourDate: Date | null,
  now = new Date(),
): DispatchTruckRow[] {
  const lines = order?.summaryLines;
  const trucks = Math.max(
    1,
    Math.round(parseSummaryNumber(lines, /Number of Trucks:\s*(\d+)/i) ?? 4),
  );
  const spacing =
    parseSummaryNumber(lines, /Truck Spacing[^:]*:\s*(\d+)/i) ?? 15;
  const startMin = timeToMinutes(parseStartTimeFromSummary(lines));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = pourDate ? isSameDay(pourDate, now) : false;

  const statuses: DispatchTruckRow['status'][] = [
    'loading',
    'en_route',
    'on_site',
    'washing_out',
    'scheduled',
  ];

  return Array.from({ length: Math.min(trucks, 6) }, (_, i) => {
    const truckMin = startMin + i * spacing;
    let status: DispatchTruckRow['status'] = 'scheduled';
    if (isToday) {
      if (nowMin >= truckMin + spacing + 45) status = 'washing_out';
      else if (nowMin >= truckMin + spacing) status = 'on_site';
      else if (nowMin >= truckMin - 5) status = 'en_route';
      else if (nowMin >= truckMin - 25) status = 'loading';
    }
    const etaMin = Math.max(0, truckMin - nowMin);
    return {
      id: `t-${i}`,
      truckNumber: String(12 + i * 3),
      status,
      etaLabel:
        !isToday || etaMin <= 0
          ? formatClock(truckMin)
          : `${etaMin} min`,
    };
  });
}

function orderStatusLabel(status: PlacementOrderStatus | null): string {
  if (!status) return 'NOT ORDERED';
  return PLACEMENT_ORDER_STATUS_LABELS[status].split('—')[0].trim().toUpperCase();
}

function matchProposalForProject(
  project: Project,
  proposals: TrackedProposalRow[],
): TrackedProposalRow | undefined {
  return proposals.find(
    (p) =>
      p.project_id === project.id ||
      p.data?.projectTitle === project.name ||
      p.title.toLowerCase().includes(project.name.toLowerCase()),
  );
}

function summarizeQcAlertsForProjects(
  projects: Project[],
  proposals: TrackedProposalRow[],
  now: Date,
): { qcTestsDue: number; qcTestsOverdue: number } {
  let qcTestsDue = 0;
  let qcTestsOverdue = 0;

  for (const project of projects) {
    const matchedProposal = matchProposalForProject(project, proposals);
    const ctx = {
      hasProposalDraft: Boolean(matchedProposal),
      proposalStatus: matchedProposal?.status,
    };

    if (getProjectFolder(project, ctx) === 'archived') continue;

    const workflow = resolveProjectWorkflow(project, {
      hasProposalDraft: ctx.hasProposalDraft,
      proposalStatus: ctx.proposalStatus,
      windRisk: 'moderate',
      heatRisk: 'moderate',
      readinessScore: 0,
      now,
    });
    const summary = summarizeQcBreakAlerts(project, workflow.stage, ctx, now);
    qcTestsDue += summary.openThisWeek;
    qcTestsOverdue += summary.overdue;
  }

  return { qcTestsDue, qcTestsOverdue };
}

export interface QcDashboardStats {
  qcTestsDue: number;
  qcTestsOverdue: number;
  totalRecords: number;
}

/** QC widget stats — uses all projects (includes QC Closeout jobs excluded from ops queue). */
export function buildQcDashboardStats(
  projects: Project[],
  proposals: TrackedProposalRow[] = [],
  now = new Date(),
): QcDashboardStats {
  const { qcTestsDue, qcTestsOverdue } = summarizeQcAlertsForProjects(
    projects,
    proposals,
    now,
  );
  const totalRecords = projects.reduce(
    (sum, project) =>
      sum + (project.qcRecords?.length ?? 0) + (project.truckTickets?.length ?? 0),
    0,
  );
  return { qcTestsDue, qcTestsOverdue, totalRecords };
}

export function buildSmartPourTips(
  projects: DashboardProjectCard[],
  snapshot: Pick<
    OperationsSnapshot,
    'weatherRisk' | 'heatRisk' | 'windRisk' | 'rainRisk'
  >,
): SmartPourTip[] {
  const tips: SmartPourTip[] = [];

  if (snapshot.heatRisk === 'high') {
    tips.push({
      id: 'heat',
      severity: 'warning',
      message:
        'Delay placement or start 0300–0600 — heat index elevates set acceleration. Recommend retarder and chilled water.',
    });
  }
  if (snapshot.windRisk === 'moderate' || snapshot.windRisk === 'high') {
    tips.push({
      id: 'wind',
      severity: 'info',
      message:
        'Wind increases evaporation — consider wind breaks, misting, and tighter truck spacing review.',
    });
  }
  if (snapshot.rainRisk === 'high') {
    tips.push({
      id: 'rain',
      severity: 'critical',
      message: 'Rain in forecast — hold order or prep plastic/rain plan per ACI 305.',
    });
  }

  const lowReady = projects.filter((p) => p.readinessScore < 65 && p.pourDateIso);
  if (lowReady.length > 0) {
    tips.push({
      id: 'ready',
      severity: 'warning',
      message: `${lowReady.length} placement(s) below 65 readiness — complete call sheet & batch plant contact in Placement Planner.`,
    });
  }

  const noPlant = projects.filter((p) => !p.batchPlantName && p.volumeYd > 0);
  if (noPlant.length > 0) {
    tips.push({
      id: 'plant',
      severity: 'info',
      message: 'Select batch plant in Step 1 before dispatching trucks.',
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: 'ok',
      severity: 'info',
      message: 'Operations look stable — confirm truck spacing with crew before first load.',
    });
  }

  return tips;
}

function projectHasTrackedProposal(
  project: Project,
  proposals: TrackedProposalRow[],
): boolean {
  return proposals.some(
    (p) =>
      p.data?.projectTitle === project.name ||
      p.title.toLowerCase().includes(project.name.toLowerCase()),
  );
}

export function buildUpcomingPlacements(
  projects: Project[],
  now = new Date(),
): UpcomingPlacementRow[] {
  const today = startOfDay(now);
  const rows: UpcomingPlacementRow[] = [];

  for (const project of projects) {
    if (isProjectClosedOut(project)) continue;
    const pourDate = parsePourDate(project.pourDate);
    if (!pourDate || pourDate < today) continue;

    const order = project.placementOrder;
    const timeline = buildPourTimeline(order, pourDate, now);
    const schedule = isSameDay(pourDate, now)
      ? buildDeliverySchedule(order, pourDate, project.name, now)
      : null;

    rows.push({
      projectId: project.id,
      projectName: project.name,
      pourDateLabel: formatPourDateLabel(pourDate),
      sortTime: pourDate.getTime(),
      volumeYd: projectVolumeYd(project),
      batchPlantName: order?.batchPlantName ?? '—',
      nextLoadLabel: schedule?.etaLabel ?? 'Call sheet pending',
      timeline,
    });
  }

  return rows.sort((a, b) => a.sortTime - b.sortTime);
}

export function buildOperationsSnapshot(
  projects: Project[],
  options?: {
    now?: Date;
    proposals?: TrackedProposalRow[];
    /** Full project list for QC widget (defaults to `projects`). Pass all store projects when `projects` is ops-filtered. */
    allProjectsForQc?: Project[];
    proposalDrafts?: Record<string, { proposal?: { proposalData?: import('../types/proposal').ProposalData } }>;
  },
): OperationsSnapshot {
  const now = options?.now ?? new Date();
  const proposals = options?.proposals ?? [];
  const proposalDrafts = options?.proposalDrafts ?? {};
  const qcProjectList = options?.allProjectsForQc ?? projects;
  const today = startOfDay(now);

  const heatRiskEarly: OpsRiskLevel = 'moderate';
  const windRiskEarly: OpsRiskLevel = 'moderate';

  const cards: DashboardProjectCard[] = projects.map((project) => {
    const order = project.placementOrder;
    const volumeYd = projectVolumeYd(project);
    const pourDate = parsePourDate(project.pourDate);
    const { score, statusLabel } = computeReadinessScore(project, order);
    const matchedProposal = proposals.find(
      (p) =>
        p.project_id === project.id ||
        p.data?.projectTitle === project.name ||
        p.title.toLowerCase().includes(project.name.toLowerCase()),
    );
    const hasProposalDraft =
      Boolean(matchedProposal) ||
      Boolean(proposalDrafts[project.id]?.proposal?.proposalData?.clientName?.trim());
    const workflow = resolveProjectWorkflow(project, {
      hasProposalDraft,
      proposalStatus: matchedProposal?.status,
      windRisk: windRiskEarly,
      heatRisk: heatRiskEarly,
      readinessScore: score,
      now,
    });
    const psi =
      project.calculations?.[0]?.psi ??
      (order?.summaryLines?.find((l) => /PSI/i.test(l))?.match(/(\d{4})/)?.[1] ??
        '');

    return {
      id: project.id,
      name: project.name,
      volumeYd,
      remainingCyLabel:
        volumeYd > 0 ? `${volumeYd.toFixed(0)} CY planned` : 'Volume TBD',
      nextPourLabel: pourDate ? formatPourDateLabel(pourDate) : 'Placement date TBD',
      mixLabel: psi ? `${psi} PSI` : 'Mix TBD',
      statusLabel,
      orderStatus: order?.status ?? null,
      batchPlantName: order?.batchPlantName ?? '',
      readinessScore: score,
      qcCount: project.qcRecords?.length ?? 0,
      hasJobsite: Boolean(
        project.jobsiteAddress?.street || project.jobsiteAddress?.city,
      ),
      pourDateIso: project.pourDate,
      workflowStage: workflow.stage,
      workflowLabel: workflow.stageLabel,
      nextAction: workflow.nextAction,
      healthScore: workflow.healthScore,
    };
  });

  const todayPours = cards.filter((c) => {
    const d = parsePourDate(c.pourDateIso);
    return d && isSameDay(d, now);
  });

  const upcomingPours = cards.filter((c) => {
    const d = parsePourDate(c.pourDateIso);
    return d && d > today && d.getTime() - today.getTime() < 14 * 86400000;
  });

  const hasPlacementsToday = todayPours.length > 0;
  const todayPrimary = todayPours[0];
  const todayPrimaryProject = todayPrimary
    ? projects.find((p) => p.id === todayPrimary.id)
    : undefined;
  const todayOrder = todayPrimaryProject?.placementOrder;
  const todayPourDate = parsePourDate(todayPrimary?.pourDateIso);

  const timeline = hasPlacementsToday
    ? buildPourTimeline(todayOrder, todayPourDate, now)
    : [];
  const dispatchTrucks = hasPlacementsToday
    ? buildDispatchTrucks(todayOrder, todayPourDate, now)
    : [];

  const totalCy = todayPours.reduce((s, p) => s + p.volumeYd, 0);
  const { qcTestsDue, qcTestsOverdue } = buildQcDashboardStats(
    qcProjectList,
    proposals,
    now,
  );

  const scheduledOrders = cards.filter(
    (c) => c.orderStatus === 'scheduled' || c.orderStatus === 'ordered',
  ).length;

  const pumpScheduledToday =
    hasPlacementsToday &&
    Boolean(
      todayOrder?.summaryLines?.some((l) => /Pump Required:\s*Yes/i.test(l)) ||
        todayOrder?.callSheet?.pumpCompany,
    );

  const heatRisk: OpsRiskLevel =
    totalCy > 80 ? 'high' : totalCy > 40 ? 'moderate' : 'low';
  const rainRisk: OpsRiskLevel = 'low';
  const windRisk: OpsRiskLevel = 'moderate';
  const evaporationRisk: OpsRiskLevel =
    windRisk === 'high' || heatRisk === 'high'
      ? 'high'
      : windRisk === 'moderate' || heatRisk === 'moderate'
        ? 'moderate'
        : 'low';
  const weatherRisk: OpsRiskLevel =
    heatRisk === 'high' || rainRisk === 'high'
      ? 'high'
      : heatRisk === 'moderate' || windRisk === 'moderate'
        ? 'moderate'
        : 'low';

  const mitigations = MITIGATION_OPTIONS.filter(
    (m) =>
      m.category === 'temperature' ||
      m.category === 'wind-evaporation' ||
      m.category === 'operational',
  )
    .slice(0, 4)
    .map((m) => m.label);

  const globalReadiness =
    cards.length > 0
      ? Math.round(
          cards.reduce((s, c) => s + c.readinessScore, 0) / cards.length,
        )
      : 0;

  const deliverySchedule = hasPlacementsToday
    ? buildDeliverySchedule(
        todayOrder,
        todayPourDate,
        todayPrimary?.name ?? 'Today\'s placement',
        now,
      )
    : null;

  const proposalMetrics = buildProposalDashboardMetrics(proposals, now);
  const upcomingPlacements = buildUpcomingPlacements(projects, now);

  const sentStatuses = new Set([
    'sent',
    'viewed',
    'opened',
    'accepted',
    'declined',
    'deposit_paid',
    'scheduled',
  ]);
  const proposalsSentCount = proposals.filter((p) =>
    sentStatuses.has(p.status ?? 'draft'),
  ).length;

  const globalHealthScore =
    cards.length > 0
      ? Math.round(cards.reduce((s, c) => s + c.healthScore, 0) / cards.length)
      : 0;

  const primaryReadinessIssues = todayPrimaryProject
    ? buildReadinessIssues(todayPrimaryProject, todayOrder, {
        wind: windRisk,
        heat: heatRisk,
      }).map((i) => ({
        message: i.message,
        fixPath: i.fixPath,
        fixSearch: i.fixSearch,
      }))
    : [];

  return {
    todayPourCount: todayPours.length,
    upcomingPourCount: upcomingPours.length,
    totalCyScheduled: totalCy,
    activeProjectCount: projects.length,
    weatherRisk,
    weatherRiskLabel: weatherRisk.toUpperCase(),
    qcTestsDue,
    qcTestsOverdue,
    deliveryStatusLabel: hasPlacementsToday
      ? scheduledOrders > 0
        ? `${scheduledOrders} ORDERED`
        : 'PLACEMENT TODAY — ORDER PENDING'
      : 'NO PLACEMENTS TODAY',
    pumpScheduledToday,
    nextTruckEtaLabel: deliverySchedule?.etaLabel ?? '—',
    globalReadiness,
    projects: cards.sort((a, b) => b.readinessScore - a.readinessScore),
    todayPours,
    hasPlacementsToday,
    timeline,
    dispatchTrucks,
    heatRisk,
    rainRisk,
    windRisk,
    evaporationRisk,
    recommendedStartWindow: heatRisk === 'high' ? '0300–0600' : '0600–0900',
    mitigations,
    smartTips: buildSmartPourTips(cards, { weatherRisk, heatRisk, windRisk, rainRisk }),
    deliverySchedule,
    proposalMetrics,
    upcomingPlacements,
    proposalsSentCount,
    globalHealthScore,
    primaryReadinessIssues,
  };
}
