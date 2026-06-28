import {
  createDefaultPlumbingSystem,
  PLUMBING_SYSTEM_SCHEMA_VERSION,
} from './plumbingDefaults';
import type {
  PlumbingCodeProfileId,
  PlumbingEquipment,
  PlumbingFixture,
  PlumbingFixtureType,
  PlumbingMaterial,
  PlumbingNode,
  PlumbingRun,
  PlumbingSystem,
} from './plumbingTypes';

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

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function normalizeArray<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
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
    runs: normalizeArray(raw.runs, hasStringId) as PlumbingRun[],
    equipment: normalizeArray(raw.equipment, hasStringId) as PlumbingEquipment[],
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
