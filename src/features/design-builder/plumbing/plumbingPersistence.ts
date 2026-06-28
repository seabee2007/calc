import {
  createDefaultPlumbingSystem,
  defaultPipeScheduleForMaterial,
  PLUMBING_SYSTEM_SCHEMA_VERSION,
} from './plumbingDefaults';
import { defaultStockLengthForPipe, stockLengthOptionForPreset } from './domain/plumbingStockLengths';
import {
  fittingDefinition,
  isFittingAllowedForMaterial,
  isFittingAllowedForSystem,
} from './domain/plumbingFittingCompatibility';
import type { PlumbingFitting, PlumbingFittingType } from './plumbingFittingTypes';
import type {
  PipeStockLengthKind,
  PipeStockLengthPreset,
  PlumbingCodeProfileId,
  PlumbingEquipment,
  PlumbingFixture,
  PlumbingFixtureRoughInAssembly,
  PlumbingFixtureType,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingNode,
  PlumbingRiserKind,
  PlumbingRoughInSystem,
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
const STOCK_LENGTH_PRESETS: PipeStockLengthPreset[] = [
  '2ft',
  '5ft',
  '10ft',
  '20ft',
  '10ft_stick',
  '20ft_stick',
  '100ft_coil',
  '300ft_coil',
  '500ft_coil',
  '1000ft_coil',
  'custom',
];
const STOCK_LENGTH_KINDS: PipeStockLengthKind[] = ['stick', 'coil', 'custom'];
const ROUGH_IN_SYSTEMS: PlumbingRoughInSystem[] = ['sanitary', 'vent', 'cold_water', 'hot_water'];
const RISER_KINDS: PlumbingRiserKind[] = [
  'vertical_stub_up',
  'vertical_drop',
  'in_wall_riser',
  'fixture_tailpiece',
  'trap_arm',
  'closet_bend_connection',
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

function normalizePipeSchedule(value: unknown, material: PlumbingMaterial): PlumbingPipeSchedule {
  return PIPE_SCHEDULES.includes(value as PlumbingPipeSchedule)
    ? value as PlumbingPipeSchedule
    : defaultPipeScheduleForMaterial(material);
}

function normalizeStockLengthPreset(value: unknown, material: PlumbingMaterial): PipeStockLengthPreset | null {
  if (!STOCK_LENGTH_PRESETS.includes(value as PipeStockLengthPreset)) return null;
  const preset = value as PipeStockLengthPreset;
  return preset === 'custom' || stockLengthOptionForPreset(material, preset) ? preset : null;
}

function normalizeStockLengthKind(value: unknown, fallback: PipeStockLengthKind): PipeStockLengthKind {
  return STOCK_LENGTH_KINDS.includes(value as PipeStockLengthKind) ? value as PipeStockLengthKind : fallback;
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
    const system = raw.system === 'cold_water' || raw.system === 'hot_water' || raw.system === 'sanitary' || raw.system === 'vent'
      ? raw.system
      : 'sanitary';
    const stockDefaults = defaultStockLengthForPipe({ material, system });
    const stockLengthPreset = normalizeStockLengthPreset(raw.stockLengthPreset, material) ?? stockDefaults.stockLengthPreset;
    const option = stockLengthOptionForPreset(material, stockLengthPreset);
    const stockLengthFt =
      typeof raw.stockLengthFt === 'number' && Number.isFinite(raw.stockLengthFt) && raw.stockLengthFt > 0
        ? raw.stockLengthFt
        : option?.lengthFt ?? stockDefaults.stockLengthFt;
    const stockLengthKind = normalizeStockLengthKind(raw.stockLengthKind, option?.kind ?? stockDefaults.stockLengthKind);
    return {
      ...raw,
      system,
      material,
      schedule: normalizePipeSchedule(raw.schedule, material),
      stockLengthFt,
      stockLengthPreset,
      stockLengthKind,
      labelVisible: typeof raw.labelVisible === 'boolean' ? raw.labelVisible : true,
    } as PlumbingRun;
  });
}

