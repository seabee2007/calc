import type { Project } from '../types';
import type { TrackedProposalRow } from '../types/proposalTracking';
import type { OpsRiskLevel } from './operationsDashboard';
import { computeProposalFinancials } from './proposalFinancials';
import { isProjectClosedOut } from './projectWorkflow';

export type ProjectRiskLevel = 'low' | 'moderate' | 'high';

export interface ProjectRiskReview {
  projectId?: string;
  projectName?: string;
  riskLevel: ProjectRiskLevel;
  riskLabel: string;
  attention: string[];
  good: string[];
}

export interface ProjectRiskWeatherSignals {
  heatRisk: OpsRiskLevel;
  rainRisk: OpsRiskLevel;
  windRisk: OpsRiskLevel;
  evaporationRisk: OpsRiskLevel;
  weatherRisk: OpsRiskLevel;
}

function parsePourDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function projectVolumeYd(project: Project): number {
  return (project.calculations ?? []).reduce(
    (sum, c) => sum + (c.result?.volume > 0 ? c.result.volume : 0),
    0,
  );
}

function hasTruckSpacing(lines: string[] | undefined): boolean {
  return Boolean(lines?.some((l) => /Truck Spacing/i.test(l)));
}

function hasPlacementWindow(project: Project, order: Project['placementOrder']): boolean {
  if (order?.summaryLines?.some((l) => /Requested Start Time:/i.test(l))) return true;
  const pour = parsePourDate(project.pourDate);
  if (!pour) return false;
  return pour.getHours() !== 0 || pour.getMinutes() !== 0;
}

function mixSelected(project: Project): boolean {
  const order = project.placementOrder;
  const cs = order?.callSheet;
  return Boolean(
    project.mixProfile ||
      cs?.mixDesignNumber?.trim() ||
      cs?.waterCementRatio != null ||
      order?.summaryLines?.some((l) => /Mix|PSI|w\/c/i.test(l)),
  );
}

function reinforcementComplete(project: Project): boolean {
  const sets = project.reinforcements ?? [];
  if (sets.length === 0) return false;
  return sets.every((r) => {
    if (r.reinforcement_type === 'fiber') {
      return (r.fiber_total_lb ?? 0) > 0 || (r.fiber_bags ?? 0) > 0;
    }
    if (r.reinforcement_type === 'mesh') {
      return (r.mesh_sheets ?? 0) > 0;
    }
    return (r.total_bars ?? 0) > 0 || (r.total_linear_ft ?? 0) > 0;
  });
}

function crewAssigned(project: Project): boolean {
  const order = project.placementOrder;
  const crewFromOrder = parseInt(order?.production?.crewSize ?? '', 10);
  if (crewFromOrder > 0) return true;
  const estimate = project.laborEstimates?.[0];
  const crewFromEstimate = parseInt(estimate?.inputs?.crewSize ?? '', 10);
  return crewFromEstimate > 0;
}

function overtimeRisk(project: Project): boolean {
  const est = project.laborEstimates?.[0];
  const otHours = est?.professionalLabor?.overtimeManHours ?? 0;
  return otHours > 0;
}

function qcChecklistStarted(project: Project): boolean {
  const records = project.qcRecords ?? [];
  if (records.length === 0) return false;
  return records.some((r) => {
    const c = r.checklist;
    if (!c) return false;
    return (
      c.rebarSpacingPass ||
      c.formAlignmentPass ||
      c.subgradePrepElectrical ||
      c.curingMaterialsAvailable
    );
  });
}

function findMatchedProposal(
  project: Project,
  proposals: TrackedProposalRow[],
): TrackedProposalRow | undefined {
  return proposals.find(
    (p) =>
      p.data?.projectTitle === project.name ||
      p.title.toLowerCase().includes(project.name.toLowerCase()),
  );
}

/** Featured project for dashboard risk: today's pour first, else next scheduled placement. */
export function resolveFeaturedRiskProject(
  projects: Project[],
  now = new Date(),
): Project | null {
  const open = projects.filter((p) => !isProjectClosedOut(p));
  const today = startOfDay(now);
  const todayPour = open.find((p) => {
    const d = parsePourDate(p.pourDate);
    return d && isSameDay(d, now);
  });
  if (todayPour) return todayPour;

  const upcoming = open
    .map((p) => ({ p, d: parsePourDate(p.pourDate) }))
    .filter((x) => x.d && x.d.getTime() >= today.getTime())
    .sort((a, b) => a.d!.getTime() - b.d!.getTime());
  return upcoming[0]?.p ?? null;
}

