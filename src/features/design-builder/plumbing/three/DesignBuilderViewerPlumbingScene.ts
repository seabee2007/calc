import * as THREE from 'three';
import type { PlumbingSelection, PlumbingSystem } from '../plumbingTypes';
import {
  getRenderableSolvedPlumbingFittings,
  isLegacyAutoSolvedSanitaryCoupling,
  solvePlumbingModel,
  type SolvedPipePiece,
  type SolvedPlumbingFitting,
  type SolvedPlumbingModel,
} from '../domain/plumbingModelSolver';
import { createCmuSepticTankMesh } from '../septic/three/createCmuSepticTankMesh';
import { createPipeTubeMesh } from './createPipeTubeMesh';
import { createPlumbingRiserMesh } from './createPlumbingRiserMesh';
import { createProceduralPlumbingEquipmentMesh } from './createProceduralPlumbingEquipmentMesh';
import {
  createProceduralPlumbingFittingMesh,
  createProceduralSolvedPlumbingFittingMesh,
} from './createProceduralPlumbingFittingMesh';
import { createProceduralPlumbingFixtureMesh } from './createProceduralPlumbingFixtureMesh';
import {
  defaultPlumbingElevationDefaults,
  resolvePlumbingEquipmentPosition,
  resolvePlumbingFittingPosition,
  resolvePlumbingFixturePosition,
  resolvePlumbingRunPath,
  type PlumbingElevationDefaults,
  type ResolvedPlumbingRunPath,
} from './plumbingElevationResolver';
import {
  createPlumbingThreeMaterials,
  materialForPlumbingRunSystem,
} from './plumbingThreeMaterials';
import {
  createPlumbingTextLabel,
  formatPlumbingThreeEquipmentLabel,
  formatPlumbingThreeFittingLabel,
  formatPlumbingThreeFixtureLabel,
  formatPlumbingThreeRunLabel,
} from './plumbingThreeLabels';
import {
  DEFAULT_PLUMBING_3D_VISIBILITY,
  alignObjectPortToWorldPoint,
  createCylinderBetween,
  diameterInchesToVisualRadiusMeters,
  equipmentVisible,
  fittingVisible,
  fixtureVisible,
  markPlumbingObject3D,
  normalizePlumbing3DVisibility,
  runVisible,
  selectionMatchesPlumbingObject,
  vectorFromPoint,
  type ConnectorPort,
  type Plumbing3DValidationIssue,
  type Plumbing3DVisibility,
  type TrackGeometry,
  type TrackMaterial,
} from './plumbingThreeUtils';

export type DesignBuilderViewerPlumbingSceneResult = {
  group: THREE.Group;
  selectableObjects: THREE.Object3D[];
  validationIssues: Plumbing3DValidationIssue[];
};

export type DesignBuilderViewerPlumbingSceneParams = {
  plumbingSystem: PlumbingSystem;
  selectedPlumbingObject?: PlumbingSelection | null;
  selectedSepticTankId?: string | null;
  visibility?: Partial<Plumbing3DVisibility> | null;
  elevationDefaults?: Partial<PlumbingElevationDefaults>;
  trackGeometry?: TrackGeometry;
  trackMaterial?: TrackMaterial;
};

const DBOX_LENGTH_M = 0.48;

function labelPoint(points: readonly { x: number; y: number; z: number }[]): THREE.Vector3 {
  if (points.length === 0) return new THREE.Vector3();
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
      z: sum.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return new THREE.Vector3(total.x / points.length, total.y / points.length + 0.18, total.z / points.length);
}

function appendIssue(
  issues: Plumbing3DValidationIssue[],
  params: Omit<Plumbing3DValidationIssue, 'severity'> & { severity?: Plumbing3DValidationIssue['severity'] },
): void {
  issues.push({
    severity: params.severity ?? 'warning',
    ...params,
  });
}

