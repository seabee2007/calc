import type { PourPlannerFormState, PlacementMethod } from '../types/pourPlanner';
import type { PlacementAreaType } from '../types/callSheet';
import type { UserPreferences } from '../types';
import {
  batchPlantDisplayLine,
  jobsiteDisplayAddress,
} from './addressForm';
import type { ScoredPourDay } from './pourScoring';

const PLACEMENT_METHOD_LABELS: Record<PlacementMethod, string> = {
  '': 'Not set',
  chute: 'Chute',
  pump: 'Pump truck',
  conveyor: 'Conveyor',
  buggy: 'Buggy',
  bucket: 'Crane bucket',
};

const PLACEMENT_AREAS: { key: PlacementAreaType; label: string }[] = [
  { key: 'footing', label: 'Footing' },
  { key: 'slab', label: 'Slab' },
  { key: 'wall', label: 'Wall' },
  { key: 'column', label: 'Column' },
  { key: 'pavement', label: 'Pavement' },
];

const PSI_OPTIONS = ['2500', '3000', '4000', '5000'];

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
  hotWeatherRiskLevel?: string;
}

function push(lines: string[], ...items: (string | null | undefined)[]) {
  for (const item of items) {
    if (item != null && item !== '') lines.push(item);
  }
}

function sectionTitle(title: string): string[] {
  return ['', title, '─'.repeat(Math.max(title.length, 24))];
}

function labelValue(label: string, value: string | null | undefined): string {
  const v = value?.trim();
  return `${label}: ${v || '_______________'}`;
}

function yesNo(value: boolean | undefined): string {
  return value ? 'Yes' : 'No';
}

function check(active: boolean): string {
  return active ? '[X]' : '[ ]';
}

function formatPourDateMilitary(
  selectedDay?: ScoredPourDay,
  projectPourDateIso?: string,
): string {
  let d: Date | null = null;
  if (selectedDay?.date) {
    d = new Date(`${selectedDay.date}T12:00:00`);
  } else if (projectPourDateIso) {
    d = new Date(projectPourDateIso);
  }
  if (!d || Number.isNaN(d.getTime())) {
    return 'TBD — set pour day in Step 4 or save placement date';
  }
  const day = d.getDate();
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}

function formatStartTime(time24: string): string {
  const t = time24.trim();
  if (!t) return 'TBD';
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h)) return t;
  const hour = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const min = Number.isFinite(m) ? `:${String(m).padStart(2, '0')}` : '';
  return `${hour}${min} ${ampm} (${t})`;
}

function admixtureLines(form: PourPlannerFormState): string[] {
  const lines: string[] = [];
  if (form.waterReducer) lines.push('  Mid-range water reducer');
  if (form.retarder) lines.push('  Retarder');
  if (form.superplasticizer || form.scc) lines.push('  Superplasticizer');
  if (form.accelerator) lines.push('  Accelerator');
  if (form.fiber) lines.push('  Fiber reinforcement');
  if (form.hotWeatherMix) lines.push('  Hot-weather mix design');
  if (lines.length === 0) lines.push('  (none specified)');
  return lines;
}

function placementAreaBlock(form: PourPlannerFormState): string[] {
  const selected = form.placementAreaType;
  return PLACEMENT_AREAS.map(
    ({ key, label }) => `  ${check(selected === key)} ${label}`,
  );
}

function psiBlock(form: PourPlannerFormState): string[] {
  const psi = form.psi.trim();
  return PSI_OPTIONS.map(
    (p) => `  ${check(psi === p)} ${p} PSI`,
  );
}

function inferHotWeather(form: PourPlannerFormState, risk?: string): boolean {
  return (
    form.hotWeatherMix ||
    form.weatherFactorMode === 'hot' ||
    risk === 'high' ||
    risk === 'moderate'
  );
}

function inferColdWeather(form: PourPlannerFormState): boolean {
  return form.weatherFactorMode === 'cold';
}

