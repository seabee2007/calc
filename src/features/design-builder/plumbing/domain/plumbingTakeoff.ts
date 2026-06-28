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
import {
  getRenderableSolvedPlumbingFittings,
  isLegacyAutoSolvedSanitaryCoupling,
  solvePlumbingModel,
  type SolvedPlumbingModel,
} from './plumbingModelSolver';

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
  pipePieces: PlumbingPipePieceTakeoff[];
};

export type PlumbingFittingTakeoffRow = {
  id: string;
  type: PlumbingFittingType;
  system: PlumbingFitting['system'];
  material: PlumbingMaterial;
  schedule?: PlumbingPipeSchedule;
  diameterInches: number | null;
  secondaryDiameterInches?: number | null;
  description: string;
  count: number;
};

export type PlumbingPipePieceTakeoff = {
  material: PlumbingMaterial;
  diameterInches: number | null;
  lengthFt: number;
  sourceRunId: string;
  cutPiece: boolean;
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

function plumbingFittingDescription(fitting: PlumbingFitting): string {
  const primary = formatPipeDiameter(fitting.diameterInches);
  const secondary = formatPipeDiameter(fitting.secondaryDiameterInches);
  const typeLabel = fitting.type === 'wye'
    ? 'sanitary wye'
    : fitting.type.replace(/_/g, ' ');
  if (fitting.type === 'wye' && primary && secondary && secondary !== primary) {
    return `${primary} x ${primary} x ${secondary} ${typeLabel}`;
  }
  if (primary) return `${primary} ${typeLabel}`;
  return typeLabel;
}

function distanceAlongRunMeters(run: PlumbingRun, point: PlumbingPoint3D): number | null {
  let traversed = 0;
  for (let index = 1; index < run.path.length; index += 1) {
    const previous = run.path[index - 1];
    const current = run.path[index];
    if (!previous || !current) continue;
    const segmentLength = distanceMeters(previous, current);
    if (segmentLength <= 0.0001) continue;
    const candidateLength = distanceMeters(previous, point) + distanceMeters(point, current);
    if (Math.abs(candidateLength - segmentLength) <= 0.02) {
      return traversed + distanceMeters(previous, point);
    }
    traversed += segmentLength;
  }
  return null;
}

function solvedPipePiecesForRun(system: PlumbingSystem, run: PlumbingRun): PlumbingPipePieceTakeoff[] {
  const totalLengthMeters = plumbingRunLengthMeters(run);
  const couplerDistances = (system.fittings ?? [])
    .filter((fitting) => fitting.type === 'coupling' && fitting.connectedRunIds.includes(run.id))
    .map((fitting) => system.nodes.find((node) => node.id === fitting.nodeId)?.position)
    .filter((point): point is PlumbingPoint3D => Boolean(point))
    .map((point) => distanceAlongRunMeters(run, point))
    .filter((distance): distance is number =>
      distance != null &&
      distance > 0.001 &&
      distance < totalLengthMeters - 0.001)
    .sort((a, b) => a - b)
    .filter((distance, index, distances) => index === 0 || Math.abs(distance - distances[index - 1]!) > 0.001);
  const cutPoints = [0, ...couplerDistances, totalLengthMeters];
  const stockLengthFt = run.stockLengthFt > 0 ? run.stockLengthFt : 0;
  const pieces: PlumbingPipePieceTakeoff[] = [];
  for (let index = 1; index < cutPoints.length; index += 1) {
    const lengthFt = (cutPoints[index]! - cutPoints[index - 1]!) * 3.280839895;
    if (lengthFt <= 0.001) continue;
    pieces.push({
      material: run.material,
      diameterInches: run.diameterInches,
      lengthFt,
      sourceRunId: run.id,
      cutPiece: stockLengthFt > 0 && lengthFt < stockLengthFt - 0.001,
    });
  }
  return pieces;
}

function isRunSolvedByModel(run: PlumbingRun, solvedModel: SolvedPlumbingModel): boolean {
  return solvedModel.pipePieces.some((piece) => piece.sourceRunId === run.id);
}

export function generatePlumbingPipeTakeoff(
  system: PlumbingSystem,
  solvedModel: SolvedPlumbingModel = solvePlumbingModel(system),
): PlumbingPipeTakeoffRow[] {
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
    const pipePieces = isRunSolvedByModel(run, solvedModel)
      ? solvedModel.pipePieces
        .filter((piece) => piece.sourceRunId === run.id)
        .map((piece) => ({
          material: piece.material,
          diameterInches: piece.diameterInches,
          lengthFt: piece.lengthFt,
          sourceRunId: piece.sourceRunId,
          cutPiece: stockLengthFt > 0 && piece.lengthFt < stockLengthFt - 0.001,
        }))
      : solvedPipePiecesForRun(system, run);
    const totalLengthFt = pipePieces.reduce((total, piece) => total + piece.lengthFt, 0);
    const existing = rows.get(key);
    if (existing) {
      existing.totalLengthFt += totalLengthFt;
      existing.stockCount = stockLengthFt > 0 ? Math.ceil(existing.totalLengthFt / stockLengthFt) : 0;
      existing.wasteFt = existing.stockCount * stockLengthFt - existing.totalLengthFt;
      existing.pipePieces.push(...pipePieces);
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
      pipePieces,
    });
  });
  return [...rows.values()];
}