function addLabelToGroup(params: {
  parent: THREE.Group;
  text: string;
  position: THREE.Vector3;
  trackMaterial?: TrackMaterial;
}): void {
  if (!params.text.trim()) return;
  params.parent.add(createPlumbingTextLabel({
    text: params.text,
    position: params.position,
    trackMaterial: params.trackMaterial,
  }));
}

function fittingCentersForRun(params: {
  plumbingSystem: PlumbingSystem;
  resolvedRunPaths: readonly ResolvedPlumbingRunPath[];
  runId: string;
  elevationDefaults: PlumbingElevationDefaults;
}): THREE.Vector3[] {
  return (params.plumbingSystem.fittings ?? [])
    .filter((fitting) => fitting.connectedRunIds.includes(params.runId))
    .map((fitting) => resolvePlumbingFittingPosition({
      system: params.plumbingSystem,
      fitting,
      defaults: params.elevationDefaults,
      resolvedRunPaths: params.resolvedRunPaths,
    }).position)
    .map((position) => new THREE.Vector3(position.x, position.y, position.z));
}

function equipmentConnectionPointForRun(params: {
  plumbingSystem: PlumbingSystem;
  resolvedRunPath: ResolvedPlumbingRunPath;
  runId: string;
}): THREE.Vector3[] {
  const run = params.plumbingSystem.runs.find((candidate) => candidate.id === params.runId);
  if (!run) return [];
  const equipmentNodeIds = new Set(
    params.plumbingSystem.equipment
      .filter((equipment) =>
        equipment.equipmentType === 'distribution_box' ||
        equipment.equipmentType === 'building_drain_exit' ||
        equipment.equipmentType === 'cleanout')
      .flatMap((equipment) => equipment.connectionNodeIds),
  );
  const points: THREE.Vector3[] = [];
  if (equipmentNodeIds.has(run.startNodeId) && params.resolvedRunPath.points[0]) {
    points.push(vectorFromPoint(params.resolvedRunPath.points[0]));
  }
  if (equipmentNodeIds.has(run.endNodeId) && params.resolvedRunPath.points[params.resolvedRunPath.points.length - 1]) {
    points.push(vectorFromPoint(params.resolvedRunPath.points[params.resolvedRunPath.points.length - 1]!));
  }
  return points;
}

function resolvedPipeConnectionPointForEquipment(params: {
  plumbingSystem: PlumbingSystem;
  equipmentNodeIds: readonly string[];
  resolvedRunPaths: readonly ResolvedPlumbingRunPath[];
}): THREE.Vector3 | null {
  const nodeIds = new Set(params.equipmentNodeIds);
  const incoming = params.plumbingSystem.runs.find((run) => run.system === 'sanitary' && nodeIds.has(run.endNodeId));
  if (incoming) {
    const path = params.resolvedRunPaths.find((candidate) => candidate.runId === incoming.id);
    const point = path?.points[path.points.length - 1];
    if (point) return vectorFromPoint(point);
  }
  const outgoing = params.plumbingSystem.runs.find((run) => run.system === 'sanitary' && nodeIds.has(run.startNodeId));
  if (outgoing) {
    const path = params.resolvedRunPaths.find((candidate) => candidate.runId === outgoing.id);
    const point = path?.points[0];
    if (point) return vectorFromPoint(point);
  }
  return null;
}

function mapSolvedIssueTo3D(issue: SolvedPlumbingModel['validationIssues'][number]): Plumbing3DValidationIssue {
  return {
    code: 'solved_plumbing_model_issue',
    severity: issue.severity === 'error' ? 'error' : 'warning',
    objectType: issue.objectKind === 'run'
      ? 'plumbing_run'
      : issue.objectKind === 'fitting'
        ? 'plumbing_fitting'
        : issue.objectKind === 'equipment'
          ? 'plumbing_equipment'
          : undefined,
    objectId: issue.objectId,
    message: issue.message,
  };
}

