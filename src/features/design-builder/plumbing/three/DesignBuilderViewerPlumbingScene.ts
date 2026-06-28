import * as THREE from 'three';
import type { PlumbingSelection, PlumbingSystem } from '../plumbingTypes';
import { createCmuSepticTankMesh } from '../septic/three/createCmuSepticTankMesh';
import { createPipeTubeMesh } from './createPipeTubeMesh';
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
  equipmentVisible,
  fittingVisible,
  fixtureVisible,
  markPlumbingObject3D,
  normalizePlumbing3DVisibility,
  runVisible,
  selectionMatchesPlumbingObject,
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

  params.plumbingSystem.runs.forEach((run) => {
    if (!runVisible(run, visibility)) return;
    try {
      const resolvedPath = resolvePlumbingRunPath({
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

  (params.plumbingSystem.fittings ?? []).forEach((fitting) => {
    if (!fittingVisible(fitting, visibility)) return;
    try {
      const resolved = resolvePlumbingFittingPosition({
        system: params.plumbingSystem,
        fitting,
        defaults: elevationDefaults,
      });
      validationIssues.push(...resolved.validationIssues);
      const fittingScene = createProceduralPlumbingFittingMesh({
        fitting,
        position: resolved.position,
        materials,
        selected: selectionMatchesPlumbingObject(params.selectedPlumbingObject, 'plumbing_fitting', fitting.id),
        trackGeometry: params.trackGeometry,
      });
      validationIssues.push(...fittingScene.validationIssues);
      group.add(fittingScene.group);
      selectableObjects.push(fittingScene.group);
      if (visibility.showLabels && fitting.labelVisible) {
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