export function buildProjectRiskReview(
  project: Project | null,
  weather: ProjectRiskWeatherSignals,
  proposals: TrackedProposalRow[] = [],
): ProjectRiskReview {
  if (!project) {
    return {
      riskLevel: 'low',
      riskLabel: 'NO ACTIVE PLACEMENT',
      attention: [
        'No projects scheduled — closed jobs are out of the queue.',
      ],
      good: [],
    };
  }

  const order = project.placementOrder;
  const volumeYd = projectVolumeYd(project);
  const attention: string[] = [];
  const good: string[] = [];

  const weatherOk =
    weather.weatherRisk === 'low' ||
    (weather.weatherRisk === 'moderate' && weather.rainRisk !== 'high');

  if (weather.evaporationRisk === 'high' || weather.evaporationRisk === 'moderate') {
    attention.push(
      weather.windRisk === 'high'
        ? 'Wind / evaporation risk high — review start window'
        : 'Wind / evaporation risk increasing — confirm misting & breaks',
    );
  } else if (weatherOk) {
    good.push('Weather currently acceptable');
  }

  if (weather.rainRisk === 'high' || weather.rainRisk === 'moderate') {
    attention.push('Rain probability elevated for placement window');
  }

  if (weather.heatRisk === 'high') {
    attention.push('Heat index high — consider night placement or retarder');
  } else if (weather.heatRisk === 'moderate') {
    attention.push('Heat may accelerate set — confirm start time');
  }

  const batchPlantAssigned = Boolean(
    order?.batchPlantName?.trim() || order?.batchPlantAddress?.trim(),
  );
  if (!batchPlantAssigned) attention.push('Batch plant not assigned');
  else good.push('Batch plant assigned');

  if (!mixSelected(project)) attention.push('Mix not selected');
  else good.push('Mix selected');

  if (volumeYd <= 0) attention.push('Volume not calculated');
  else good.push('Volume calculated');

  if (volumeYd > 0 && !reinforcementComplete(project)) {
    attention.push('Rebar / materials incomplete');
  } else if (reinforcementComplete(project)) {
    good.push('Rebar / materials complete');
  }

  if (!project.pourDate) attention.push('Placement date not scheduled');
  else good.push('Placement date scheduled');

  if (!hasTruckSpacing(order?.summaryLines)) {
    attention.push('Delivery spacing incomplete');
  } else good.push('Truck schedule entered');

  if (!hasPlacementWindow(project, order)) {
    attention.push('Placement window not set');
  } else good.push('Placement window set');

  const matched = findMatchedProposal(project, proposals);
  const proposalData = matched?.data;
  const proposalFinancials = proposalData
    ? computeProposalFinancials(proposalData)
    : null;
  const latestLabor = project.laborEstimates?.[0]?.laborCost ?? 0;

  if (proposalFinancials && latestLabor > 0) {
    const proposalLabor = proposalFinancials.labor_cost;
    if (proposalLabor > 0 && latestLabor > proposalLabor * 1.1) {
      attention.push('Labor estimate exceeds proposal labor line');
    } else if (proposalLabor > 0) {
      good.push('Labor estimate within proposal');
    }
    const margin =
      proposalFinancials.total_amount > 0
        ? (proposalFinancials.total_amount - latestLabor) / proposalFinancials.total_amount
        : null;
    if (margin != null && margin < 0.15) {
      attention.push('Margin below 15% threshold');
    } else if (margin != null && margin >= 0.15) {
      good.push('Margin within target');
    }
  } else if (latestLabor > 0 && !proposalFinancials) {
    attention.push('Labor estimate not tied to a proposal');
  }

  if (!crewAssigned(project)) attention.push('Crew not assigned');
  else good.push('Crew assigned');

  if (overtimeRisk(project)) attention.push('Overtime risk on labor estimate');

  if (!project.mixProfile) attention.push('Curing method not selected');
  else good.push('Curing method selected');

  const callSheetReady = Boolean(order?.summaryLines?.length);
  if (!callSheetReady) attention.push('Call sheet incomplete');
  else good.push('Call sheet ready');

  if ((project.qcRecords?.length ?? 0) > 0 && !qcChecklistStarted(project)) {
    attention.push('QC checklist incomplete');
  } else if (qcChecklistStarted(project)) {
    good.push('QC checklist started');
  }

  const cappedAttention = attention.slice(0, 6);
  const cappedGood = good.slice(0, 5);

  let riskLevel: ProjectRiskLevel = 'low';
  if (
    weather.weatherRisk === 'high' ||
    cappedAttention.length >= 4 ||
    cappedAttention.some((a) => /high|exceeds|below 15%/i.test(a))
  ) {
    riskLevel = 'high';
  } else if (cappedAttention.length >= 1 || weather.weatherRisk === 'moderate') {
    riskLevel = 'moderate';
  }

  const riskLabel =
    riskLevel === 'high'
      ? 'HIGH RISK'
      : riskLevel === 'moderate'
        ? 'MODERATE RISK'
        : 'LOW RISK';

  return {
    projectId: project.id,
    projectName: project.name,
    riskLevel,
    riskLabel,
    attention: cappedAttention,
    good: cappedGood,
  };
}
