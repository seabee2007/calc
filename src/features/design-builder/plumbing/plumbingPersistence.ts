import {
  createDefaultPlumbingSystem,
  defaultPipeScheduleForMaterial,
  PLUMBING_SYSTEM_SCHEMA_VERSION,
} from './plumbingDefaults';
import type {
  PlumbingCodeProfileId,
  PlumbingEquipment,
  PlumbingFixture,
  PlumbingFixtureType,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingNode,
  PlumbingRun,
  PlumbingSystem,
} from './plumbingTypes';
import { normalizeSepticTanks } from './septic/septicPersistence';

const CODE_PROFILE_IDS: PlumbingCodeProfileId[] = [
  'conceptual',
  'guam_ipc_2009',
  'ipc_2024',
  'upc_placeholder',
  'custom',
];

const MATERIALS: PlumbingMaterial[] = [
  'pvc',
  'abs',
  'pex',
  'cpvc',
  'copper',
  'cast_iron',
  'other',
];

const PIPE_SCHEDULES: PlumbingPipeSchedule[] = ['SCH 40', 'SCH 80', 'N/A'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function normalizeCodeProfileId(value: unknown): PlumbingCodeProfileId {
  return CODE_PROFILE_IDS.includes(value as PlumbingCodeProfileId)
    ? value as PlumbingCodeProfileId
    : 'conceptual';
}

function normalizeMaterial(value: unknown, fallback: PlumbingMaterial): PlumbingMaterial {
  return MATERIALS.includes(value as PlumbingMaterial) ? value as PlumbingMaterial : fallback;
}

function normalizePipeSchedule(value: unknown, material: PlumbingMaterial): PlumbingPipeSchedule {
  return PIPE_SCHEDULES.includes(value as PlumbingPipeSchedule)
    ? value as PlumbingPipeSchedule
    : defaultPipeScheduleForMaterial(material);
}

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function normalizeArray<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function normalizeRuns(value: unknown): PlumbingRun[] {
  return normalizeArray(value, hasStringId).map((run) => {
    const raw = run as PlumbingRun & Record<string, unknown>;
    const material = normalizeMaterial(raw.material, 'pvc');
    return {
      ...raw,
      material,
      schedule: normalizePipeSchedule(raw.schedule, material),
      labelVisible: typeof raw.labelVisible === 'boolean' ? raw.labelVisible : true,
    } as PlumbingRun;
  });
}

export function normalizePlumbingSystem(raw: unknown): PlumbingSystem {
  const fallback = createDefaultPlumbingSystem();
  if (!isRecord(raw)) return fallback;
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const codeProfileId = normalizeCodeProfileId(raw.codeProfileId ?? settings.codeProfileId);
  return {
    schemaVersion: PLUMBING_SYSTEM_SCHEMA_VERSION,
    codeProfileId,
    fixtures: normalizeArray(raw.fixtures, hasStringId) as PlumbingFixture[],
    nodes: normalizeArray(raw.nodes, hasStringId) as PlumbingNode[],
    runs: normalizeRuns(raw.runs),
    equipment: normalizeArray(raw.equipment, hasStringId) as PlumbingEquipment[],
    septicTanks: normalizeSepticTanks(raw.septicTanks),
    settings: {
      ...fallback.settings,
      ...settings,
      codeProfileId,
      defaultWaterMaterial: normalizeMaterial(settings.defaultWaterMaterial, fallback.settings.defaultWaterMaterial),
      defaultWasteVentMaterial: normalizeMaterial(
        settings.defaultWasteVentMaterial,
        fallback.settings.defaultWasteVentMaterial,
      ),
      fixtureMarkCounters: isRecord(settings.fixtureMarkCounters)
        ? settings.fixtureMarkCounters as Partial<Record<PlumbingFixtureType, number>>
        : {},
    },
  };
}
