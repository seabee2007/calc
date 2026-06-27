import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveDesignBuilderGeometryPipeline } from '../application/designBuilderGeometryPipeline';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { syncPresetFromLayout } from '../domain/layoutWallAdapter';
import { buildSegmentFrameMap } from '../domain/openingPlacementResolver';
import { createDefaultRoofSystemSettings, normalizeRoofSystemSettings } from '../domain/roofSystemDefaults';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import {
  buildFasciaSceneGroup,
  buildGableRidgeGuideSceneGroup,
  buildHipFramingSceneGroup,
  buildPurlinSceneGroups,
  buildRakedCapSceneGroup,
  buildRidgeCapSceneGroup,
  buildRoofCladdingSceneGroup,
  buildSoffitSceneGroup,
  buildSteelTrussSceneGroups,
} from '../ui/DesignBuilderRoofScene';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type { RoofSystemSettings } from '../types';

function gableRoofSystem(): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  return normalizeRoofSystemSettings({
    ...defaults,
    roofType: 'gable',
    ridgeDirection: 'along_longest_axis',
    eaveOverhangMeters: 0.3,
    gableEndOverhangMeters: 0.3,
    gable: {
      ...defaults.gable,
      enabled: true,
      rakedConcreteCapEnabled: true,
    },
    purlins: {
      ...defaults.purlins,
      enabled: true,
    },
    steelTrusses: {
      ...defaults.steelTrusses,
      enabled: true,
    },
    fascia: {
      ...defaults.fascia,
      enabled: true,
    },
  });
}

function hipRoofSystem(): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  return normalizeRoofSystemSettings({
    ...defaults,
    roofType: 'hip',
    supportSystem: 'steel_hip_framing',
    eaveOverhangMeters: 0.3,
    purlins: {
      ...defaults.purlins,
      enabled: true,
    },
    fascia: {
      ...defaults.fascia,
      enabled: true,
    },
    gable: {
      ...defaults.gable,
      enabled: false,
      rakedConcreteCapEnabled: false,
    },
  });
}

function sceneGeometry(
  roofSystem = gableRoofSystem(),
  dimensions: { lengthMeters: number; widthMeters: number } = { lengthMeters: 8, widthMeters: 5 },
): { geometry: DesignGeometryResult; roofSystem: RoofSystemSettings; slabTopMeters: number } {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: dimensions.lengthMeters,
    widthMeters: dimensions.widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
  const synced = syncPresetFromLayout(
    {
      ...template,
      wall: {
        ...template.wall,
        openings: [],
      },
      wallLayout: layout,
    },
    layout,
  );
  const preset = applyAutoFrameLayout(synced);
  return {
    geometry: resolveDesignBuilderGeometryPipeline({
      wallLayout: preset.wallLayout,
      effectiveWall: preset.wall,
      resolvedPreset: {
        ...preset,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      },
      footprintClosed: true,
      activeRoofSystem: roofSystem,
    }).designGeometryResult,
    roofSystem,
    slabTopMeters: preset.slab.slabThicknessMeters,
  };
}

function meshCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) count += 1;
  });
  return count;
}

function lineCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Line) count += 1;
  });
  return count;
}