function inferWindConcerns(form: PourPlannerFormState, selectedDay?: ScoredPourDay): boolean {
  const wind = parseFloat(form.windSpeed);
  if (Number.isFinite(wind) && wind >= 15) return true;
  if (selectedDay && selectedDay.maxWindSpeed >= 15) return true;
  return false;
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
    selectedDay,
    projectPourDateIso,
    hotWeatherRiskLevel,
  } = input;

  const jobsite = jobsiteDisplayAddress(form);
  const plantName = form.batchPlantName.trim();
  const plantAddr = batchPlantDisplayLine(form);
  const slump =
    form.requiredSlumpAtPlacement || form.specifiedSlump || '';
  const spacing = parseFloat(form.truckSpacingMinutes);
  const isPump = form.placementMethod === 'pump';
  const isConveyor = form.placementMethod === 'conveyor';
  const pocPhone =
    form.pointOfContactPhone.trim() || form.batchPlantPhone.trim();

  const lines: string[] = [
    'READY MIX CONCRETE CALL SHEET',
    '=============================',
  ];

  push(lines, ...sectionTitle('PROJECT INFORMATION'));
  push(
    lines,
    labelValue('Project Name', form.projectName),
    labelValue('Project Number', form.projectNumber),
    labelValue('Contractor', form.contractor),
    labelValue('Superintendent', form.superintendent),
    labelValue('Point of Contact', form.pointOfContact),
    labelValue('Phone Number', pocPhone),
    labelValue('Date of Pour', formatPourDateMilitary(selectedDay, projectPourDateIso)),
    labelValue('Requested Start Time', formatStartTime(form.pourStartTime)),
    labelValue(
      'Estimated Pour Duration',
      pourDurationHours > 0 ? `${pourDurationHours.toFixed(1)} hours` : undefined,
    ),
  );

  push(lines, ...sectionTitle('PLACEMENT LOCATION'));
  push(
    lines,
    labelValue('Site Address', jobsite),
    'Specific Placement Area:',
    ...placementAreaBlock(form),
    labelValue('Specific Placement Area (detail)', form.specificPlacementArea || form.slabSize),
    labelValue('Access Instructions', form.accessInstructions),
    labelValue('Gate Codes / Escorts Required', form.gateCodesEscorts),
    labelValue('Washout Location', form.washoutLocation),
  );

  push(lines, ...sectionTitle('BATCH PLANT'));
  push(
    lines,
    labelValue('Plant Name', plantName),
    labelValue('Plant Address', plantAddr),
    labelValue('Dispatch Contact', form.batchPlantDispatchContact),
    labelValue('Plant Phone', form.batchPlantPhone),
    labelValue('Plant Email', form.batchPlantEmail),
  );

  push(lines, ...sectionTitle('CONCRETE MIX INFORMATION'));
  push(
    lines,
    labelValue('Mix Design Number', form.mixDesignNumber),
    'PSI Requirement:',
    ...psiBlock(form),
    labelValue('Aggregate Size', form.aggregateSize ? `${form.aggregateSize}"` : undefined),
    labelValue('Slump Requirement', slump ? `${slump}"` : undefined),
    form.placementMethod === 'pump' && form.requiredSlumpAtPump
      ? labelValue('Slump at Pump', `${form.requiredSlumpAtPump}"`)
      : null,
    labelValue('Air Content', form.airEntrainment ? `${form.airEntrainment}%` : undefined),
    labelValue('Water-Cement Ratio', form.waterCementRatio),
    labelValue('Fiber Reinforcement', form.fiber ? 'Yes' : 'No'),
    labelValue('Color Additive', form.colorAdditive),
    'Admixtures:',
    ...admixtureLines(form),
  );

  push(lines, ...sectionTitle('QUANTITY'));
  push(
    lines,
    labelValue(
      'Total Cubic Yards',
      volumeYd > 0 ? `${volumeYd.toFixed(1)} CY` : undefined,
    ),
    labelValue(
      'Truck Spacing Requested',
      Number.isFinite(spacing) && spacing > 0
        ? `${Math.round(spacing)} min spacing`
        : undefined,
    ),
    labelValue(
      'Expected Truck Size',
      truckCapacityYd > 0 ? `${truckCapacityYd} CY trucks` : undefined,
    ),
    labelValue('Number of Trucks', truckCount > 0 ? String(truckCount) : undefined),
    labelValue('Pump Required', yesNo(isPump)),
    labelValue('Pump Company', isPump ? form.pumpCompany : undefined),
    isPump && form.pumpLineLength
      ? labelValue('Pump Line Length', `${form.pumpLineLength} ft`)
      : null,
    isPump && form.pumpVerticalHeight
      ? labelValue('Pump Vertical', `${form.pumpVerticalHeight} ft`)
      : null,
    labelValue('Conveyor Required', yesNo(isConveyor)),
    labelValue('Placement Method', PLACEMENT_METHOD_LABELS[form.placementMethod]),
    travelTimeMin > 0 || travelDistanceMi > 0
      ? labelValue(
          'Plant to Site Drive',
          `${travelDistanceMi > 0 ? `${travelDistanceMi} mi · ` : ''}${travelTimeMin > 0 ? `${Math.round(travelTimeMin)} min` : ''}`,
        )
      : null,
    labelValue('ASTM C94 Window Status', deliveryStatus),
  );

  push(lines, ...sectionTitle('WEATHER / ENVIRONMENTAL'));
  push(
    lines,
    labelValue(
      'Expected Temperature',
      form.ambientTemp
        ? `${form.ambientTemp}°F`
        : selectedDay
          ? `${Math.round(selectedDay.avgTemp)}°F (forecast)`
          : undefined,
    ),
    labelValue('Humidity', form.relativeHumidity ? `${form.relativeHumidity}%` : undefined),
    labelValue('Rain Forecast', yesNo(form.rainForecast)),
    labelValue('Hot Weather Placement', yesNo(inferHotWeather(form, hotWeatherRiskLevel))),
    labelValue('Cold Weather Placement', yesNo(inferColdWeather(form))),
    labelValue('Wind Concerns', yesNo(inferWindConcerns(form, selectedDay))),
    form.windSpeed ? labelValue('Wind Speed', `${form.windSpeed} mph`) : null,
    labelValue('Night Pour', yesNo(form.nightPour)),
    selectedDay
      ? labelValue('Forecast Rating', selectedDay.rating)
      : null,
    form.expectedConcreteTempAtArrival
      ? labelValue('Est. Concrete Temp at Arrival', `${form.expectedConcreteTempAtArrival}°F`)
      : null,
  );

  push(lines, ...sectionTitle('QC REQUIREMENTS'));
  push(
    lines,
    labelValue('Third-Party Testing', yesNo(form.qcThirdPartyTesting)),
    labelValue('Slump Tests Required', yesNo(form.qcSlumpTestsRequired)),
    labelValue('Cylinders Required', yesNo(form.qcCylindersRequired)),
    'Break Schedule:',
    `  ${check(form.qcBreak7Day)} 7-day`,
    `  ${check(form.qcBreak28Day)} 28-day`,
    labelValue('Special Inspection Required', yesNo(form.qcSpecialInspection)),
  );

  push(lines, ...sectionTitle('SAFETY / SITE CONDITIONS'));
  push(
    lines,
    labelValue('PPE Requirements', yesNo(form.safetyPpe)),
    labelValue('Traffic Control Required', yesNo(form.safetyTrafficControl)),
    labelValue('Spotter Required', yesNo(form.safetySpotter)),
    labelValue('Powerline Hazards', yesNo(form.safetyPowerlines)),
    labelValue('Limited Access', yesNo(form.safetyLimitedAccess)),
    labelValue('Crane Nearby', yesNo(form.safetyCraneNearby)),
    labelValue('Uneven Terrain', yesNo(form.safetyUnevenTerrain)),
    labelValue('Crew Size On Site', form.crewSize),
  );

  push(lines, ...sectionTitle('STANDARD NOTES'));
  const standardNotes = [
    form.callBeforeFirstTruck.trim()
      ? `Call ${form.callBeforeFirstTruck.trim()} minutes before first truck.`
      : null,
    'Do not add water without superintendent approval.',
    form.washoutLocation.trim()
      ? `Use washout location only: ${form.washoutLocation.trim()}`
      : 'Confirm washout location with superintendent.',
    form.gateCodesEscorts.trim()
      ? `Gate / escort: ${form.gateCodesEscorts.trim()}`
      : null,
  ].filter(Boolean) as string[];
  for (const note of standardNotes) {
    lines.push(`  • ${note}`);
  }

  if (form.orderNotes.trim()) {
    push(lines, ...sectionTitle('ADDITIONAL NOTES'));
    for (const line of form.orderNotes.trim().split(/\n/)) {
      lines.push(`  ${line}`);
    }
  }

  push(
    lines,
    '',
    '— Generated from Placement Risk Analyzer —',
    'Verify all details with batch plant dispatcher before confirming order.',
  );

  return lines;
}

export function pourOrderCallSheetText(input: PourOrderSummaryInput): string {
  return buildPourOrderCallSheet(input).join('\n');
}
