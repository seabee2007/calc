import * as THREE from 'three';
import type { PlumbingSelection, PlumbingSystem } from '../plumbingTypes';
import { createCmuSepticTankMesh } from '../septic/three/createCmuSepticTankMesh';
import { createPipeTubeMesh } from './createPipeTubeMesh';
import { createPlumbingRiserMesh } from './createPlumbingRiserMesh';
import { createProceduralPlumbingEquipmentMesh } from './createProceduralPlumbingEquipmentMesh';
import { createProceduralPlumbingFittingMesh } from './createProceduralPlumbingFittingMesh';
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
      const position = resolvePlumbingEquipmentPosition({
        equipment,
        defaults: elevationDefaults,
      });
      const equipmentGroup = createProceduralPlumbingEquipmentMesh({
        equipment,
        position,
        elevationDefaults,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_equipment', equipment.id),
        trackGeometry: params.trackGeometry,
      });
      if (equipment.equipmentType === 'distribution_box') {
        const target = resolvedPipeConnectionPointForEquipment({
          plumbingSystem: params.plumbingSystem,
          equipmentNodeIds: equipment.connectionNodeIds,
          resolvedRunPaths,
        });
        const ports = equipmentGroup.userData.ports as ConnectorPort[] | undefined;
        const port = ports?.find((candidate) => candidate.id === 'pipe_centerline');
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
