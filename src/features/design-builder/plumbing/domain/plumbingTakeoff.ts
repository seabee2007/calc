import type {
  PipeStockLengthKind,
  PipeStockLengthPreset,
  PlumbingLegendItem,
  PlumbingMaterial,
  PlumbingPipeSchedule,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSystem,
} from '../plumbingTypes';
import type { PlumbingFitting, PlumbingFittingType } from '../plumbingFittingTypes';

const SYSTEM_LABELS: Record<PlumbingRunSystem, string> = {
  cold_water: 'CW',
  hot_water: 'HW',
  sanitary: 'Sanitary',
  vent: 'Vent',
};

const SYSTEM_SHORT_LABELS: Record<PlumbingRunSystem, string> = {
  cold_water: 'CW',
  hot_water: 'HW',
  sanitary: 'SS',
  vent: 'V',
};

export function formatPipeDiameter(diameterInches: number | null | undefined): string {
  if (diameterInches == null || !Number.isFinite(diameterInches)) return '';
  return Number.isInteger(diameterInches) ? `${diameterInches}"` : `${diameterInches}"`;
}

export function formatPlumbingRunLabel(run: PlumbingRun): string {
  const diameter = formatPipeDiameter(run.diameterInches);
  const system = SYSTEM_SHORT_LABELS[run.system];
  const slope =
    run.system === 'sanitary' && run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt)
      ? ` @ ${run.slopeInPerFt}"/FT`
      : '';
  return [diameter, system].filter(Boolean).join(' ') + slope;
}

export function buildPlumbingLegend(system: PlumbingSystem): PlumbingLegendItem[] {
  const items: PlumbingLegendItem[] = [];
  const systems = new Set<PlumbingRunSystem>();
  system.runs.forEach((run) => systems.add(run.system));
  system.nodes.forEach((node) => systems.add(node.system));
  (['cold_water', 'hot_water', 'sanitary', 'vent'] as PlumbingRunSystem[]).forEach((runSystem) => {
    if (systems.has(runSystem)) {
      items.push({
        key: runSystem,
        label: SYSTEM_LABELS[runSystem],
        system: runSystem,
      });
    }
  });
  if (system.nodes.some((node) => node.kind === 'cleanout') || system.equipment.some((item) => item.equipmentType === 'cleanout')) {
    items.push({ key: 'cleanout', label: 'CO/FCO', component: 'cleanout' });
  }
  if (system.nodes.some((node) => node.kind === 'valve') || system.equipment.some((item) => item.equipmentType === 'shutoff_valve')) {
    items.push({ key: 'valve', label: 'Valve', component: 'valve' });
  }
  if (system.nodes.some((node) => node.kind === 'stack') || system.equipment.some((item) => item.equipmentType.includes('stack'))) {
    items.push({ key: 'stack', label: 'Stack', component: 'stack' });
  }
  return items;
}

export function buildPlumbingFixtureScheduleRows(system: PlumbingSystem) {
  return system.fixtures
    .map((fixture) => ({
      fixtureId: fixture.id,
      mark: fixture.mark,
      fixtureType: fixture.fixtureType,
      displayName: fixture.displayName,
      coldWater: (fixture.connectionNodeIds.cold_water?.length ?? 0) > 0,
      hotWater: (fixture.connectionNodeIds.hot_water?.length ?? 0) > 0,
      sanitary: (fixture.connectionNodeIds.sanitary?.length ?? 0) > 0,
      vent: (fixture.connectionNodeIds.vent?.length ?? 0) > 0,
      xMeters: fixture.position.x,
      zMeters: fixture.position.z,
    }))
    .sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}

export type PlumbingPipeTakeoffRow = {
  id: string;
  system: PlumbingRunSystem;
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  diameterInches: number | null;
  stockLengthFt: number;
  stockLengthPreset: PipeStockLengthPreset;
  stockLengthKind: PipeStockLengthKind;
  totalLengthFt: number;
  stockCount: number;
  wasteFt: number;
};

export type PlumbingFittingTakeoffRow = {
  id: string;
  type: PlumbingFittingType;
  system: PlumbingFitting['system'];
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  diameterInches: number | null;
  count: number;
};

function distanceMeters(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function plumbingRunLengthMeters(run: PlumbingRun): number {
  let total = 0;
  for (let index = 1; index < run.path.length; index += 1) {
    const previous = run.path[index - 1];
    const current = run.path[index];
    if (previous && current) total += distanceMeters(previous, current);
  }
  return total;
}

export function plumbingRunLengthFt(run: PlumbingRun): number {
  return plumbingRunLengthMeters(run) * 3.280839895;
}

export function generatePlumbingPipeTakeoff(system: PlumbingSystem): PlumbingPipeTakeoffRow[] {
  const rows = new Map<string, PlumbingPipeTakeoffRow>();
  system.runs.forEach((run) => {
    const stockLengthFt = run.stockLengthFt > 0 ? run.stockLengthFt : 0;
    const key = [
      run.system,
      run.material,
      run.schedule ?? '',
      run.diameterInches ?? '',
      stockLengthFt,
      run.stockLengthKind,
    ].join('|');
    const totalLengthFt = plumbingRunLengthFt(run);
    const existing = rows.get(key);
    if (existing) {
      existing.totalLengthFt += totalLengthFt;
      existing.stockCount = stockLengthFt > 0 ? Math.ceil(existing.totalLengthFt / stockLengthFt) : 0;
      existing.wasteFt = existing.stockCount * stockLengthFt - existing.totalLengthFt;
      return;
    }
    const stockCount = stockLengthFt > 0 ? Math.ceil(totalLengthFt / stockLengthFt) : 0;
    rows.set(key, {
      id: key,
      system: run.system,
      material: run.material,
      schedule: run.schedule,
      diameterInches: run.diameterInches,
      stockLengthFt,
      stockLengthPreset: run.stockLengthPreset,
      stockLengthKind: run.stockLengthKind,
      totalLengthFt,
      stockCount,
      wasteFt: stockCount * stockLengthFt - totalLengthFt,
    });
  });
  return [...rows.values()];
}

export function generatePlumbingFittingTakeoff(system: PlumbingSystem): PlumbingFittingTakeoffRow[] {
  const rows = new Map<string, PlumbingFittingTakeoffRow>();
  (system.fittings ?? []).forEach((fitting) => {
    const key = [
      fitting.system,
      fitting.material,
      fitting.schedule ?? '',
      fitting.diameterInches ?? '',
      fitting.type,
    ].join('|');
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    rows.set(key, {
      id: key,
      type: fitting.type,
      system: fitting.system,
      material: fitting.material,
      schedule: fitting.schedule,
      diameterInches: fitting.diameterInches,
      count: 1,
    });
  });
  return [...rows.values()];
}