describe('DesignBuilderRoofScene', () => {
  it('builds roof cladding meshes from resolved display planes', () => {
    const { geometry, slabTopMeters } = sceneGeometry();
    const resolvedRoof = geometry.resolvedRoofSystem;
    expect(resolvedRoof?.supported).toBe(true);

    const tracked: THREE.BufferGeometry[] = [];
    const group = buildRoofCladdingSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      useMeterUvGeometry: false,
      trackGeometry: (meshGeometry) => {
        tracked.push(meshGeometry);
        return meshGeometry;
      },
    });

    expect(group.name).toBe('roofCladdingGroup');
    expect(meshCount(group)).toBeGreaterThanOrEqual(resolvedRoof!.claddingDisplayPlanes.length);
    expect(tracked.length).toBe(meshCount(group));
    expect(tracked.some((meshGeometry) => {
      meshGeometry.computeBoundingBox();
      return (meshGeometry.boundingBox?.max.y ?? 0) > slabTopMeters + resolvedRoof!.roofBeamTopY;
    })).toBe(true);
  });

  it('builds raked cap meshes anchored to gable segment frames', () => {
    const { geometry, slabTopMeters } = sceneGeometry();
    const frameBySegmentId = buildSegmentFrameMap(geometry.wallCmuLayout.segmentFrames ?? []);
    const tracked: THREE.BufferGeometry[] = [];

    const group = buildRakedCapSceneGroup({
      placements: geometry.rakedCapPlacements ?? [],
      frameBySegmentId,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry: (meshGeometry) => {
        tracked.push(meshGeometry);
        return meshGeometry;
      },
    });

    expect(group.name).toBe('rakedCapGroup');
    expect(meshCount(group)).toBeGreaterThan(0);
    expect(tracked.length).toBe(meshCount(group));
    for (const child of group.children) {
      expect(child.position.y).toBeCloseTo(slabTopMeters, 6);
    }
  });

  it('builds steel truss scene groups from resolved truss placements', () => {
    const { geometry, roofSystem, slabTopMeters } = sceneGeometry();
    const resolvedRoof = geometry.resolvedRoofSystem;
    expect(resolvedRoof?.trussPlacements.length).toBeGreaterThan(0);
    const tracked: THREE.BufferGeometry[] = [];
    const trackedMaterials: THREE.Material[] = [];

    const groups = buildSteelTrussSceneGroups({
      resolvedRoof: resolvedRoof!,
      roofSystem,
      slabTopMeters,
      materials: {
        chord: new THREE.MeshBasicMaterial(),
        web: new THREE.MeshBasicMaterial(),
        plate: new THREE.MeshBasicMaterial(),
        bolt: new THREE.MeshBasicMaterial(),
      },
      debugGuides: true,
      trackGeometry: (meshGeometry) => {
        tracked.push(meshGeometry);
        return meshGeometry;
      },
      trackMaterial: (material) => {
        trackedMaterials.push(material);
      },
    });

    expect(groups.trussChordGroup.name).toBe('trussChordGroup');
    expect(meshCount(groups.trussChordGroup)).toBeGreaterThan(0);
    expect(meshCount(groups.trussWebGroup)).toBeGreaterThan(0);
    expect(lineCount(groups.framingGuideGroup)).toBe(resolvedRoof!.trussPlacements.length);
    if (roofSystem.steelTrusses.basePlateEnabled) {
      expect(meshCount(groups.basePlateGroup)).toBeGreaterThan(0);
    }
    expect(tracked.length).toBe(
      meshCount(groups.trussChordGroup) +
        meshCount(groups.trussWebGroup) +
        meshCount(groups.basePlateGroup) +
        meshCount(groups.anchorBoltGroup) +
        lineCount(groups.framingGuideGroup),
    );
    expect(trackedMaterials.length).toBe(lineCount(groups.framingGuideGroup));
  });

  it('builds purlin meshes and optional contact guides', () => {
    const { geometry, slabTopMeters } = sceneGeometry();
    const resolvedRoof = geometry.resolvedRoofSystem;
    expect(resolvedRoof?.purlinPlacements.length).toBeGreaterThan(0);
    const tracked: THREE.BufferGeometry[] = [];
    const trackedMaterials: THREE.Material[] = [];

    const groups = buildPurlinSceneGroups({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      debugContactGuides: true,
      trackGeometry: (meshGeometry) => {
        tracked.push(meshGeometry);
        return meshGeometry;
      },
      trackMaterial: (material) => {
        trackedMaterials.push(material);
      },
    });

    expect(groups.purlinGroup.name).toBe('purlinGroup');
    expect(meshCount(groups.purlinGroup)).toBe(resolvedRoof!.purlinPlacements.length);
    expect(lineCount(groups.framingGuideGroup)).toBeGreaterThan(0);
    expect(tracked.length).toBe(meshCount(groups.purlinGroup) + lineCount(groups.framingGuideGroup));
    expect(trackedMaterials.length).toBe(lineCount(groups.framingGuideGroup));
  });

  it('builds ridge cap, fascia, soffit, and gable ridge guide groups', () => {
    const { geometry, slabTopMeters } = sceneGeometry();
    const resolvedRoof = geometry.resolvedRoofSystem;
    expect(resolvedRoof?.ridgeCapPlacements.length).toBeGreaterThan(0);
    expect(resolvedRoof?.fasciaPlacements.length).toBeGreaterThan(0);
    expect(resolvedRoof?.soffitPlacements.length).toBeGreaterThan(0);
    const tracked: THREE.BufferGeometry[] = [];
    const trackedMaterials: THREE.Material[] = [];
    const trackGeometry = <T extends THREE.BufferGeometry>(meshGeometry: T): T => {
      tracked.push(meshGeometry);
      return meshGeometry;
    };

    const ridgeCapGroup = buildRidgeCapSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry,
    });
    const fasciaGroup = buildFasciaSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry,
    });
    const soffitGroup = buildSoffitSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry,
    });
    const guideGroup = buildGableRidgeGuideSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      trackGeometry,
      trackMaterial: (material) => trackedMaterials.push(material),
    });

    expect(ridgeCapGroup.name).toBe('ridgeCapGroup');
    expect(meshCount(ridgeCapGroup)).toBeGreaterThan(0);
    expect(meshCount(fasciaGroup)).toBe(resolvedRoof!.fasciaPlacements.length);
    expect(meshCount(soffitGroup)).toBe(resolvedRoof!.soffitPlacements.length);
    expect(lineCount(guideGroup)).toBe(4);
    expect(fasciaGroup.children.every((child) => typeof child.userData.fasciaEdgeRole === 'string')).toBe(true);
    expect(soffitGroup.children.every((child) => typeof child.userData.soffitEdgeRole === 'string')).toBe(true);
    expect(trackedMaterials.length).toBe(lineCount(guideGroup));
    expect(tracked.length).toBe(
      meshCount(ridgeCapGroup) +
        meshCount(fasciaGroup) +
        meshCount(soffitGroup) +
        lineCount(guideGroup),
    );
  });

  it('builds hip framing meshes from resolved hip members', () => {
    const { geometry, slabTopMeters } = sceneGeometry(
      hipRoofSystem(),
      { lengthMeters: 10, widthMeters: 6 },
    );
    const resolvedRoof = geometry.resolvedRoofSystem;
    expect(resolvedRoof?.roofType).toBe('hip');
    expect(resolvedRoof?.hipFramingMembers.length).toBeGreaterThan(0);
    const tracked: THREE.BufferGeometry[] = [];

    const group = buildHipFramingSceneGroup({
      resolvedRoof: resolvedRoof!,
      slabTopMeters,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry: (meshGeometry) => {
        tracked.push(meshGeometry);
        return meshGeometry;
      },
    });

    expect(group.name).toBe('trussChordGroup');
    expect(meshCount(group)).toBe(resolvedRoof!.hipFramingMembers.length);
    expect(tracked.length).toBe(meshCount(group));
  });
});