function normalizeFittings(value: unknown): PlumbingFitting[] {
  return normalizeArray(value, hasStringId).flatMap((fitting) => {
    const raw = fitting as PlumbingFitting & Record<string, unknown>;
    const type = raw.type as PlumbingFittingType;
    if (!fittingDefinition(type)) return [];
    const material = normalizeMaterial(raw.material, 'pvc');
    const system =
      raw.system === 'cold_water' || raw.system === 'hot_water' || raw.system === 'sanitary' || raw.system === 'vent'
        ? raw.system
        : 'multi';
    if (system !== 'multi' && (!isFittingAllowedForSystem(type, system) || !isFittingAllowedForMaterial(type, material))) {
      return [];
    }
    return [{
      ...raw,
      type,
      system,
      connectedRunIds: Array.isArray(raw.connectedRunIds)
        ? raw.connectedRunIds.filter((id): id is string => typeof id === 'string')
        : [],
      diameterInches: typeof raw.diameterInches === 'number' && Number.isFinite(raw.diameterInches) ? raw.diameterInches : null,
      secondaryDiameterInches:
        typeof raw.secondaryDiameterInches === 'number' && Number.isFinite(raw.secondaryDiameterInches)
          ? raw.secondaryDiameterInches
          : undefined,
      material,
      schedule: normalizePipeSchedule(raw.schedule, material),
      rotationRad: typeof raw.rotationRad === 'number' && Number.isFinite(raw.rotationRad) ? raw.rotationRad : 0,
      elevationMode:
        raw.elevationMode === 'under_slab' ||
        raw.elevationMode === 'in_wall' ||
        raw.elevationMode === 'overhead' ||
        raw.elevationMode === 'vertical' ||
        raw.elevationMode === 'user_defined'
          ? raw.elevationMode
          : 'in_wall',
      labelVisible: typeof raw.labelVisible === 'boolean' ? raw.labelVisible : true,
      isAutoGenerated: typeof raw.isAutoGenerated === 'boolean' ? raw.isAutoGenerated : false,
    }];
  });
}

function normalizeRoughIns(value: unknown): PlumbingFixtureRoughInAssembly[] {
  return normalizeArray(value, hasStringId).flatMap((roughIn) => {
    const raw = roughIn as PlumbingFixtureRoughInAssembly & Record<string, unknown>;
    const system = ROUGH_IN_SYSTEMS.includes(raw.system as PlumbingRoughInSystem)
      ? raw.system as PlumbingRoughInSystem
      : null;
    if (!system || typeof raw.fixtureId !== 'string' || typeof raw.fixtureNodeId !== 'string') return [];
    if (typeof raw.riserBottomNodeId !== 'string' || typeof raw.riserTopNodeId !== 'string' || typeof raw.riserRunId !== 'string') {
      return [];
    }
    const material = normalizeMaterial(raw.material, system === 'cold_water' || system === 'hot_water' ? 'pex' : 'pvc');
    return [{
      ...raw,
      system,
      fittingIds: Array.isArray(raw.fittingIds)
        ? raw.fittingIds.filter((id): id is string => typeof id === 'string')
        : [],
      diameterInches: typeof raw.diameterInches === 'number' && Number.isFinite(raw.diameterInches)
        ? raw.diameterInches
        : null,
      material,
      schedule: normalizePipeSchedule(raw.schedule, material),
      elevationMode:
        raw.elevationMode === 'under_slab' ||
        raw.elevationMode === 'in_wall' ||
        raw.elevationMode === 'overhead' ||
        raw.elevationMode === 'vertical' ||
        raw.elevationMode === 'user_defined'
          ? raw.elevationMode
          : 'vertical',
      riserKind: RISER_KINDS.includes(raw.riserKind as PlumbingRiserKind)
        ? raw.riserKind as PlumbingRiserKind
        : 'vertical_stub_up',
      labelVisible: typeof raw.labelVisible === 'boolean' ? raw.labelVisible : true,
      isAutoGenerated: typeof raw.isAutoGenerated === 'boolean' ? raw.isAutoGenerated : true,
    }];
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
    fittings: normalizeFittings(raw.fittings),
    roughIns: normalizeRoughIns(raw.roughIns),
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
