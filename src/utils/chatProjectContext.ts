import type { Project } from '../types';
import { formatUSAddress } from '../types/address';

type ExtendedWeather = {
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  forecast?: Array<{
    date: string;
    maxTemp?: number;
    minTemp?: number;
    chanceOfRain?: number;
    maxWindSpeed?: number;
    condition?: string;
  }>;
};

function pourDateKey(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return iso.slice(0, 10);
  } catch {
    return undefined;
  }
}

function appendWeatherContext(project: Project, lines: string[]): void {
  const calc = project.calculations?.[0];
  const weather = calc?.weather as ExtendedWeather | undefined;
  if (!weather) return;

  const pourKey = pourDateKey(project.pourDate);
  const forecast = weather.forecast;

  if (forecast?.length) {
    const day =
      (pourKey ? forecast.find((d) => d.date === pourKey) : undefined) ?? forecast[0];
    if (day) {
      const parts = [
        `Weather for ${day.date}`,
        day.maxTemp != null ? `high ${Math.round(day.maxTemp)}°F` : null,
        day.minTemp != null ? `low ${Math.round(day.minTemp)}°F` : null,
        day.chanceOfRain != null ? `rain ${Math.round(day.chanceOfRain)}%` : null,
        day.maxWindSpeed != null ? `wind to ${Math.round(day.maxWindSpeed)} mph` : null,
        day.condition ? day.condition : null,
      ].filter(Boolean);
      lines.push(parts.join(' · '));
    }
  } else if (weather.temperature != null) {
    lines.push(
      `Weather snapshot: ${weather.temperature}°F, humidity ${weather.humidity ?? '—'}%, wind ${weather.windSpeed ?? '—'} mph`,
    );
  }
}

function appendCrewContext(project: Project, lines: string[]): void {
  const production = project.placementOrder?.production;
  const labor = project.laborEstimates?.[0];

  if (production) {
    const parts = [
      production.crewSize ? `crew ${production.crewSize}` : null,
      production.finishers ? `finishers ${production.finishers}` : null,
      production.placementMethod ? `method ${production.placementMethod}` : null,
      production.estimatedCrewDurationHours
        ? `est. duration ${production.estimatedCrewDurationHours.toFixed(1)} hr`
        : null,
    ].filter(Boolean);
    if (parts.length) lines.push(`Crew (planner): ${parts.join(', ')}`);
  } else if (labor?.inputs) {
    const parts = [
      labor.inputs.crewSize ? `crew ${labor.inputs.crewSize}` : null,
      labor.inputs.finishers ? `finishers ${labor.inputs.finishers}` : null,
      labor.inputs.placementMethod ? `method ${labor.inputs.placementMethod}` : null,
      labor.volumeYd ? `${labor.volumeYd.toFixed(1)} CY basis` : null,
    ].filter(Boolean);
    if (parts.length) lines.push(`Crew (labor calc): ${parts.join(', ')}`);
  }
}

function appendBatchPlantContext(project: Project, lines: string[]): void {
  const order = project.placementOrder;
  if (!order) return;

  const name = order.batchPlantName?.trim();
  const address = order.batchPlantAddress?.trim();
  if (name) lines.push(`Batch plant: ${name}`);
  if (address) lines.push(`Plant address: ${address}`);

  const travelParts: string[] = [];
  if (order.travelDistanceMi != null && order.travelDistanceMi > 0) {
    travelParts.push(`${order.travelDistanceMi.toFixed(1)} mi`);
  }
  if (order.travelTimeMinutes != null && order.travelTimeMinutes > 0) {
    travelParts.push(`${Math.round(order.travelTimeMinutes)} min drive`);
  }
  if (travelParts.length) lines.push(`Plant route: ${travelParts.join(' · ')}`);

  if (order.status) {
    lines.push(`Ready-mix order status: ${order.status.replace(/_/g, ' ')}`);
  }
}

/** Safe project summary for AI chat — no margins, labor rates, or supplier pricing. */
export function buildChatProjectContext(project: Project | null | undefined): string | null {
  if (!project) return null;

  const lines: string[] = [`Project: ${project.name}`];

  if (project.description?.trim()) {
    lines.push(`Scope: ${project.description.trim()}`);
  }

  if (project.pourDate) {
    try {
      lines.push(
        `Placement date: ${new Date(project.pourDate).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`,
      );
    } catch {
      lines.push(`Placement date: ${project.pourDate}`);
    }
  }

  const jobsite = project.jobsiteAddress;
  if (jobsite?.city?.trim() || jobsite?.state?.trim()) {
    const formatted = formatUSAddress(jobsite);
    if (formatted) lines.push(`Location: ${formatted}`);
  }

  const calcs = project.calculations ?? [];
  const totalCy = calcs.reduce((sum, c) => sum + (c.result?.volume ?? 0), 0);
  if (totalCy > 0) {
    lines.push(`Volume: ${totalCy.toFixed(1)} CY`);
  }

  const primaryCalc = calcs[0];
  if (primaryCalc?.psi) {
    lines.push(`Mix strength: ${primaryCalc.psi} PSI`);
  }
  if (primaryCalc?.type) {
    lines.push(`Placement type: ${primaryCalc.type.replace(/_/g, ' ')}`);
  }

  if (project.mixProfile) {
    lines.push(`Mix profile: ${project.mixProfile}`);
  }

  appendWeatherContext(project, lines);
  appendCrewContext(project, lines);
  appendBatchPlantContext(project, lines);

  const stage = project.placementOrder?.lifecycleStage;
  if (stage) {
    lines.push(`Workflow stage: ${stage.replace(/_/g, ' ')}`);
  }

  const rebarSets = project.reinforcements?.length ?? 0;
  if (rebarSets > 0) {
    lines.push(`Reinforcement designs saved: ${rebarSets}`);
  }

  const qcCount = project.qcRecords?.length ?? 0;
  if (qcCount > 0) {
    lines.push(`QC records on file: ${qcCount}`);
  }

  return lines.join('\n');
}