function createSolvedPipePiecesGroup(params: {
  runId: string;
  system: PlumbingSystem;
  pieces: readonly SolvedPipePiece[];
  materials: ReturnType<typeof createPlumbingThreeMaterials>;
  selected: boolean;
  trackGeometry?: TrackGeometry;
  showCenterline?: boolean;
}): THREE.Group {
  const run = params.system.runs.find((candidate) => candidate.id === params.runId);
  const group = new THREE.Group();
  group.name = `plumbing_run:${params.runId}`;
  group.userData.system = run?.system ?? 'sanitary';
  group.userData.elevationMode = run?.elevationMode ?? 'under_slab';
  const material = params.selected
    ? params.materials.selected
    : run
      ? materialForPlumbingRunSystem(run.system, params.materials)
      : params.materials.sanitary;

  params.pieces.forEach((piece, index) => {
    const start = vectorFromPoint(piece.start);
    const end = vectorFromPoint(piece.end);
    const mesh = createCylinderBetween({
      name: `pipe segment ${index + 1}`,
      start,
      end,
      radius: diameterInchesToVisualRadiusMeters(piece.diameterInches),
      material,
      trackGeometry: params.trackGeometry,
      radialSegments: 12,
    });
    if (mesh) {
      mesh.userData.solvedPipePieceId = piece.id;
      group.add(mesh);
    }
    if (params.showCenterline) {
      const geometry = params.trackGeometry?.(
        new THREE.BufferGeometry().setFromPoints([start, end]),
      ) ?? new THREE.BufferGeometry().setFromPoints([start, end]);
      const centerline = new THREE.Line(geometry, params.materials.centerline);
      centerline.name = index === 0 ? 'plumbing run centerline' : `plumbing run centerline ${index + 1}`;
      group.add(centerline);
    }
  });

  if (group.children.length === 0) {
    const point = params.pieces[0]?.start ?? { x: 0, y: 0, z: 0 };
    const marker = new THREE.Mesh(
      params.trackGeometry?.(new THREE.SphereGeometry(0.05, 12, 8)) ?? new THREE.SphereGeometry(0.05, 12, 8),
      params.materials.warning,
    );
    marker.name = 'invalid solved pipe marker';
    marker.position.set(point.x, point.y, point.z);
    group.add(marker);
  }

  return markPlumbingObject3D({
    group,
    objectType: 'plumbing_run',
    objectId: params.runId,
    selectionPriority: 74,
  }) as THREE.Group;
}