function solvedFittingDescription(fitting: SolvedPlumbingModel['fittings'][number]): string {
  return plumbingFittingDescription({
    id: fitting.sourceFittingId ?? fitting.id,
    type: fitting.type,
    system: fitting.system,
    nodeId: fitting.id,
    connectedRunIds: fitting.connectedPipePieceIds,
    diameterInches: fitting.diameterInches,
    secondaryDiameterInches: fitting.secondaryDiameterInches,
    material: fitting.material,
    schedule: fitting.schedule,
    rotationRad: 0,
    elevationMode: 'under_slab',
    labelVisible: true,
    isAutoGenerated: fitting.isAutoSolved,
  });
}

export function generatePlumbingFittingTakeoff(
  system: PlumbingSystem,
  solvedModel: SolvedPlumbingModel = solvePlumbingModel(system),
): PlumbingFittingTakeoffRow[] {
  const rows = new Map<string, PlumbingFittingTakeoffRow>();
  const visibleSolvedFittings = getRenderableSolvedPlumbingFittings(solvedModel);

  const addRow = (params: {
    type: PlumbingFittingType;
    system: PlumbingFitting['system'];
    material: PlumbingFitting['material'];
    schedule?: PlumbingFitting['schedule'];
    diameterInches: PlumbingFitting['diameterInches'];
    secondaryDiameterInches?: PlumbingFitting['secondaryDiameterInches'];
    description: string;
  }) => {
    const key = [
      params.system,
      params.material,
      params.schedule ?? '',
      params.diameterInches ?? '',
      params.secondaryDiameterInches ?? '',
      params.type,
    ].join('|');
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    rows.set(key, {
      id: key,
      type: params.type,
      system: params.system,
      material: params.material,
      schedule: params.schedule,
      diameterInches: params.diameterInches,
      secondaryDiameterInches: params.secondaryDiameterInches,
      description: params.description,
      count: 1,
    });
  };

  visibleSolvedFittings.forEach((fitting) => {
    addRow({
      type: fitting.type,
      system: fitting.system,
      material: fitting.material,
      schedule: fitting.schedule,
      diameterInches: fitting.diameterInches,
      secondaryDiameterInches: fitting.secondaryDiameterInches,
      description: solvedFittingDescription(fitting),
    });
  });

  (system.fittings ?? []).forEach((fitting) => {
    if (solvedModel.consumedPersistedFittingIds.has(fitting.id)) return;
    if (isLegacyAutoSolvedSanitaryCoupling(fitting)) return;
    addRow({
      type: fitting.type,
      system: fitting.system,
      material: fitting.material,
      schedule: fitting.schedule,
      diameterInches: fitting.diameterInches,
      secondaryDiameterInches: fitting.secondaryDiameterInches,
      description: plumbingFittingDescription(fitting),
    });
  });
  return [...rows.values()];
}
