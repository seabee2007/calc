import type { PourPlannerFormState } from '../types/pourPlanner';
import type { PlacementMethod } from '../types/pourPlanner';
import type { UserPreferences } from '../types';
import {
  batchPlantDisplayLine,
  jobsiteDisplayAddress,
} from './addressForm';
import type { ScoredPourDay } from './pourScoring';

const PLACEMENT_LABELS: Record<PlacementMethod, string> = {
  '': 'Not set',
  chute: 'Chute',
  pump: 'Pump truck',
  conveyor: 'Conveyor',
  buggy: 'Buggy',
  bucket: 'Crane bucket',
};

export interface PourOrderSummaryInput {
  form: PourPlannerFormState;
  volumeYd: number;
  truckCount: number;
  truckCapacityYd: number;
  pourDurationHours: number;
  travelTimeMin: number;
  travelDistanceMi: number;
  deliveryStatus: string;
  preferences: UserPreferences;
  selectedDay?: ScoredPourDay;
  projectPourDateIso?: string;
}

function formatPourDate(
  selectedDay?: ScoredPourDay,
  projectPourDateIso?: string,
): string {
  if (selectedDay?.date) {
    const d = new Date(`${selectedDay.date}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (projectPourDateIso) {
    const d = new Date(projectPourDateIso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return 'TBD — set in Step 4 or save placement date';
}

function mixAdmixtures(form: PourPlannerFormState): string[] {
  const items: string[] = [];
  if (form.waterReducer) items.push('water reducer');
  if (form.retarder) items.push('retarder');
  if (form.fiber) items.push('fiber');
  if (form.hotWeatherMix) items.push('hot-weather mix');
  if (form.scc) items.push('SCC');
  return items;
}

export function buildPourOrderCallSheet(input: PourOrderSummaryInput): string[] {
  const {
    form,
    volumeYd,
    truckCount,
    truckCapacityYd,
    pourDurationHours,
    travelTimeMin,
    travelDistanceMi,
    deliveryStatus,
    preferences,
    selectedDay,
    projectPourDateIso,
  } = input;

  const jobsite = jobsiteDisplayAddress(form);
  const plantAddr = batchPlantDisplayLine(form);
  const plantName = form.batchPlantName.trim() || 'Batch plant (see address)';
  const admix = mixAdmixtures(form);
  const slump =
    form.requiredSlumpAtPlacement || form.specifiedSlump || '—';
  const spacing = parseFloat(form.truckSpacingMinutes);

  const lines: string[] = [
    'READY-MIX PLACEMENT ORDER — CALL SHEET',
    '======================================',
    '',
    `Project: ${form.projectName.trim() || 'Unnamed project'}`,
    `Pour date: ${formatPourDate(selectedDay, projectPourDateIso)}`,
    `Requested start: ${form.pourStartTime || 'TBD'}`,
    '',
    'JOBSITE (Step 1)',
    jobsite || '(not set)',
    '',
    'BATCH PLANT (Step 1)',
    plantName,
    plantAddr || '(not set)',
    '',
    'ORDER QUANTITY & DELIVERY',
    `Volume: ${volumeYd > 0 ? `${volumeYd.toFixed(1)} yd³` : 'TBD'}`,
    `Trucks: ${truckCount > 0 ? truckCount : 'TBD'} × ${truckCapacityYd > 0 ? `${truckCapacityYd} yd` : '—'} capacity`,
    Number.isFinite(spacing) && spacing > 0
      ? `Truck spacing: ${Math.round(spacing)} min between arrivals`
      : null,
    `Est. pour duration: ${pourDurationHours > 0 ? `${pourDurationHours.toFixed(1)} hr` : 'TBD'}`,
    travelTimeMin > 0 || travelDistanceMi > 0
      ? `Drive plant → jobsite: ${travelDistanceMi > 0 ? `${travelDistanceMi} mi · ` : ''}${travelTimeMin > 0 ? `${Math.round(travelTimeMin)} min` : ''}`
      : null,
    `ASTM C94 delivery window: ${deliveryStatus}`,
    '',
    'MIX DESIGN',
    `PSI: ${form.psi || '—'}`,
    `Slump at placement: ${slump}"`,
    form.placementMethod === 'pump' && form.requiredSlumpAtPump
      ? `Slump at pump: ${form.requiredSlumpAtPump}"`
      : null,
    `Aggregate: ${form.aggregateSize || '—'}`,
    `Air: ${form.airEntrainment ? `${form.airEntrainment}%` : '—'}`,
    admix.length > 0 ? `Admixtures: ${admix.join(', ')}` : 'Admixtures: none noted',
    '',
    'PLACEMENT',
    `Method: ${PLACEMENT_LABELS[form.placementMethod]}`,
    form.crewSize ? `Crew size: ${form.crewSize}` : null,
    selectedDay
      ? `Weather (selected day): ${selectedDay.rating} · avg ${Math.round(selectedDay.avgTemp)}°F · wind to ${Math.round(selectedDay.maxWindSpeed)} mph`
      : null,
    form.nightPour ? 'Night pour: yes' : null,
    form.rainForecast ? 'Rain in forecast: yes' : null,
    '',
    'FIELD CONDITIONS (from planner)',
    form.ambientTemp ? `Ambient: ${form.ambientTemp}°F` : null,
    form.expectedConcreteTempAtArrival
      ? `Concrete temp at arrival (est.): ${form.expectedConcreteTempAtArrival}°F`
      : null,
    form.relativeHumidity ? `RH: ${form.relativeHumidity}%` : null,
    form.windSpeed ? `Wind: ${form.windSpeed} mph` : null,
    '',
    preferences.volumeUnit !== 'cubic_yards' && volumeYd > 0
      ? `Note: display unit ${preferences.volumeUnit}; order in yd³ as above.`
      : null,
  ].filter((line): line is string => line != null && line !== '');

  if (form.orderNotes.trim()) {
    lines.push('', 'ORDER NOTES', form.orderNotes.trim());
  }

  lines.push(
    '',
    '— Generated from Placement Risk Analyzer —',
    'Confirm mix design, timing, and pricing with the batch plant dispatcher.',
  );

  return lines;
}

export function pourOrderCallSheetText(input: PourOrderSummaryInput): string {
  return buildPourOrderCallSheet(input).join('\n');
}