function createSolvedFittingPortMarkers(params: {
  fittings: readonly SolvedPlumbingFitting[];
  materials: ReturnType<typeof createPlumbingThreeMaterials>;
  trackGeometry?: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plumbing_solved_fitting_ports';
  params.fittings.forEach((fitting) => {
    fitting.ports.forEach((port) => {
      const center = vectorFromPoint(port.center);
      const direction = new THREE.Vector3(port.direction.x, port.direction.y, port.direction.z);
      if (direction.lengthSq() <= 0.000001) direction.set(1, 0, 0);
      direction.normalize();
      const marker = new THREE.Mesh(
        params.trackGeometry?.(new THREE.SphereGeometry(port.id === 'branch' ? 0.045 : 0.032, 10, 8)) ??
          new THREE.SphereGeometry(port.id === 'branch' ? 0.045 : 0.032, 10, 8),
        port.id === 'branch' ? params.materials.warning : params.materials.centerline,
      );
      marker.name = `solved fitting port:${fitting.id}:${port.id}`;
      marker.position.copy(center);
      group.add(marker);
      const axis = createCylinderBetween({
        name: `solved fitting port direction:${fitting.id}:${port.id}`,
        start: center,
        end: center.clone().addScaledVector(direction, 0.18),
        radius: 0.008,
        material: port.id === 'branch' ? params.materials.warning : params.materials.centerline,
        trackGeometry: params.trackGeometry,
        radialSegments: 8,
      });
      if (axis) group.add(axis);
    });
  });
  return group;
}

function rotateDBoxLocalOffset(point: { x: number; y: number; z: number }, rotationRadians: number): THREE.Vector3 {
  const radians = Number.isFinite(rotationRadians) ? -rotationRadians : 0;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new THREE.Vector3(
    point.x * cos - point.z * sin,
    point.y,
    point.x * sin + point.z * cos,
  );
}

function dboxPortLocalOffset(portId: string, rotationRadians: number): THREE.Vector3 | null {
  if (portId === 'inlet') return rotateDBoxLocalOffset({ x: -DBOX_LENGTH_M / 2, y: 0, z: 0 }, rotationRadians);
  if (portId === 'outlet') return rotateDBoxLocalOffset({ x: DBOX_LENGTH_M / 2, y: 0, z: 0 }, rotationRadians);
  return null;
}

function dboxRotationFromSolvedConnections(
  solvedConnections: SolvedPlumbingModel['equipment'],
  fallback: number,
): number {
  const outletPort = solvedConnections
    .flatMap((connection) => connection.ports ?? [])
    .find((port) => port.id === 'outlet');
  if (outletPort) return Math.atan2(-outletPort.direction.z, outletPort.direction.x);

  const inletPort = solvedConnections
    .flatMap((connection) => connection.ports ?? [])
    .find((port) => port.id === 'inlet');
  if (inletPort) return Math.atan2(inletPort.direction.z, -inletPort.direction.x);

  return fallback;
}

function solvedDistributionBoxPosition(params: {
  equipmentId: string;
  rotationRadians: number;
  solvedModel: SolvedPlumbingModel;
  fallback: { x: number; y: number; z: number };
}): { x: number; y: number; z: number; rotationRadians: number; solvedConnections: SolvedPlumbingModel['equipment'] } {
  const solvedConnections = params.solvedModel.equipment.filter((connection) =>
    connection.equipmentId === params.equipmentId &&
    (connection.portId === 'inlet' || connection.portId === 'outlet'));
  const rotationRadians = dboxRotationFromSolvedConnections(solvedConnections, params.rotationRadians);
  const centers = solvedConnections
    .map((connection) => {
      const offset = dboxPortLocalOffset(connection.portId, rotationRadians);
      if (!offset) return null;
      return new THREE.Vector3(
        connection.position.x - offset.x,
        connection.position.y - offset.y,
        connection.position.z - offset.z,
      );
    })
    .filter((center): center is THREE.Vector3 => Boolean(center));
  if (centers.length === 0) {
    return { ...params.fallback, rotationRadians, solvedConnections };
  }
  const center = centers.reduce((sum, item) => sum.add(item), new THREE.Vector3()).multiplyScalar(1 / centers.length);
  return {
    x: center.x,
    y: center.y,
    z: center.z,
    rotationRadians,
    solvedConnections,
  };
}

export function buildDesignBuilderViewerPlumbingScene(
  params: DesignBuilderViewerPlumbingSceneParams,
): DesignBuilderViewerPlumbingSceneResult {
  const group = new THREE.Group();
  group.name = 'PlumbingSystem3D';
  const selectableObjects: THREE.Object3D[] = [];
  const validationIssues: Plumbing3DValidationIssue[] = [];
  const visibility = normalizePlumbing3DVisibility(params.visibility ?? DEFAULT_PLUMBING_3D_VISIBILITY);
  const elevationDefaults: PlumbingElevationDefaults = {
    ...defaultPlumbingElevationDefaults,
    ...(params.elevationDefaults ?? {}),
  };
  const materials = createPlumbingThreeMaterials(params.trackMaterial);

  if (!visibility.showPlumbing) {
    return { group, selectableObjects, validationIssues };
  }

  const riserRunIds = new Set((params.plumbingSystem.roughIns ?? []).map((roughIn) => roughIn.riserRunId));
  const solvedModel = solvePlumbingModel(params.plumbingSystem, { elevationDefaults });
  const visibleSolvedFittings = getRenderableSolvedPlumbingFittings(solvedModel);
  validationIssues.push(...solvedModel.validationIssues.map(mapSolvedIssueTo3D));
  const solvedPipePiecesByRunId = new Map<string, SolvedPipePiece[]>();
  solvedModel.pipePieces.forEach((piece) => {
    const pieces = solvedPipePiecesByRunId.get(piece.sourceRunId) ?? [];
    pieces.push(piece);
    solvedPipePiecesByRunId.set(piece.sourceRunId, pieces);
  });
  const resolvedRunPaths = params.plumbingSystem.runs.map((run) => resolvePlumbingRunPath({
    system: params.plumbingSystem,
    run,
    defaults: elevationDefaults,
  }));
  const resolvedRunPathById = new Map(resolvedRunPaths.map((path) => [path.runId, path]));

  params.plumbingSystem.runs.forEach((run) => {
    if (riserRunIds.has(run.id)) return;
    if (!runVisible(run, visibility)) return;
    try {
      if (run.system === 'sanitary' && run.elevationMode === 'under_slab') {
        const solvedPieces = solvedPipePiecesByRunId.get(run.id) ?? [];
        const pipeGroup = createSolvedPipePiecesGroup({
          runId: run.id,
          system: params.plumbingSystem,
          pieces: solvedPieces,
          materials,
          selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_run', run.id),
          trackGeometry: params.trackGeometry,
          showCenterline: visibility.showCenterlines,
        });
        group.add(pipeGroup);
        selectableObjects.push(pipeGroup);
        if (visibility.showLabels && run.labelVisible && solvedPieces.length > 0) {
          addLabelToGroup({
            parent: pipeGroup,
            text: formatPlumbingThreeRunLabel(run),
            position: labelPoint(solvedPieces.flatMap((piece) => [piece.start, piece.end])),
            trackMaterial: params.trackMaterial,
          });
        }
        return;
      }
      const resolvedPath = resolvedRunPathById.get(run.id) ?? resolvePlumbingRunPath({
        system: params.plumbingSystem,
        run,
        defaults: elevationDefaults,
      });
      validationIssues.push(...resolvedPath.validationIssues);
      const pipeGroup = createPipeTubeMesh({
        run,
        resolvedPath,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_run', run.id),
        trackGeometry: params.trackGeometry,
        fittingCenters: fittingCentersForRun({
          plumbingSystem: params.plumbingSystem,
          resolvedRunPaths,
          runId: run.id,
          elevationDefaults,
        }),
        penetrationTargets: equipmentConnectionPointForRun({
          plumbingSystem: params.plumbingSystem,
          resolvedRunPath: resolvedPath,
          runId: run.id,
        }),
        showCenterline: visibility.showCenterlines,
      });
      group.add(pipeGroup);
      selectableObjects.push(pipeGroup);
      if (visibility.showLabels && run.labelVisible) {
        addLabelToGroup({
          parent: pipeGroup,
          text: formatPlumbingThreeRunLabel(run),
          position: labelPoint(resolvedPath.points),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_run',
        objectId: run.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Pipe run failed to render.',
      });
    }
  });

  visibleSolvedFittings.forEach((fitting) => {
    if (!visibility.showPlumbing || !visibility.showFittings || !visibility.showDrain) return;
    if (!visibility.showUnderground) return;
    try {
      const fittingScene = createProceduralSolvedPlumbingFittingMesh({
        fitting,
        materials,
        selected: selectionMatchesPlumbingObject(
          params.selectedPlumbingObject,
          'plumbing_fitting',
          fitting.sourceFittingId ?? fitting.id,
        ),
        trackGeometry: params.trackGeometry,
        showCenterline: visibility.showCenterlines,
      });
      validationIssues.push(...fittingScene.validationIssues);
      group.add(fittingScene.group);
      selectableObjects.push(fittingScene.group);
      if (visibility.showLabels) {
        addLabelToGroup({
          parent: fittingScene.group,
          text: fitting.type.replace(/_/g, ' '),
          position: new THREE.Vector3(0, 0.22, 0),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_fitting',
        objectId: fitting.sourceFittingId ?? fitting.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Solved fitting failed to render.',
      });
    }
  });

  if (visibility.showSolvedFittingPorts && visibleSolvedFittings.length > 0) {
    group.add(createSolvedFittingPortMarkers({
      fittings: visibleSolvedFittings,
      materials,
      trackGeometry: params.trackGeometry,
    }));
  }

  (params.plumbingSystem.roughIns ?? []).forEach((roughIn) => {
    const run = params.plumbingSystem.runs.find((candidate) => candidate.id === roughIn.riserRunId);
    if (!run || !runVisible(run, visibility)) return;
    try {
      const resolvedPath = resolvedRunPathById.get(run.id) ?? resolvePlumbingRunPath({
        system: params.plumbingSystem,
        run,
        defaults: elevationDefaults,
      });
      validationIssues.push(...resolvedPath.validationIssues);
      const roughInGroup = createPlumbingRiserMesh({
        roughIn,
        run,
        resolvedPath,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_rough_in', roughIn.id),
        trackGeometry: params.trackGeometry,
        showCenterline: visibility.showCenterlines,
        finishedFloorY: elevationDefaults.slabTopElevationM,
        fittingCenters: fittingCentersForRun({
          plumbingSystem: params.plumbingSystem,
          resolvedRunPaths,
          runId: run.id,
          elevationDefaults,
        }),
      });
      group.add(roughInGroup);
      selectableObjects.push(roughInGroup);
      if (visibility.showLabels && roughIn.labelVisible) {
        addLabelToGroup({
          parent: roughInGroup,
          text: formatPlumbingThreeRunLabel(run),
          position: labelPoint(resolvedPath.points),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_rough_in',
        objectId: roughIn.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Rough-in riser failed to render.',
      });
    }
  });

  (params.plumbingSystem.fittings ?? []).forEach((fitting) => {
    if (
      solvedModel.consumedPersistedFittingIds.has(fitting.id) ||
      isLegacyAutoSolvedSanitaryCoupling(fitting)
    ) {
      return;
    }
    if (!fittingVisible(fitting, visibility)) return;
    try {
      const resolved = resolvePlumbingFittingPosition({
        system: params.plumbingSystem,
        fitting,
        defaults: elevationDefaults,
        resolvedRunPaths,
      });
      validationIssues.push(...resolved.validationIssues);
      const fittingScene = createProceduralPlumbingFittingMesh({
        fitting,
        position: resolved.position,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_fitting', fitting.id),
        trackGeometry: params.trackGeometry,
        runs: params.plumbingSystem.runs,
        nodes: params.plumbingSystem.nodes,
        resolvedRunPaths,
        showCenterline: visibility.showCenterlines,
      });
      validationIssues.push(...fittingScene.validationIssues);
      group.add(fittingScene.group);
      selectableObjects.push(fittingScene.group);
      if (
        visibility.showLabels &&
        (fitting.labelVisible || selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_fitting', fitting.id))
      ) {
        addLabelToGroup({
          parent: fittingScene.group,
          text: formatPlumbingThreeFittingLabel(fitting),
          position: new THREE.Vector3(0, 0.22, 0),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_fitting',
        objectId: fitting.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Fitting failed to render.',
      });
    }
  });

  params.plumbingSystem.fixtures.forEach((fixture) => {
    if (!fixtureVisible(fixture, visibility)) return;
    try {
      const position = resolvePlumbingFixturePosition({
        fixture,
        defaults: elevationDefaults,
      });
      const fixtureScene = createProceduralPlumbingFixtureMesh({
        fixture,
        position,
        finishedFloorY: elevationDefaults.slabTopElevationM,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_fixture', fixture.id),
        trackGeometry: params.trackGeometry,
      });
      validationIssues.push(...fixtureScene.validationIssues);
      group.add(fixtureScene.group);
      selectableObjects.push(fixtureScene.group);
      if (visibility.showLabels) {
        addLabelToGroup({
          parent: fixtureScene.group,
          text: formatPlumbingThreeFixtureLabel(fixture),
          position: new THREE.Vector3(0, 1.15, 0),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_fixture',
        objectId: fixture.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Fixture failed to render.',
      });
    }
  });

  params.plumbingSystem.equipment.forEach((equipment) => {
    if (!equipmentVisible(equipment, visibility)) return;
    try {
      const resolvedPosition = resolvePlumbingEquipmentPosition({
        equipment,
        defaults: elevationDefaults,
      });
      const dboxSolvedPosition = equipment.equipmentType === 'distribution_box'
        ? solvedDistributionBoxPosition({
          equipmentId: equipment.id,
          rotationRadians: equipment.rotationRadians,
          solvedModel,
          fallback: resolvedPosition,
        })
        : null;
      const position = dboxSolvedPosition ?? resolvedPosition;
      const renderEquipment = dboxSolvedPosition
        ? { ...equipment, rotationRadians: dboxSolvedPosition.rotationRadians }
        : equipment;
      const equipmentGroup = createProceduralPlumbingEquipmentMesh({
        equipment: renderEquipment,
        position,
        elevationDefaults,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_equipment', equipment.id),
        trackGeometry: params.trackGeometry,
      });
      if (equipment.equipmentType === 'distribution_box') {
        if (dboxSolvedPosition && dboxSolvedPosition.solvedConnections.length > 0) {
          equipmentGroup.userData.portAlignment = {
            mode: 'solved-equipment-ports',
            ports: dboxSolvedPosition.solvedConnections.map((connection) => ({
              portId: connection.portId,
              target: [connection.position.x, connection.position.y, connection.position.z],
            })),
          };
        } else {
          const target = resolvedPipeConnectionPointForEquipment({
            plumbingSystem: params.plumbingSystem,
            equipmentNodeIds: equipment.connectionNodeIds,
            resolvedRunPaths,
          });
          const ports = equipmentGroup.userData.ports as ConnectorPort[] | undefined;
          const port = ports?.find((candidate) => candidate.id === 'inlet');
          if (target && port) {
            const alignment = alignObjectPortToWorldPoint(equipmentGroup, port, target);
            if (alignment) {
              equipmentGroup.userData.portAlignment = {
                portId: port.id,
                before: alignment.before.toArray(),
                after: alignment.after.toArray(),
                target: alignment.target.toArray(),
              };
            }
          }
        }
      }
      group.add(equipmentGroup);
      selectableObjects.push(equipmentGroup);
      if (visibility.showLabels) {
        addLabelToGroup({
          parent: equipmentGroup,
          text: formatPlumbingThreeEquipmentLabel(equipment),
          position: new THREE.Vector3(0, 0.42, 0),
          trackMaterial: params.trackMaterial,
        });
      }
    } catch (error) {
      appendIssue(validationIssues, {
        code: 'plumbing_3d_object_render_failed',
        objectType: 'plumbing_equipment',
        objectId: equipment.id,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Equipment failed to render.',
      });
    }
  });

  if (visibility.showUnderground) {
    params.plumbingSystem.septicTanks.forEach((tank) => {
      try {
        const selected =
          params.selectedSepticTankId === tank.id ||
          selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'septic_tank', tank.id);
        const tankGroup = createCmuSepticTankMesh(tank, {
          selected,
          trackGeometry: params.trackGeometry,
          trackMaterial: params.trackMaterial,
        });
        markPlumbingObject3D({
          group: tankGroup,
          objectType: 'septic_tank',
          objectId: tank.id,
          selectionPriority: 78,
        });
        group.add(tankGroup);
        selectableObjects.push(tankGroup);
      } catch (error) {
        appendIssue(validationIssues, {
          code: 'plumbing_3d_object_render_failed',
          objectType: 'septic_tank',
          objectId: tank.id,
          severity: 'error',
          message: error instanceof Error ? error.message : 'Septic tank failed to render.',
        });
      }
    });
  }

  return { group, selectableObjects, validationIssues };
}
